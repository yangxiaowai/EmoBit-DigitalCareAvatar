import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createDataServer } from '../backend/data-server/server.mjs';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ysAAAAASUVORK5CYII=';

async function main() {
  const startedAt = new Date().toISOString();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'emobit-api-perf-'));
  const artifactDir = path.join(process.cwd(), 'docs', 'test-artifacts');
  const legacyStatePath = path.join(tempRoot, 'legacy-state.json');

  await fs.writeFile(
    legacyStatePath,
    JSON.stringify({
      elders: {
        elder_demo: {
          profile: { name: '张爷爷' },
          health: { metrics: { heartRate: 72, bloodOxygen: 98 } },
        },
      },
    }),
    'utf8',
  );

  const { server, store } = createDataServer({
    rootDir: path.join(tempRoot, 'data'),
    legacyStatePath,
  });
  await store.initialize();

  try {
    await listen(server);
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const results = {
      startedAt,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        baseUrl,
      },
      apiTests: [],
      loadTests: [],
    };

    const healthz = await requestCase('健康检查', `${baseUrl}/healthz`);
    ensure(healthz.status === 200 && healthz.json?.ok === true, '健康检查失败');
    results.apiTests.push({
      name: 'GET /healthz',
      expected: '返回 200，ok=true',
      actual: {
        status: healthz.status,
        ok: healthz.json?.ok,
        durationMs: healthz.durationMs,
      },
      passed: true,
    });

    const elderBefore = await requestCase('老人档案查询', `${baseUrl}/api/elder?elderId=elder_demo`);
    ensure(elderBefore.status === 200, '老人档案查询失败');
    results.apiTests.push({
      name: 'GET /api/elder?elderId=elder_demo',
      expected: '返回 200，返回默认老人画像',
      actual: {
        status: elderBefore.status,
        profileName: elderBefore.json?.elder?.profile?.name,
        durationMs: elderBefore.durationMs,
      },
      passed: true,
    });

    const healthUpdate = await requestCase('健康状态写入', `${baseUrl}/api/elder/state/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId: 'elder_demo',
        payload: {
          metrics: {
            heartRate: 79,
            bloodOxygen: 97,
            sleepHours: 7.2,
            steps: 2510,
          },
          alerts: [{ id: 'alert-1', level: 'warn', message: '夜间步数偏低' }],
        },
      }),
    });
    ensure(healthUpdate.status === 200, '健康状态写入失败');
    results.apiTests.push({
      name: 'POST /api/elder/state/health',
      expected: '返回 200，心率更新为 79',
      actual: {
        status: healthUpdate.status,
        heartRate: healthUpdate.json?.elder?.health?.metrics?.heartRate,
        durationMs: healthUpdate.durationMs,
      },
      passed: healthUpdate.json?.elder?.health?.metrics?.heartRate === 79,
    });

    const eventWrite = await requestCase('事件写入', `${baseUrl}/api/elder/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId: 'elder_demo',
        type: 'simulation.fall',
        severity: 'critical',
        payload: { gForce: 3.2, source: 'api-perf-script' },
      }),
    });
    ensure(eventWrite.status === 200, '事件写入失败');
    results.apiTests.push({
      name: 'POST /api/elder/events',
      expected: '返回 200，新增跌倒事件',
      actual: {
        status: eventWrite.status,
        eventType: eventWrite.json?.event?.type,
        durationMs: eventWrite.durationMs,
      },
      passed: eventWrite.json?.event?.type === 'simulation.fall',
    });

    const mediaUpload = await requestCase('媒体上传', `${baseUrl}/api/media/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId: 'elder_demo',
        type: 'faces',
        filename: 'face.png',
        mimeType: 'image/png',
        contentBase64: PNG_BASE64,
      }),
    });
    ensure(mediaUpload.status === 200, '媒体上传失败');
    const mediaPath = new URL(mediaUpload.json.url).pathname;
    const mediaRead = await requestCase('媒体回读', `${baseUrl}${mediaPath}`);
    ensure(mediaRead.status === 200, '媒体回读失败');
    results.apiTests.push({
      name: 'POST /api/media/upload + GET /media/*',
      expected: '上传成功并可回读，content-type=image/png',
      actual: {
        uploadStatus: mediaUpload.status,
        readStatus: mediaRead.status,
        contentType: mediaRead.headers['content-type'],
        bodyBytes: mediaRead.bodyBytes,
        uploadDurationMs: mediaUpload.durationMs,
        readDurationMs: mediaRead.durationMs,
      },
      passed: mediaRead.headers['content-type'] === 'image/png',
    });

    const invalidSection = await requestCase('非法 section', `${baseUrl}/api/elder/state/unknown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elderId: 'elder_demo',
        payload: {},
      }),
    });
    ensure(invalidSection.status === 400, '非法 section 未返回 400');
    results.apiTests.push({
      name: 'POST /api/elder/state/unknown',
      expected: '返回 400，提示 Unsupported state section',
      actual: {
        status: invalidSection.status,
        error: invalidSection.json?.error,
        durationMs: invalidSection.durationMs,
      },
      passed: String(invalidSection.json?.error || '').includes('Unsupported state section'),
    });

    const healthLoad = await runLoad({
      name: 'GET /healthz 压力测试',
      totalRequests: 200,
      concurrency: 20,
      taskFactory: (index) => () =>
        requestCase(`healthz-${index}`, `${baseUrl}/healthz`, { expectJson: true }),
    });
    results.loadTests.push(healthLoad);

    const eventLoad = await runLoad({
      name: 'POST /api/elder/events 并发压力测试',
      totalRequests: 100,
      concurrency: 10,
      taskFactory: (index) => () =>
        requestCase(`event-${index}`, `${baseUrl}/api/elder/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            elderId: 'elder_load',
            type: `pressure.event_${index}`,
            severity: 'info',
            payload: { index },
          }),
        }),
    });

    const elderAfterLoad = await requestCase('压测后查询', `${baseUrl}/api/elder?elderId=elder_load`);
    const eventCount = Array.isArray(elderAfterLoad.json?.elder?.events)
      ? elderAfterLoad.json.elder.events.length
      : 0;
    eventLoad.dataIntegrity = {
      expectedEventCount: 100,
      actualEventCount: eventCount,
      passed: eventCount === 100,
    };
    results.loadTests.push(eventLoad);

    await fs.mkdir(artifactDir, { recursive: true });
    const artifactPath = path.join(artifactDir, 'data-server-api-perf-results.json');
    await fs.writeFile(artifactPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');

    console.log(JSON.stringify({ ...results, artifactPath }, null, 2));
  } finally {
    await closeServer(server);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function requestCase(name, url, options = {}) {
  const requestOptions = {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  };

  const started = performance.now();
  const response = await fetch(url, requestOptions);
  const durationMs = round(performance.now() - started);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const text = contentType.includes('json') || contentType.includes('text')
    ? buffer.toString('utf8')
    : '';
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    name,
    status: response.status,
    ok: response.ok,
    durationMs,
    json,
    text,
    bodyBytes: buffer.byteLength,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

async function runLoad({ name, totalRequests, concurrency, taskFactory }) {
  const durations = [];
  let successCount = 0;
  let failureCount = 0;
  const started = performance.now();
  let cursor = 0;

  async function worker() {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= totalRequests) {
        return;
      }

      const result = await taskFactory(current)();
      durations.push(result.durationMs);
      if (result.status >= 200 && result.status < 300) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => worker()),
  );

  const elapsedMs = round(performance.now() - started);
  return {
    name,
    totalRequests,
    concurrency,
    elapsedMs,
    successCount,
    failureCount,
    successRate: round((successCount / totalRequests) * 100, 2),
    avgMs: round(average(durations)),
    p95Ms: percentile(durations, 95),
    maxMs: round(Math.max(...durations)),
    minMs: round(Math.min(...durations)),
    throughputRps: round((totalRequests / elapsedMs) * 1000, 2),
  };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return round(sorted[index] ?? 0);
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

main().catch((error) => {
  console.error('[data-server-api-perf-test] failed:', error);
  process.exitCode = 1;
});
