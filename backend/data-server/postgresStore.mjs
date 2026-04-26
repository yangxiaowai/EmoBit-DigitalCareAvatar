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
const SCHEMA_VERSION = 1;

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
        const result = await this.pool.query('SELECT elder_id AS "elderId" FROM elder_state ORDER BY elder_id');
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

            CREATE TABLE IF NOT EXISTS elder_state (
                elder_id TEXT PRIMARY KEY,
                updated_at TIMESTAMPTZ NOT NULL,
                state_json JSONB NOT NULL
            );

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
        await client.query(`
            INSERT INTO elder_state (elder_id, updated_at, state_json)
            VALUES ($1, $2, $3::jsonb)
            ON CONFLICT (elder_id) DO NOTHING
        `, [elderId, elder.updatedAt, JSON.stringify(ensureElderShape(elder))]);
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
