import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
    applyStateUpdate,
    defaultElderState,
    ensureElderShape,
    ingestEvent,
    normalizeEvent,
} from './state.mjs';
import { HttpError } from './store.mjs';

const DEFAULT_ELDER_ID = 'elder_demo';
const SCHEMA_VERSION = 2;

export class PostgresDataStore {
    constructor(options = {}) {
        this.rootDir = options.rootDir || path.join(process.cwd(), 'backend', 'data-server', 'data');
        this.eldersDir = options.eldersDir || path.join(this.rootDir, 'elders');
        this.eventsDir = options.eventsDir || path.join(this.rootDir, 'events');
        this.uploadsDir = options.uploadsDir || path.join(this.rootDir, 'uploads');
        this.legacyStatePath = options.legacyStatePath || path.join(process.cwd(), 'backend', 'bridge', 'data', 'state.json');
        this.defaultElderId = options.defaultElderId || DEFAULT_ELDER_ID;
        this.publicBaseUrl = options.publicBaseUrl || '';
        this.connectionString = options.connectionString || process.env.EMOBIT_POSTGRES_URL || process.env.DATABASE_URL || '';
        this.poolMax = Number(options.poolMax || process.env.EMOBIT_POSTGRES_POOL_MAX || 20);
        this.pool = options.pool || options.postgresPool || null;
        this.ownsPool = !this.pool;
        this.initialized = false;
        this.storageName = 'postgres';
        this.databaseLabel = this.connectionString ? redactConnectionString(this.connectionString) : 'injected-pool';
    }

    async initialize() {
        if (this.initialized) return;
        await fs.mkdir(this.rootDir, { recursive: true });
        await fs.mkdir(this.eldersDir, { recursive: true });
        await fs.mkdir(this.eventsDir, { recursive: true });
        await fs.mkdir(this.uploadsDir, { recursive: true });
        await this.#ensurePool();
        await this.#migrateSchema();
        await this.#bootstrapFromFileStores();
        await this.#backfillRelationalProjection();
        this.initialized = true;
    }

    async close() {
        if (this.pool && this.ownsPool && typeof this.pool.end === 'function') {
            await this.pool.end();
        }
        this.pool = null;
        this.initialized = false;
    }

    async listElders() {
        await this.initialize();
        const result = await this.pool.query(`
            SELECT elder_id AS "elderId" FROM elders
            UNION
            SELECT elder_id AS "elderId" FROM elder_state
            ORDER BY "elderId"
        `);
        return result.rows.map((row) => row.elderId);
    }

    async getElder(elderId = this.defaultElderId) {
        await this.initialize();
        const normalizedElderId = normalizeElderId(elderId);
        const elder = await this.#readOrBootstrapElder(normalizedElderId);
        return ensureElderShape(elder);
    }

