import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DataStore } from './store.mjs';
import { createDataServer } from './server.mjs';
import { SqliteDataStore } from './sqliteStore.mjs';

describe('backend/data-server', () => {
    let tempRoot: string;

    beforeEach(async () => {
        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'emobit-data-server-'));
    });

    afterEach(async () => {
        if (tempRoot) {
            await fs.rm(tempRoot, { recursive: true, force: true });
        }
    });

    it('returns a normalized elder shape and can bootstrap from legacy state', async () => {
        const legacyStatePath = path.join(tempRoot, 'legacy-state.json');
        await fs.writeFile(legacyStatePath, JSON.stringify({
            elders: {
                elder_demo: {
                    profile: { name: '张爷爷' },
                    health: { metrics: { heartRate: 72 } },
                },
            },
        }), 'utf8');

        const store = new DataStore({
            rootDir: path.join(tempRoot, 'data'),
            legacyStatePath,
        });

        await store.initialize();
        const elder = await store.getElder('elder_demo');

        expect(elder.profile).toMatchObject({ name: '张爷爷' });
        expect(elder.health.metrics).toMatchObject({ heartRate: 72 });
        expect(elder.faces).toEqual([]);
        expect(elder.timeAlbum).toEqual([]);
        expect(elder.uiCommands).toEqual([]);
        expect(elder.outbound).toEqual([]);
    });

    it('serializes same-elder concurrent writes without losing sections or events', async () => {
        const store = new DataStore({
            rootDir: path.join(tempRoot, 'data'),
            legacyStatePath: path.join(tempRoot, 'missing-legacy.json'),
        });

        await store.initialize();

        await Promise.all([
            store.updateSection('elder_demo', 'health', {
                metrics: { heartRate: 81 },
                alerts: [{ id: 'alert-1', level: 'warn' }],
            }),
            store.updateSection('elder_demo', 'care-plan', {
                items: [{ id: 'care-1', title: '散步', enabled: true, time: '08:00' }],
                events: [],
                trend: { adherence: 90 },
            }),
            store.appendEvent('elder_demo', {
                type: 'simulation.fall',
                severity: 'critical',
                payload: { gForce: 3.4 },
            }),
            store.appendEvent('elder_demo', {
                type: 'face.known',
                severity: 'info',
                payload: { id: 'face-1', name: '儿子' },
            }),
        ]);

        const elder = await store.getElder('elder_demo');
        const eventLog = await store.readEventLog('elder_demo');

        expect(elder.health.metrics).toMatchObject({ heartRate: 81 });
        expect(elder.carePlan.items).toHaveLength(1);
        expect(elder.events).toHaveLength(2);
        expect(elder.faceEvents[0]).toMatchObject({ id: 'face-1', name: '儿子', eventType: 'face.known' });
        expect(eventLog).toHaveLength(2);
        expect(new Set(eventLog.map((event) => event.type))).toEqual(new Set(['simulation.fall', 'face.known']));
    });

    it('supports append/upsert collection operations for faces without concurrent lost writes', async () => {
        const store = new DataStore({
            rootDir: path.join(tempRoot, 'data'),
            legacyStatePath: path.join(tempRoot, 'missing-legacy.json'),
        });

        await store.initialize();

        await Promise.all(
            Array.from({ length: 12 }, (_, index) =>
                store.updateSection('elder_demo', 'faces', {
                    op: 'append',
                    item: {
                        id: `face-${index}`,
                        name: `家人${index}`,
                        relation: '家人',
                        imageUrl: `/media/elder_demo/faces/face-${index}.png`,
                        createdAt: Date.now() + index,
                    },
                }),
            ),
        );

        await store.updateSection('elder_demo', 'faces', {
            op: 'upsertById',
            item: {
                id: 'face-3',
                name: '家人3-更新',
                relation: '家人',
                imageUrl: '/media/elder_demo/faces/face-3-updated.png',
                createdAt: Date.now(),
            },
        });

        const elder = await store.getElder('elder_demo');

        expect(elder.faces).toHaveLength(12);
        expect(elder.faces.find((item) => item.id === 'face-3')).toMatchObject({
            name: '家人3-更新',
            imageUrl: '/media/elder_demo/faces/face-3-updated.png',
        });
    });

    it('serves elder APIs and uploaded media over the request handler', async () => {
        const { server } = createDataServer({
            rootDir: path.join(tempRoot, 'data'),
            legacyStatePath: path.join(tempRoot, 'missing-legacy.json'),
        });
        const handler = server.listeners('request')[0];

        const healthzResponse = await dispatch(handler, {
            method: 'GET',
            url: '/healthz',
        });
        expect(healthzResponse.statusCode).toBe(200);
        expect(healthzResponse.json).toMatchObject({
            ok: true,
            service: 'emobit-data-server',
        });

        const elderResponse = await dispatch(handler, {
            method: 'GET',
            url: '/api/elder?elderId=elder_demo',
        });
        expect(elderResponse.statusCode).toBe(200);
        expect(elderResponse.json.elder.faces).toEqual([]);

        const stateResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/elder/state/timeAlbum',
            body: {
                elderId: 'elder_demo',
                payload: {
                    op: 'append',
                    item: {
                        id: 'album-1',
                        url: '/media/demo.png',
                        date: '2026-03-23',
                        location: '北京',
                        story: '一家人的回忆',
                        tags: ['家庭'],
                    },
                },
            },
        });
        expect(stateResponse.statusCode).toBe(200);

        const eventResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/elder/events',
            body: {
                elderId: 'elder_demo',
                type: 'cognitive.report',
                severity: 'info',
                payload: {
                    id: 'report-1',
                    summary: '今天状态稳定',
                },
            },
        });
        expect(eventResponse.statusCode).toBe(200);
        expect(eventResponse.json.event.type).toBe('cognitive.report');

        const uploadResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/media/upload',
            body: {
                elderId: 'elder_demo',
                type: 'faces',
                filename: 'face.png',
                mimeType: 'image/png',
                contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ysAAAAASUVORK5CYII=',
            },
        });
        expect(uploadResponse.statusCode).toBe(200);
        expect(uploadResponse.json.url).toContain('/media/elder_demo/faces/');

        const mediaPath = new URL(uploadResponse.json.url).pathname;
        const mediaResponse = await dispatch(handler, {
            method: 'GET',
            url: mediaPath,
        });
        expect(mediaResponse.statusCode).toBe(200);
        expect(mediaResponse.headers['content-type']).toBe('image/png');
        expect(mediaResponse.body.length).toBeGreaterThan(0);

        const updatedElderResponse = await dispatch(handler, {
            method: 'GET',
            url: '/api/elder?elderId=elder_demo',
        });
        expect(updatedElderResponse.json.elder.timeAlbum).toHaveLength(1);
        expect(updatedElderResponse.json.elder.cognitive.reports).toHaveLength(1);
    });

    it('serves bridge-compatible state, events, contexts, ui commands, and outbound record APIs', async () => {
        const { server } = createDataServer({
            rootDir: path.join(tempRoot, 'data'),
            legacyStatePath: path.join(tempRoot, 'missing-legacy.json'),
        });
        const handler = server.listeners('request')[0];

        const stateWriteResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/state/care-plan',
            body: {
                elderId: 'elder_demo',
                payload: {
                    items: [{ id: 'walk', title: '散步', enabled: true, time: '08:30' }],
                    events: [],
                    trend: { adherence: 95 },
                },
            },
        });
        expect(stateWriteResponse.statusCode).toBe(200);
        expect(stateWriteResponse.json.state.carePlan.items).toHaveLength(1);

        const eventResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/events',
            body: {
                elderId: 'elder_demo',
                type: 'sundowning.alert',
                severity: 'warn',
                payload: { id: 'sun-1', level: 'medium', riskScore: 62 },
            },
        });
        expect(eventResponse.statusCode).toBe(200);
        expect(eventResponse.json.event.type).toBe('sundowning.alert');

        const commandResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/ui/commands',
            body: {
                elderId: 'elder_demo',
                command: {
                    type: 'elder.action',
                    timestamp: 1774770000000,
                    payload: { action: 'open_memory_album' },
                },
            },
        });
        expect(commandResponse.statusCode).toBe(200);

        const commandsResponse = await dispatch(handler, {
            method: 'GET',
            url: '/api/ui/commands?elderId=elder_demo&since=1774760000000',
        });
        expect(commandsResponse.statusCode).toBe(200);
        expect(commandsResponse.json.commands).toHaveLength(1);
        expect(commandsResponse.json.commands[0].type).toBe('elder.action');

        const outboundResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/outbound/record',
            body: {
                elderId: 'elder_demo',
                audience: 'guardians',
                channel: 'frontend',
                targets: ['ui:guardian'],
                message: '今日照护报告已生成',
                purpose: 'daily_report',
                metadata: { source: 'test' },
            },
        });
        expect(outboundResponse.statusCode).toBe(200);
        expect(outboundResponse.json.state.outboundEvents[0]).toMatchObject({
            audience: 'guardians',
            purpose: 'daily_report',
        });

        const stateReadResponse = await dispatch(handler, {
            method: 'GET',
            url: '/api/state?elderId=elder_demo',
        });
        expect(stateReadResponse.statusCode).toBe(200);
        expect(stateReadResponse.json.state.carePlan.trend).toMatchObject({ adherence: 95 });

        const contextResponse = await dispatch(handler, {
            method: 'GET',
            url: '/api/context/daily-report?elderId=elder_demo',
        });
        expect(contextResponse.statusCode).toBe(200);
        expect(contextResponse.json.contextType).toBe('daily-report');
        expect(contextResponse.json.context.carePlan.upcomingItems[0]).toMatchObject({ id: 'walk' });
        expect(contextResponse.json.context.reportAlreadySentToday).toBe(true);

        const eventListResponse = await dispatch(handler, {
            method: 'GET',
            url: '/api/elder/events?elderId=elder_demo&type=sundowning&limit=10',
        });
        expect(eventListResponse.statusCode).toBe(200);
        expect(eventListResponse.json.events).toHaveLength(1);
        expect(eventListResponse.json.events[0].type).toBe('sundowning.alert');

        const eldersResponse = await dispatch(handler, {
            method: 'GET',
            url: '/api/elders',
        });
        expect(eldersResponse.statusCode).toBe(200);
        expect(eldersResponse.json.elderIds).toContain('elder_demo');
    });

    it('supports domain shortcut write APIs', async () => {
        const { server } = createDataServer({
            rootDir: path.join(tempRoot, 'data'),
            legacyStatePath: path.join(tempRoot, 'missing-legacy.json'),
        });
        const handler = server.listeners('request')[0];

        const logResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/elder/medication/logs',
            body: {
                elderId: 'elder_demo',
                medicationId: 'med_1',
                medicationName: '盐酸奥司他韦',
                scheduledTime: '08:00',
                status: 'taken',
            },
        });
        expect(logResponse.statusCode).toBe(200);
        expect(logResponse.json.state.medicationLogs[0]).toMatchObject({
            medicationId: 'med_1',
            status: 'taken',
        });

        const conversationResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/elder/cognitive/conversations',
            body: {
                elderId: 'elder_demo',
                conversation: {
                    id: 'conv-1',
                    userMessage: '今天吃药了吗？',
                    aiResponse: '已经提醒您了。',
                    sentiment: 'neutral',
                },
            },
        });
        expect(conversationResponse.statusCode).toBe(200);
        expect(conversationResponse.json.state.cognitive.conversations[0]).toMatchObject({ id: 'conv-1' });

        const assessmentResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/elder/cognitive/assessments',
            body: {
                elderId: 'elder_demo',
                assessment: {
                    id: 'assess-1',
                    score: 1,
                    maxScore: 5,
                },
            },
        });
        expect(assessmentResponse.statusCode).toBe(200);
        expect(assessmentResponse.json.event.severity).toBe('warn');

        const careEventResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/elder/care-plan/events',
            body: {
                elderId: 'elder_demo',
                event: {
                    id: 'care-event-1',
                    type: 'reminder_triggered',
                    itemId: 'walk',
                },
            },
        });
        expect(careEventResponse.statusCode).toBe(200);
        expect(careEventResponse.json.event.type).toBe('care.reminder_triggered');
        expect(careEventResponse.json.event.severity).toBe('warn');
    });

    it('persists elder state, events, and media metadata in SQLite with JSON bootstrap migration', async () => {
        const rootDir = path.join(tempRoot, 'sqlite-data');
        await fs.mkdir(path.join(rootDir, 'elders'), { recursive: true });
        await fs.writeFile(path.join(rootDir, 'elders', 'elder_demo.json'), JSON.stringify({
            profile: { name: '张爷爷' },
            medications: [{ id: 'med_1', name: '二甲双胍', times: ['08:00'] }],
        }), 'utf8');

        const store = new SqliteDataStore({
            rootDir,
            legacyStatePath: path.join(tempRoot, 'missing-legacy.json'),
        });

        await store.initialize();
        const migrated = await store.getElder('elder_demo');
        expect(migrated.profile).toMatchObject({ name: '张爷爷' });
        expect(await store.listElders()).toContain('elder_demo');

        await store.updateSection('elder_demo', 'health', {
            metrics: { heartRate: 76 },
            alerts: [],
        });
        const { event } = await store.appendEvent('elder_demo', {
            type: 'medication.reminder',
            severity: 'warn',
            payload: {
                medicationId: 'med_1',
                reminder: { medicationId: 'med_1', scheduledTime: '08:00' },
            },
        });
        expect(event.type).toBe('medication.reminder');

        const eventLog = await store.readEventLog('elder_demo');
        expect(eventLog).toHaveLength(1);
        expect(eventLog[0].type).toBe('medication.reminder');

        const upload = await store.uploadMedia({
            elderId: 'elder_demo',
            type: 'faces',
            filename: 'face.png',
            mimeType: 'image/png',
            contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ysAAAAASUVORK5CYII=',
        }, 'http://127.0.0.1:4328');
        expect(upload.mediaId).toContain('elder_demo/faces/');
        await fs.access(store.resolveMediaPath(upload.mediaId));

        const db = store.db;
        const schemaRows = db.prepare('SELECT version FROM schema_migrations').all();
        const eventRows = db.prepare('SELECT elder_id AS elderId, type FROM events').all();
        const mediaRows = db.prepare('SELECT elder_id AS elderId, media_id AS mediaId FROM media').all();
        expect(schemaRows.map((row: any) => row.version)).toContain(1);
        expect(eventRows[0]).toMatchObject({ elderId: 'elder_demo', type: 'medication.reminder' });
        expect(mediaRows[0].mediaId).toBe(upload.mediaId);
        store.close();
    });

    it('returns 400 for unsupported sections and invalid uploads', async () => {
        const { server } = createDataServer({
            rootDir: path.join(tempRoot, 'data'),
            legacyStatePath: path.join(tempRoot, 'missing-legacy.json'),
        });
        const handler = server.listeners('request')[0];

        const badSectionResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/elder/state/unknown',
            body: {
                elderId: 'elder_demo',
                payload: {},
            },
        });
        expect(badSectionResponse.statusCode).toBe(400);
        expect(badSectionResponse.json.error).toContain('Unsupported state section');

        const badUploadResponse = await dispatch(handler, {
            method: 'POST',
            url: '/api/media/upload',
            body: {
                elderId: 'elder_demo',
                type: 'faces',
                filename: 'broken.png',
                mimeType: 'image/png',
                contentBase64: 'not-valid-base64',
            },
        });
        expect(badUploadResponse.statusCode).toBe(400);
        expect(badUploadResponse.json.code).toBe('invalid_content');
    });
});

