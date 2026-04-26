import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

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

export class SqliteDataStore {
    constructor(options = {}) {
        this.rootDir = options.rootDir || path.join(process.cwd(), 'backend', 'data-server', 'data');
        this.eldersDir = options.eldersDir || path.join(this.rootDir, 'elders');
        this.eventsDir = options.eventsDir || path.join(this.rootDir, 'events');
        this.uploadsDir = options.uploadsDir || path.join(this.rootDir, 'uploads');
        this.dbPath = options.dbPath || path.join(this.rootDir, 'emobit-data.sqlite');
        this.legacyStatePath = options.legacyStatePath || path.join(process.cwd(), 'openclaw', 'bridge', 'data', 'state.json');
        this.defaultElderId = options.defaultElderId || DEFAULT_ELDER_ID;
        this.publicBaseUrl = options.publicBaseUrl || '';
        this.writeQueues = new Map();
        this.db = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        await fs.mkdir(this.rootDir, { recursive: true });
        await fs.mkdir(this.eldersDir, { recursive: true });
        await fs.mkdir(this.eventsDir, { recursive: true });
        await fs.mkdir(this.uploadsDir, { recursive: true });

        this.db = new DatabaseSync(this.dbPath);
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec('PRAGMA foreign_keys = ON');
        this.db.exec('PRAGMA busy_timeout = 5000');
        this.#migrateSchema();
        await this.#bootstrapFromFileStores();
        this.initialized = true;
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;
        }
    }

    async listElders() {
        await this.initialize();
        return this.db
            .prepare('SELECT elder_id AS elderId FROM elder_state ORDER BY elder_id')
            .all()
            .map((row) => row.elderId);
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
        return this.#withWriteQueue(normalizedElderId, async () => {
            const elder = await this.#readOrBootstrapElder(normalizedElderId);
            try {
                applyStateUpdate(elder, key, payload);
            } catch (error) {
                if (error instanceof HttpError) throw error;
                throw new HttpError(400, error instanceof Error ? error.message : String(error), 'invalid_section');
            }
            elder.updatedAt = new Date().toISOString();
            this.#writeElder(normalizedElderId, elder);
            return ensureElderShape(elder);
        });
    }

    async appendEvent(elderId, input) {
        await this.initialize();
        const normalizedElderId = normalizeElderId(elderId);
        return this.#withWriteQueue(normalizedElderId, async () => {
            const elder = await this.#readOrBootstrapElder(normalizedElderId);
            const event = ingestEvent(elder, input);
            elder.updatedAt = new Date().toISOString();
            this.#writeElder(normalizedElderId, elder);
            this.#insertEvent(normalizedElderId, event);
            await this.#appendLegacyEventLog(normalizedElderId, event);
            return {
                elder: ensureElderShape(elder),
                event,
            };
        });
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

        this.db.prepare(`
            INSERT INTO media (media_id, elder_id, type, filename, mime_type, size_bytes, relative_path, url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(media_id) DO UPDATE SET
                filename = excluded.filename,
                mime_type = excluded.mime_type,
                size_bytes = excluded.size_bytes,
                relative_path = excluded.relative_path,
                url = excluded.url
        `).run(mediaId, elderId, mediaType, filename, mimeType, buffer.byteLength, relativePath, url, createdAt);

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
        return this.db.prepare(`
            SELECT event_json AS eventJson
            FROM events
            WHERE elder_id = ?
            ORDER BY id ASC
        `).all(normalizedElderId).map((row) => JSON.parse(row.eventJson));
    }

    #migrateSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS elder_state (
                elder_id TEXT PRIMARY KEY,
                updated_at TEXT NOT NULL,
                state_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                elder_id TEXT NOT NULL,
                type TEXT NOT NULL,
                severity TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                source TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                event_json TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_events_elder_id ON events(elder_id);
            CREATE INDEX IF NOT EXISTS idx_events_elder_timestamp ON events(elder_id, timestamp_ms);
            CREATE INDEX IF NOT EXISTS idx_events_elder_type ON events(elder_id, type);

            CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                media_id TEXT NOT NULL UNIQUE,
                elder_id TEXT NOT NULL,
                type TEXT NOT NULL,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                relative_path TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_media_elder_id ON media(elder_id);
            CREATE INDEX IF NOT EXISTS idx_media_elder_type ON media(elder_id, type);
        `);

        this.db.prepare(`
            INSERT OR IGNORE INTO schema_migrations (version, applied_at)
            VALUES (?, ?)
        `).run(SCHEMA_VERSION, new Date().toISOString());
    }

    async #bootstrapFromFileStores() {
        const imported = new Set();
        try {
            const entries = await fs.readdir(this.eldersDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
                const elderId = entry.name.replace(/\.json$/, '');
                if (!isValidElderId(elderId) || this.#hasElder(elderId)) continue;
                const content = await fs.readFile(path.join(this.eldersDir, entry.name), 'utf8');
                const elder = ensureElderShape(JSON.parse(content));
                this.#writeElder(elderId, elder);
                imported.add(elderId);
            }
        } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
        }

        try {
            const raw = await fs.readFile(this.legacyStatePath, 'utf8');
            const parsed = JSON.parse(raw);
            for (const [elderId, elder] of Object.entries(parsed?.elders || {})) {
                if (!isValidElderId(elderId) || this.#hasElder(elderId)) continue;
                this.#writeElder(elderId, ensureElderShape(elder));
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
                this.#insertEvent(elderId, normalizeEvent(JSON.parse(line)));
            }
        } catch (error) {
            if (!error || error.code !== 'ENOENT') throw error;
        }
    }

    async #readOrBootstrapElder(elderId) {
        const row = this.db
            .prepare('SELECT state_json AS stateJson FROM elder_state WHERE elder_id = ?')
            .get(elderId);
        if (row?.stateJson) return ensureElderShape(JSON.parse(row.stateJson));

        const elder = await this.#loadLegacyElder(elderId) || defaultElderState();
        this.#writeElder(elderId, elder);
        return ensureElderShape(elder);
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

    #writeElder(elderId, elder) {
        const normalized = ensureElderShape(elder);
        this.db.prepare(`
            INSERT INTO elder_state (elder_id, updated_at, state_json)
            VALUES (?, ?, ?)
            ON CONFLICT(elder_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                state_json = excluded.state_json
        `).run(elderId, normalized.updatedAt, JSON.stringify(normalized));
    }

    #insertEvent(elderId, event) {
        const normalized = normalizeEvent(event);
        const timestampMs = new Date(normalized.timestamp).getTime();
        this.db.prepare(`
            INSERT OR IGNORE INTO events (
                event_id, elder_id, type, severity, timestamp, timestamp_ms, source, payload_json, event_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            normalized.id,
            elderId,
            normalized.type,
            normalized.severity,
            normalized.timestamp,
            Number.isFinite(timestampMs) ? timestampMs : Date.now(),
            normalized.source,
            JSON.stringify(normalized.payload || {}),
            JSON.stringify(normalized),
        );
    }

    async #appendLegacyEventLog(elderId, event) {
        const filePath = path.join(this.eventsDir, `${elderId}.ndjson`);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.appendFile(filePath, `${JSON.stringify(normalizeEvent(event))}\n`, 'utf8');
    }

    #hasElder(elderId) {
        return Boolean(this.db.prepare('SELECT 1 FROM elder_state WHERE elder_id = ?').get(elderId));
    }

    async #withWriteQueue(elderId, task) {
        const previous = this.writeQueues.get(elderId) || Promise.resolve();
        const queued = previous.catch(() => undefined).then(task);
        this.writeQueues.set(elderId, queued);
        try {
            return await queued;
        } finally {
            if (this.writeQueues.get(elderId) === queued) {
                this.writeQueues.delete(elderId);
            }
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