    async updateSection(elderId, key, payload) {
        await this.initialize();
        const normalizedElderId = normalizeElderId(elderId);
        return this.#withTransaction(async (client) => {
            const elder = await this.#readOrBootstrapElder(normalizedElderId, client, { forUpdate: true });
            try {
                applyStateUpdate(elder, key, payload);
            } catch (error) {
                if (error instanceof HttpError) throw error;
                throw new HttpError(400, error instanceof Error ? error.message : String(error), 'invalid_section');
            }
            elder.updatedAt = new Date().toISOString();
            await this.#writeElder(normalizedElderId, elder, client);
            return ensureElderShape(elder);
        });
    }

    async appendEvent(elderId, input) {
        await this.initialize();
        const normalizedElderId = normalizeElderId(elderId);
        const result = await this.#withTransaction(async (client) => {
            const elder = await this.#readOrBootstrapElder(normalizedElderId, client, { forUpdate: true });
            const event = ingestEvent(elder, input);
            elder.updatedAt = new Date().toISOString();
            await this.#writeElder(normalizedElderId, elder, client);
            await this.#insertEvent(normalizedElderId, event, client);
            return {
                elder: ensureElderShape(elder),
                event,
            };
        });
        await this.#appendLegacyEventLog(normalizedElderId, result.event);
        return result;
    }

    async uploadMedia(input, requestBaseUrl) {
        await this.initialize();
        const elderId = normalizeElderId(input?.elderId || this.defaultElderId);
        const mediaType = normalizeMediaType(input?.type);
        const filename = String(input?.filename || '').trim();
        const mimeType = String(input?.mimeType || '').trim().toLowerCase();
        const contentBase64 = String(input?.contentBase64 || '').trim();

        if (!filename) throw new HttpError(400, 'Media filename is required.', 'invalid_filename');
        if (!mimeType) throw new HttpError(400, 'Media mimeType is required.', 'invalid_mime_type');
        if (!contentBase64) throw new HttpError(400, 'Media contentBase64 is required.', 'invalid_content');

        const buffer = decodeBase64Content(contentBase64);
        await this.#ensureElderRow(elderId);
        const extension = resolveExtension(filename, mimeType);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 20);
        const storedName = `${hash}${extension}`;
        const mediaId = `${elderId}/${mediaType}/${storedName}`;
        const relativePath = path.join(elderId, mediaType, storedName);
        const filePath = path.join(this.uploadsDir, relativePath);

        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, buffer);

        const publicBaseUrl = String(this.publicBaseUrl || requestBaseUrl || '').replace(/\/$/, '');
        const url = publicBaseUrl ? `${publicBaseUrl}/media/${mediaId}` : `/media/${mediaId}`;
        const createdAt = new Date().toISOString();

        await this.pool.query(`
            INSERT INTO media (media_id, elder_id, type, filename, mime_type, size_bytes, relative_path, url, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (media_id) DO UPDATE SET
                filename = EXCLUDED.filename,
                mime_type = EXCLUDED.mime_type,
                size_bytes = EXCLUDED.size_bytes,
                relative_path = EXCLUDED.relative_path,
                url = EXCLUDED.url
        `, [mediaId, elderId, mediaType, filename, mimeType, buffer.byteLength, relativePath, url, createdAt]);

        return {
            elderId,
            mediaId,
            url,
            mimeType,
            size: buffer.byteLength,
        };
    }

    resolveMediaPath(mediaId) {
        return path.join(this.uploadsDir, normalizeMediaId(mediaId));
    }

    async readEventLog(elderId) {
        await this.initialize();
        const normalizedElderId = normalizeElderId(elderId);
        const result = await this.pool.query(`
            SELECT event_json AS "eventJson"
            FROM events
            WHERE elder_id = $1
            ORDER BY id ASC
        `, [normalizedElderId]);
        return result.rows.map((row) => parseJson(row.eventJson));
    }

    async #ensurePool() {
        if (this.pool) return;
        if (!this.connectionString) {
            throw new HttpError(500, 'PostgreSQL storage requires EMOBIT_POSTGRES_URL or DATABASE_URL.', 'postgres_not_configured');
        }
        let PgPool;
        try {
            ({ Pool: PgPool } = await import('pg'));
        } catch {
            throw new HttpError(500, 'PostgreSQL storage requires the "pg" package. Run npm install pg before enabling EMOBIT_DATA_SERVER_STORAGE=postgres.', 'postgres_driver_missing');
        }
        this.pool = new PgPool({
            connectionString: this.connectionString,
            max: this.poolMax,
            idleTimeoutMillis: Number(process.env.EMOBIT_POSTGRES_IDLE_TIMEOUT_MS || 30_000),
            connectionTimeoutMillis: Number(process.env.EMOBIT_POSTGRES_CONNECT_TIMEOUT_MS || 10_000),
            ssl: parsePostgresSsl(process.env.EMOBIT_POSTGRES_SSL),
        });
    }

    async #migrateSchema() {
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS elders (
                elder_id TEXT PRIMARY KEY,
                name TEXT,
                nickname TEXT,
                gender TEXT,
                age INTEGER,
                home_address TEXT,
                profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS elder_state (
                elder_id TEXT PRIMARY KEY,
                updated_at TIMESTAMPTZ NOT NULL,
                state_json JSONB NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_elders_name ON elders(name);
            CREATE INDEX IF NOT EXISTS idx_elders_updated_at ON elders(updated_at DESC);

            CREATE TABLE IF NOT EXISTS elder_guardian_contacts (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                contact_id TEXT NOT NULL,
                name TEXT,
                relation TEXT,
                phone TEXT,
                channel TEXT,
                target TEXT,
                priority INTEGER,
                contact_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, contact_id)
            );

            CREATE INDEX IF NOT EXISTS idx_guardian_contacts_elder_priority ON elder_guardian_contacts(elder_id, priority);

            CREATE TABLE IF NOT EXISTS elder_memory_anchors (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                anchor_id TEXT NOT NULL,
                name TEXT,
                category TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                radius_meters DOUBLE PRECISION,
                memory_text TEXT,
                voice_text TEXT,
                anchor_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, anchor_id)
            );

            CREATE INDEX IF NOT EXISTS idx_memory_anchors_elder_category ON elder_memory_anchors(elder_id, category);

            CREATE TABLE IF NOT EXISTS elder_safe_zones (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                zone_id TEXT NOT NULL,
                name TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                radius_meters DOUBLE PRECISION,
                zone_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, zone_id)
            );

            CREATE TABLE IF NOT EXISTS elder_medications (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                medication_id TEXT NOT NULL,
                name TEXT,
                dosage TEXT,
                frequency TEXT,
                instructions TEXT,
                purpose TEXT,
                times_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                image_url TEXT,
                medication_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, medication_id)
            );

            CREATE INDEX IF NOT EXISTS idx_medications_elder_name ON elder_medications(elder_id, name);

            CREATE TABLE IF NOT EXISTS elder_medication_logs (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                log_id TEXT NOT NULL,
                medication_id TEXT,
                medication_name TEXT,
                scheduled_time TEXT,
                actual_time TEXT,
                status TEXT,
                log_date DATE,
                log_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, log_id)
            );

            CREATE INDEX IF NOT EXISTS idx_medication_logs_elder_date ON elder_medication_logs(elder_id, log_date DESC);
            CREATE INDEX IF NOT EXISTS idx_medication_logs_elder_medication ON elder_medication_logs(elder_id, medication_id);

            CREATE TABLE IF NOT EXISTS elder_health_snapshots (
                elder_id TEXT PRIMARY KEY REFERENCES elders(elder_id) ON DELETE CASCADE,
                metrics_json JSONB,
                alerts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS elder_cognitive_records (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                record_id TEXT NOT NULL,
                record_type TEXT NOT NULL,
                score DOUBLE PRECISION,
                max_score DOUBLE PRECISION,
                sentiment TEXT,
                occurred_at TIMESTAMPTZ,
                record_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, record_type, record_id)
            );

            CREATE INDEX IF NOT EXISTS idx_cognitive_records_elder_type ON elder_cognitive_records(elder_id, record_type, occurred_at DESC);

            CREATE TABLE IF NOT EXISTS elder_care_plan_items (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                item_id TEXT NOT NULL,
                title TEXT,
                item_time TEXT,
                enabled BOOLEAN,
                item_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, item_id)
            );

            CREATE TABLE IF NOT EXISTS elder_care_plan_events (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                event_id TEXT NOT NULL,
                event_type TEXT,
                item_id TEXT,
                occurred_at TIMESTAMPTZ,
                event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, event_id)
            );

            CREATE INDEX IF NOT EXISTS idx_care_plan_events_elder_time ON elder_care_plan_events(elder_id, occurred_at DESC);

            CREATE TABLE IF NOT EXISTS elder_care_plan_trends (
                elder_id TEXT PRIMARY KEY REFERENCES elders(elder_id) ON DELETE CASCADE,
                trend_json JSONB,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS elder_wandering_state (
                elder_id TEXT PRIMARY KEY REFERENCES elders(elder_id) ON DELETE CASCADE,
                is_wandering BOOLEAN,
                wandering_type TEXT,
                confidence DOUBLE PRECISION,
                duration_seconds DOUBLE PRECISION,
                distance_from_home_meters DOUBLE PRECISION,
                outside_safe_zone BOOLEAN,
                state_json JSONB,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS elder_sundowning_state (
                elder_id TEXT PRIMARY KEY REFERENCES elders(elder_id) ON DELETE CASCADE,
                risk_score DOUBLE PRECISION,
                risk_level TEXT,
                snapshot_json JSONB,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS elder_sundowning_events (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                event_id TEXT NOT NULL,
                event_kind TEXT NOT NULL,
                risk_score DOUBLE PRECISION,
                level TEXT,
                event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, event_kind, event_id)
            );

            CREATE INDEX IF NOT EXISTS idx_sundowning_events_elder_kind ON elder_sundowning_events(elder_id, event_kind, updated_at DESC);

            CREATE TABLE IF NOT EXISTS elder_app_shell (
                elder_id TEXT PRIMARY KEY REFERENCES elders(elder_id) ON DELETE CASCADE,
                active_view TEXT,
                simulation TEXT,
                system_status TEXT,
                elder_message_json JSONB,
                elder_action_json JSONB,
                shell_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS elder_faces (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                face_id TEXT NOT NULL,
                name TEXT,
                relation TEXT,
                image_url TEXT,
                face_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, face_id)
            );

            CREATE TABLE IF NOT EXISTS elder_time_album_items (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                album_item_id TEXT NOT NULL,
                media_url TEXT,
                album_date TEXT,
                location TEXT,
                story TEXT,
                tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                item_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, album_item_id)
            );

            CREATE TABLE IF NOT EXISTS elder_ui_commands (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                command_id TEXT NOT NULL,
                command_type TEXT,
                timestamp_ms BIGINT NOT NULL,
                payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                command_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, command_id)
            );

            CREATE INDEX IF NOT EXISTS idx_ui_commands_elder_time ON elder_ui_commands(elder_id, timestamp_ms DESC);

            CREATE TABLE IF NOT EXISTS elder_outbound_events (
                elder_id TEXT NOT NULL REFERENCES elders(elder_id) ON DELETE CASCADE,
                outbound_id TEXT NOT NULL,
                audience TEXT,
                channel TEXT,
                purpose TEXT,
                message TEXT,
                targets_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                outbound_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (elder_id, outbound_id)
            );

            CREATE INDEX IF NOT EXISTS idx_outbound_events_elder_purpose ON elder_outbound_events(elder_id, purpose, occurred_at DESC);

            CREATE TABLE IF NOT EXISTS events (
                id BIGSERIAL PRIMARY KEY,
                event_id TEXT NOT NULL UNIQUE,
                elder_id TEXT NOT NULL,
                type TEXT NOT NULL,
                severity TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                timestamp_ms BIGINT NOT NULL,
                source TEXT NOT NULL,
                payload_json JSONB NOT NULL,
                event_json JSONB NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_events_elder_id ON events(elder_id);
            CREATE INDEX IF NOT EXISTS idx_events_elder_timestamp ON events(elder_id, timestamp_ms DESC);
            CREATE INDEX IF NOT EXISTS idx_events_elder_type ON events(elder_id, type);

            CREATE TABLE IF NOT EXISTS media (
                id BIGSERIAL PRIMARY KEY,
                media_id TEXT NOT NULL UNIQUE,
                elder_id TEXT NOT NULL,
                type TEXT NOT NULL,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes BIGINT NOT NULL,
                relative_path TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_media_elder_id ON media(elder_id);
            CREATE INDEX IF NOT EXISTS idx_media_elder_type ON media(elder_id, type);
        `);

        await this.pool.query(`
            INSERT INTO schema_migrations (version, applied_at)
            VALUES ($1, now())
            ON CONFLICT (version) DO NOTHING
        `, [SCHEMA_VERSION]);
    }

    async #bootstrapFromFileStores() {
        const imported = new Set();
        try {
            const entries = await fs.readdir(this.eldersDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
                const elderId = entry.name.replace(/\.json$/, '');
                if (!isValidElderId(elderId) || await this.#hasElder(elderId)) continue;
                const content = await fs.readFile(path.join(this.eldersDir, entry.name), 'utf8');
                await this.#writeElder(elderId, ensureElderShape(JSON.parse(content)));
                imported.add(elderId);
            }
        } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
        }

        try {
            const raw = await fs.readFile(this.legacyStatePath, 'utf8');
            const parsed = JSON.parse(raw);
            for (const [elderId, elder] of Object.entries(parsed?.elders || {})) {
                if (!isValidElderId(elderId) || await this.#hasElder(elderId)) continue;
                await this.#writeElder(elderId, ensureElderShape(elder));
                imported.add(elderId);
            }
        } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
        }

        for (const elderId of imported) {
            await this.#importEventLog(elderId);
        }
    }

    async #importEventLog(elderId) {
        const filePath = path.join(this.eventsDir, `${elderId}.ndjson`);
        try {
            const content = await fs.readFile(filePath, 'utf8');
            for (const line of content.split('\n').filter(Boolean)) {
                await this.#insertEvent(elderId, normalizeEvent(JSON.parse(line)));
            }
        } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
        }
    }

    async #readOrBootstrapElder(elderId, client = this.pool, options = {}) {
        await this.#ensureElderRow(elderId, client);
        const result = await client.query(`
            SELECT state_json AS "stateJson"
            FROM elder_state
            WHERE elder_id = $1
            ${options.forUpdate ? 'FOR UPDATE' : ''}
        `, [elderId]);
        return ensureElderShape(parseJson(result.rows[0]?.stateJson));
    }

    async #ensureElderRow(elderId, client = this.pool) {
        if (await this.#hasElder(elderId, client)) return;
        const elder = await this.#loadLegacyElder(elderId) || defaultElderState();
        await this.#writeElder(elderId, ensureElderShape(elder), client);
    }

    async #loadLegacyElder(elderId) {
        const elderPath = path.join(this.eldersDir, `${elderId}.json`);
        try {
            return ensureElderShape(JSON.parse(await fs.readFile(elderPath, 'utf8')));
        } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
        }

        try {
            const raw = await fs.readFile(this.legacyStatePath, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed?.elders?.[elderId] ? ensureElderShape(parsed.elders[elderId]) : null;
        } catch (error) {
            if (error && error.code === 'ENOENT') return null;
            throw error;
        }
    }

    async #writeElder(elderId, elder, client = this.pool) {
        const normalized = ensureElderShape(elder);
        await this.#syncRelationalProjection(elderId, normalized, client);
        await client.query(`
            INSERT INTO elder_state (elder_id, updated_at, state_json)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (elder_id) DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                state_json = EXCLUDED.state_json
        `, [elderId, normalized.updatedAt, JSON.stringify(normalized)]);
    }

    async #insertEvent(elderId, event, client = this.pool) {
        const normalized = normalizeEvent(event);
        const timestampMs = new Date(normalized.timestamp).getTime();
        await client.query(`
            INSERT INTO events (
                event_id, elder_id, type, severity, timestamp, timestamp_ms, source, payload_json, event_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
            ON CONFLICT (event_id) DO NOTHING
        `, [
            normalized.id,
            elderId,
            normalized.type,
            normalized.severity,
            normalized.timestamp,
            Number.isFinite(timestampMs) ? timestampMs : Date.now(),
            normalized.source,
            JSON.stringify(normalized.payload || {}),
            JSON.stringify(normalized),
        ]);
    }

    async #appendLegacyEventLog(elderId, event) {
        const filePath = path.join(this.eventsDir, `${elderId}.ndjson`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.appendFile(filePath, `${JSON.stringify(normalizeEvent(event))}\n`, 'utf8');
    }

    async #hasElder(elderId, client = this.pool) {
        const result = await client.query('SELECT 1 FROM elder_state WHERE elder_id = $1 LIMIT 1', [elderId]);
        return result.rows.length > 0;
    }

    async #backfillRelationalProjection() {
        const result = await this.pool.query(`
            SELECT elder_id AS "elderId", state_json AS "stateJson"
            FROM elder_state
        `);
        for (const row of result.rows) {
            await this.#syncRelationalProjection(row.elderId, ensureElderShape(parseJson(row.stateJson)));
        }
    }

    async #syncRelationalProjection(elderId, elder, client = this.pool) {
        const updatedAt = toIsoTimestamp(elder.updatedAt) || new Date().toISOString();
        const profile = isObject(elder.profile) ? elder.profile : {};

        await client.query(`
            INSERT INTO elders (elder_id, name, nickname, gender, age, home_address, profile_json, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
            ON CONFLICT (elder_id) DO UPDATE SET
                name = EXCLUDED.name,
                nickname = EXCLUDED.nickname,
                gender = EXCLUDED.gender,
                age = EXCLUDED.age,
                home_address = EXCLUDED.home_address,
                profile_json = EXCLUDED.profile_json,
                updated_at = EXCLUDED.updated_at
        `, [
            elderId,
            stringOrNull(profile.name),
            stringOrNull(profile.nickname),
            stringOrNull(profile.gender),
            integerOrNull(profile.age),
            stringOrNull(profile.homeAddress),
            JSON.stringify(profile),
            updatedAt,
        ]);

        await this.#replaceGuardianContacts(elderId, elder.guardianContacts || [], updatedAt, client);
        await this.#replaceMemoryAnchors(elderId, elder.memoryAnchors || [], updatedAt, client);
        await this.#replaceSafeZones(elderId, elder.wanderingConfig?.safeZones || [], updatedAt, client);
        await this.#replaceMedications(elderId, elder.medications || [], updatedAt, client);
        await this.#replaceMedicationLogs(elderId, elder.medicationLogs || [], updatedAt, client);
        await this.#upsertHealthSnapshot(elderId, elder.health || {}, updatedAt, client);
        await this.#replaceCognitiveRecords(elderId, elder.cognitive || {}, updatedAt, client);
        await this.#replaceCarePlan(elderId, elder.carePlan || {}, updatedAt, client);
        await this.#upsertWanderingState(elderId, elder.wandering?.state || null, updatedAt, client);
        await this.#upsertSundowningState(elderId, elder.sundowning || {}, updatedAt, client);
        await this.#upsertAppShell(elderId, elder.appShell || {}, updatedAt, client);
        await this.#replaceFaces(elderId, elder.faces || [], updatedAt, client);
        await this.#replaceTimeAlbum(elderId, elder.timeAlbum || [], updatedAt, client);
        await this.#replaceUiCommands(elderId, elder.uiCommands || [], updatedAt, client);
        await this.#replaceOutboundEvents(elderId, elder.outboundEvents || elder.outbound || [], updatedAt, client);
    }

    async #replaceGuardianContacts(elderId, contacts, updatedAt, client) {
        await client.query('DELETE FROM elder_guardian_contacts WHERE elder_id = $1', [elderId]);
        for (const [index, contact] of toArray(contacts).entries()) {
            await client.query(`
                INSERT INTO elder_guardian_contacts (
                    elder_id, contact_id, name, relation, phone, channel, target, priority, contact_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
            `, [
                elderId,
                stableItemId('guardian', contact, index),
                stringOrNull(contact.name),
                stringOrNull(contact.relation),
                stringOrNull(contact.phone),
                stringOrNull(contact.channel),
                stringOrNull(contact.target),
                integerOrNull(contact.priority),
                JSON.stringify(serializeObject(contact)),
                updatedAt,
            ]);
        }
    }

    async #replaceMemoryAnchors(elderId, anchors, updatedAt, client) {
        await client.query('DELETE FROM elder_memory_anchors WHERE elder_id = $1', [elderId]);
        for (const [index, anchor] of toArray(anchors).entries()) {
            const location = anchor.location || {};
            await client.query(`
                INSERT INTO elder_memory_anchors (
                    elder_id, anchor_id, name, category, latitude, longitude, radius_meters,
                    memory_text, voice_text, anchor_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
            `, [
                elderId,
                stableItemId('anchor', anchor, index),
                stringOrNull(anchor.name),
                stringOrNull(anchor.category),
                numberOrNull(location.lat ?? location.latitude),
                numberOrNull(location.lng ?? location.longitude),
                numberOrNull(anchor.radius ?? anchor.radiusMeters),
                stringOrNull(anchor.memoryText),
                stringOrNull(anchor.voiceText),
                JSON.stringify(serializeObject(anchor)),
                updatedAt,
            ]);
        }
    }

    async #replaceSafeZones(elderId, zones, updatedAt, client) {
        await client.query('DELETE FROM elder_safe_zones WHERE elder_id = $1', [elderId]);
        for (const [index, zone] of toArray(zones).entries()) {
            const center = zone.center || zone.location || {};
            await client.query(`
                INSERT INTO elder_safe_zones (
                    elder_id, zone_id, name, latitude, longitude, radius_meters, zone_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
            `, [
                elderId,
                stableItemId('zone', zone, index),
                stringOrNull(zone.name),
                numberOrNull(center.latitude ?? center.lat),
                numberOrNull(center.longitude ?? center.lng),
                numberOrNull(zone.radiusMeters ?? zone.radius),
                JSON.stringify(serializeObject(zone)),
                updatedAt,
            ]);
        }
    }

    async #replaceMedications(elderId, medications, updatedAt, client) {
        await client.query('DELETE FROM elder_medications WHERE elder_id = $1', [elderId]);
        for (const [index, medication] of toArray(medications).entries()) {
            await client.query(`
                INSERT INTO elder_medications (
                    elder_id, medication_id, name, dosage, frequency, instructions, purpose,
                    times_json, image_url, medication_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb, $11)
            `, [
                elderId,
                stableItemId('medication', medication, index),
                stringOrNull(medication.name),
                stringOrNull(medication.dosage),
                stringOrNull(medication.frequency),
                stringOrNull(medication.instructions),
                stringOrNull(medication.purpose),
                JSON.stringify(Array.isArray(medication.times) ? medication.times : []),
                stringOrNull(medication.imageUrl),
                JSON.stringify(serializeObject(medication)),
                updatedAt,
            ]);
        }
    }

    async #replaceMedicationLogs(elderId, logs, updatedAt, client) {
        await client.query('DELETE FROM elder_medication_logs WHERE elder_id = $1', [elderId]);
        for (const [index, log] of toArray(logs).entries()) {
            await client.query(`
                INSERT INTO elder_medication_logs (
                    elder_id, log_id, medication_id, medication_name, scheduled_time, actual_time,
                    status, log_date, log_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
            `, [
                elderId,
                stableItemId('medlog', log, index),
                stringOrNull(log.medicationId),
                stringOrNull(log.medicationName),
                stringOrNull(log.scheduledTime),
                stringOrNull(log.actualTime),
                stringOrNull(log.status),
                dateOrNull(log.date),
                JSON.stringify(serializeObject(log)),
                updatedAt,
            ]);
        }
    }

    async #upsertHealthSnapshot(elderId, health, updatedAt, client) {
        await client.query(`
            INSERT INTO elder_health_snapshots (elder_id, metrics_json, alerts_json, updated_at)
            VALUES ($1, $2::jsonb, $3::jsonb, $4)
            ON CONFLICT (elder_id) DO UPDATE SET
                metrics_json = EXCLUDED.metrics_json,
                alerts_json = EXCLUDED.alerts_json,
                updated_at = EXCLUDED.updated_at
        `, [
            elderId,
            JSON.stringify(health.metrics ?? null),
            JSON.stringify(Array.isArray(health.alerts) ? health.alerts : []),
            updatedAt,
        ]);
    }

    async #replaceCognitiveRecords(elderId, cognitive, updatedAt, client) {
        await client.query('DELETE FROM elder_cognitive_records WHERE elder_id = $1', [elderId]);
        const groups = [
            ['conversation', cognitive.conversations || []],
            ['assessment', cognitive.assessments || []],
            ['report', cognitive.reports || []],
        ];
        for (const [recordType, records] of groups) {
            for (const [index, record] of toArray(records).entries()) {
                await client.query(`
                    INSERT INTO elder_cognitive_records (
                        elder_id, record_id, record_type, score, max_score, sentiment,
                        occurred_at, record_json, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
                `, [
                    elderId,
                    stableItemId(`cognitive_${recordType}`, record, index),
                    recordType,
                    numberOrNull(record.score),
                    numberOrNull(record.maxScore),
                    stringOrNull(record.sentiment),
                    timestampOrNull(record.timestamp || record.createdAt || record.date),
                    JSON.stringify(serializeObject(record)),
                    updatedAt,
                ]);
            }
        }
    }

    async #replaceCarePlan(elderId, carePlan, updatedAt, client) {
        await client.query('DELETE FROM elder_care_plan_items WHERE elder_id = $1', [elderId]);
        await client.query('DELETE FROM elder_care_plan_events WHERE elder_id = $1', [elderId]);

        for (const [index, item] of toArray(carePlan.items || []).entries()) {
            await client.query(`
                INSERT INTO elder_care_plan_items (
                    elder_id, item_id, title, item_time, enabled, item_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            `, [
                elderId,
                stableItemId('care_item', item, index),
                stringOrNull(item.title),
                stringOrNull(item.time),
                booleanOrNull(item.enabled),
                JSON.stringify(serializeObject(item)),
                updatedAt,
            ]);
        }

        for (const [index, event] of toArray(carePlan.events || []).entries()) {
            await client.query(`
                INSERT INTO elder_care_plan_events (
                    elder_id, event_id, event_type, item_id, occurred_at, event_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            `, [
                elderId,
                stableItemId('care_event', event, index),
                stringOrNull(event.eventType || event.type),
                stringOrNull(event.itemId),
                timestampOrNull(event.timestamp || event.createdAt || event.date),
                JSON.stringify(serializeObject(event)),
                updatedAt,
            ]);
        }

        await client.query(`
            INSERT INTO elder_care_plan_trends (elder_id, trend_json, updated_at)
            VALUES ($1, $2::jsonb, $3)
            ON CONFLICT (elder_id) DO UPDATE SET
                trend_json = EXCLUDED.trend_json,
                updated_at = EXCLUDED.updated_at
        `, [elderId, JSON.stringify(carePlan.trend ?? null), updatedAt]);
    }

    async #upsertWanderingState(elderId, state, updatedAt, client) {
        const source = isObject(state) ? state : {};
        await client.query(`
            INSERT INTO elder_wandering_state (
                elder_id, is_wandering, wandering_type, confidence, duration_seconds,
                distance_from_home_meters, outside_safe_zone, state_json, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
            ON CONFLICT (elder_id) DO UPDATE SET
                is_wandering = EXCLUDED.is_wandering,
                wandering_type = EXCLUDED.wandering_type,
                confidence = EXCLUDED.confidence,
                duration_seconds = EXCLUDED.duration_seconds,
                distance_from_home_meters = EXCLUDED.distance_from_home_meters,
                outside_safe_zone = EXCLUDED.outside_safe_zone,
                state_json = EXCLUDED.state_json,
                updated_at = EXCLUDED.updated_at
        `, [
            elderId,
            booleanOrNull(source.isWandering),
            stringOrNull(source.wanderingType),
            numberOrNull(source.confidence),
            numberOrNull(source.duration),
            numberOrNull(source.distanceFromHome),
            booleanOrNull(source.outsideSafeZone),
            JSON.stringify(state ?? null),
            updatedAt,
        ]);
    }

    async #upsertSundowningState(elderId, sundowning, updatedAt, client) {
        const snapshot = isObject(sundowning.snapshot) ? sundowning.snapshot : {};
        await client.query(`
            INSERT INTO elder_sundowning_state (elder_id, risk_score, risk_level, snapshot_json, updated_at)
            VALUES ($1, $2, $3, $4::jsonb, $5)
            ON CONFLICT (elder_id) DO UPDATE SET
                risk_score = EXCLUDED.risk_score,
                risk_level = EXCLUDED.risk_level,
                snapshot_json = EXCLUDED.snapshot_json,
                updated_at = EXCLUDED.updated_at
        `, [
            elderId,
            numberOrNull(snapshot.riskScore),
            stringOrNull(snapshot.riskLevel || snapshot.level),
            JSON.stringify(sundowning.snapshot ?? null),
            updatedAt,
        ]);

        await client.query('DELETE FROM elder_sundowning_events WHERE elder_id = $1', [elderId]);
        for (const [kind, items] of [['alert', sundowning.alerts || []], ['intervention', sundowning.interventions || []]]) {
            for (const [index, item] of toArray(items).entries()) {
                await client.query(`
                    INSERT INTO elder_sundowning_events (
                        elder_id, event_id, event_kind, risk_score, level, event_json, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
                `, [
                    elderId,
                    stableItemId(`sundowning_${kind}`, item, index),
                    kind,
                    numberOrNull(item.riskScore),
                    stringOrNull(item.level || item.riskLevel),
                    JSON.stringify(serializeObject(item)),
                    updatedAt,
                ]);
            }
        }
    }

    async #upsertAppShell(elderId, appShell, updatedAt, client) {
        const shellUpdatedAt = toIsoTimestamp(appShell.updatedAt) || updatedAt;
        await client.query(`
            INSERT INTO elder_app_shell (
                elder_id, active_view, simulation, system_status, elder_message_json,
                elder_action_json, shell_json, updated_at
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)
            ON CONFLICT (elder_id) DO UPDATE SET
                active_view = EXCLUDED.active_view,
                simulation = EXCLUDED.simulation,
                system_status = EXCLUDED.system_status,
                elder_message_json = EXCLUDED.elder_message_json,
                elder_action_json = EXCLUDED.elder_action_json,
                shell_json = EXCLUDED.shell_json,
                updated_at = EXCLUDED.updated_at
        `, [
            elderId,
            stringOrNull(appShell.activeView),
            stringOrNull(appShell.simulation),
            stringOrNull(appShell.systemStatus),
            JSON.stringify(appShell.elderMessage ?? null),
            JSON.stringify(appShell.elderAction ?? null),
            JSON.stringify(serializeObject(appShell)),
            shellUpdatedAt,
        ]);
    }

    async #replaceFaces(elderId, faces, updatedAt, client) {
        await client.query('DELETE FROM elder_faces WHERE elder_id = $1', [elderId]);
        for (const [index, face] of toArray(faces).entries()) {
            await client.query(`
                INSERT INTO elder_faces (elder_id, face_id, name, relation, image_url, face_json, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            `, [
                elderId,
                stableItemId('face', face, index),
                stringOrNull(face.name),
                stringOrNull(face.relation),
                stringOrNull(face.imageUrl || face.url),
                JSON.stringify(serializeObject(face)),
                updatedAt,
            ]);
        }
    }

    async #replaceTimeAlbum(elderId, items, updatedAt, client) {
        await client.query('DELETE FROM elder_time_album_items WHERE elder_id = $1', [elderId]);
        for (const [index, item] of toArray(items).entries()) {
            await client.query(`
                INSERT INTO elder_time_album_items (
                    elder_id, album_item_id, media_url, album_date, location, story,
                    tags_json, item_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
            `, [
                elderId,
                stableItemId('album', item, index),
                stringOrNull(item.url || item.imageUrl || item.mediaUrl),
                stringOrNull(item.date),
                stringOrNull(item.location),
                stringOrNull(item.story),
                JSON.stringify(Array.isArray(item.tags) ? item.tags : []),
                JSON.stringify(serializeObject(item)),
                updatedAt,
            ]);
        }
    }

    async #replaceUiCommands(elderId, commands, updatedAt, client) {
        await client.query('DELETE FROM elder_ui_commands WHERE elder_id = $1', [elderId]);
        for (const [index, command] of toArray(commands).entries()) {
            const timestampMs = Number(command.timestamp);
            await client.query(`
                INSERT INTO elder_ui_commands (
                    elder_id, command_id, command_type, timestamp_ms, payload_json, command_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
            `, [
                elderId,
                stableItemId('ui', command, index),
                stringOrNull(command.type),
                Number.isFinite(timestampMs) ? Math.trunc(timestampMs) : Date.now(),
                JSON.stringify(command.payload || {}),
                JSON.stringify(serializeObject(command)),
                updatedAt,
            ]);
        }
    }

    async #replaceOutboundEvents(elderId, outboundEvents, updatedAt, client) {
        await client.query('DELETE FROM elder_outbound_events WHERE elder_id = $1', [elderId]);
        for (const [index, outbound] of toArray(outboundEvents).entries()) {
            await client.query(`
                INSERT INTO elder_outbound_events (
                    elder_id, outbound_id, audience, channel, purpose, message, targets_json,
                    metadata_json, results_json, occurred_at, outbound_json, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11::jsonb, $12)
            `, [
                elderId,
                stableItemId('outbound', outbound, index),
                stringOrNull(outbound.audience),
                stringOrNull(outbound.channel),
                stringOrNull(outbound.purpose),
                stringOrNull(outbound.message),
                JSON.stringify(Array.isArray(outbound.targets) ? outbound.targets : []),
                JSON.stringify(outbound.metadata || {}),
                JSON.stringify(Array.isArray(outbound.results) ? outbound.results : []),
                timestampOrNull(outbound.timestamp) || updatedAt,
                JSON.stringify(serializeObject(outbound)),
                updatedAt,
            ]);
        }
    }

    async #withTransaction(task) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await task(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // Preserve the original transaction failure.
            }
            throw error;
        } finally {
            client.release();
        }
    }
}

function normalizeElderId(value) {
    const elderId = String(value || '').trim();
    if (!elderId) throw new HttpError(400, 'elderId is required.', 'invalid_elder_id');
    if (!isValidElderId(elderId)) {
        throw new HttpError(400, 'elderId must match /^[a-zA-Z0-9_-]{1,120}$/.', 'invalid_elder_id');
    }
    return elderId;
}

function isValidElderId(value) {
    return /^[a-zA-Z0-9_-]{1,120}$/.test(String(value || ''));
}

function normalizeMediaType(value) {
    const mediaType = String(value || '').trim();
    if (!mediaType) throw new HttpError(400, 'Media type is required.', 'invalid_media_type');
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(mediaType)) {
        throw new HttpError(400, 'Media type must match /^[a-zA-Z0-9_-]{1,80}$/.', 'invalid_media_type');
    }
    return mediaType;
}

function normalizeMediaId(mediaId) {
    const normalized = String(mediaId || '').trim().replace(/^\/+/, '');
    if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) {
        throw new HttpError(404, 'Media not found.', 'media_not_found');
    }
    return normalized;
}

function decodeBase64Content(value) {
    const normalized = value.includes(',') ? value.slice(value.lastIndexOf(',') + 1) : value;
    const cleaned = normalized.replace(/\s+/g, '');
    if (!cleaned || cleaned.length % 4 === 1 || !/^[a-zA-Z0-9+/=]+$/.test(cleaned)) {
        throw new HttpError(400, 'contentBase64 must be valid base64 data.', 'invalid_content');
    }
    try {
        return Buffer.from(cleaned, 'base64');
    } catch {
        throw new HttpError(400, 'contentBase64 must be valid base64 data.', 'invalid_content');
    }
}

function resolveExtension(filename, mimeType) {
    const safeExt = path.extname(filename).trim().toLowerCase();
    if (safeExt && /^[.][a-z0-9]{1,10}$/.test(safeExt)) return safeExt;
    const byMimeType = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'audio/webm': '.webm',
        'video/mp4': '.mp4',
        'text/plain': '.txt',
        'application/json': '.json',
    };
    return byMimeType[mimeType] || '.bin';
}

function stableItemId(prefix, value, index) {
    const source = serializeObject(value);
    if (source.id) return String(source.id);
    const hash = crypto
        .createHash('sha1')
        .update(JSON.stringify(source))
        .digest('hex')
        .slice(0, 12);
    return `${prefix}_${index}_${hash}`;
}

function toArray(value) {
    return Array.isArray(value) ? value : [];
}

function serializeObject(value) {
    if (value === undefined || value === null) return {};
    return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text ? text : null;
}

function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function integerOrNull(value) {
    const number = numberOrNull(value);
    return number == null ? null : Math.trunc(number);
}

function booleanOrNull(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
}

function timestampOrNull(value) {
    const iso = toIsoTimestamp(value);
    return iso || null;
}

function toIsoTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function dateOrNull(value) {
    if (!value) return null;
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
}

function parseJson(value) {
    if (!value) return {};
    if (typeof value === 'string') return JSON.parse(value);
    return value;
}

function parsePostgresSsl(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'false' || normalized === '0') return undefined;
    if (normalized === 'true' || normalized === '1') return { rejectUnauthorized: false };
    return undefined;
}

function redactConnectionString(value) {
    try {
        const url = new URL(value);
        if (url.password) url.password = '***';
        if (url.username) url.username = '***';
        return url.toString();
    } catch {
        return 'configured';
    }
}