async function dispatch(handler: any, options: {
    method: string;
    url: string;
    body?: unknown;
    headers?: Record<string, string>;
}) {
    const bodyText = options.body === undefined ? '' : JSON.stringify(options.body);
    const req = Readable.from(bodyText ? [Buffer.from(bodyText)] : []);
    Object.assign(req, {
        method: options.method,
        url: options.url,
        headers: {
            host: '127.0.0.1:4328',
            ...(bodyText ? { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(bodyText)) } : {}),
            ...(options.headers || {}),
        },
    });

    let resolved = false;
    const headers = {} as Record<string, string>;
    const chunks: Buffer[] = [];

    const response = {
        statusCode: 200,
        setHeader(name: string, value: string) {
            headers[name.toLowerCase()] = String(value);
        },
        writeHead(statusCode: number, extraHeaders?: Record<string, string>) {
            this.statusCode = statusCode;
            for (const [name, value] of Object.entries(extraHeaders || {})) {
                headers[name.toLowerCase()] = String(value);
            }
            return this;
        },
        end(chunk?: Buffer | string) {
            if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            resolved = true;
        },
    };

    await handler(req, response);
    if (!resolved) {
        response.end();
    }

    const body = Buffer.concat(chunks);
    const contentType = headers['content-type'] || '';
    return {
        statusCode: response.statusCode,
        headers,
        body,
        json: contentType.includes('application/json') ? JSON.parse(body.toString('utf8') || '{}') : null,
    };
}
