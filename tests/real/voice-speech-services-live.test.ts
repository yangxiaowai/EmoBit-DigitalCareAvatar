/**
 * 真实服务联调测试：FunASR 语音识别 WebSocket、IndexTTS2 语音克隆 WebSocket。
 * 默认不执行；需本地已启动对应服务后设置环境变量：
 *   VITEST_REAL_SERVICES=1 npm run test:functional:live
 */
import { describe, expect, it } from 'vitest';

const RUN_LIVE = process.env.VITEST_REAL_SERVICES === '1';

function funAsrWsUrl(): string {
  return process.env.VITE_FUNASR_WS_URL || 'ws://127.0.0.1:10095';
}

/** FunASR 服务端 MIN_AUDIO_SIZE 默认 8000 字节；发送略大于阈值的静音 PCM（Int16） */
const SILENCE_PCM_BYTES = 16_000;

function funAsrPipelineOnce(url: string): Promise<{
  startToReadyMs: number;
  stopToFinalMs: number;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const tid = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error('FunASR 联调超时（请确认 funasr_server 已启动且地址正确）'));
    }, 180_000);

    let tOpen = 0;
    let tReady = 0;
    let tStopSent = 0;
    let gotFinal = false;

    ws.onerror = () => {
      clearTimeout(tid);
      reject(new Error('FunASR WebSocket 连接失败'));
    };

    ws.onopen = () => {
      tOpen = performance.now();
      ws.send(JSON.stringify({ type: 'start' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));

        if (data.type === 'ready' && tReady === 0) {
          tReady = performance.now();
          const samples = SILENCE_PCM_BYTES / 2;
          const pcm = new Int16Array(samples);
          ws.send(pcm.buffer);
          tStopSent = performance.now();
          ws.send(JSON.stringify({ type: 'stop', is_speaking: false }));
        }

        if (data.is_final === true && !gotFinal) {
          gotFinal = true;
          const tFinal = performance.now();
          clearTimeout(tid);
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          const startToReadyMs = Math.round(tReady - tOpen);
          const stopToFinalMs = Math.round(tFinal - tStopSent);
          console.log(`REAL_FUNASR_start_to_ready_ms=${startToReadyMs}`);
          console.log(`REAL_FUNASR_stop_to_final_ms=${stopToFinalMs}`);
          resolve({ startToReadyMs, stopToFinalMs });
        }
      } catch (e) {
        clearTimeout(tid);
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
  });
}

describe.skipIf(!RUN_LIVE)('真实服务联调（FunASR + 语音克隆）', { timeout: 240_000 }, () => {
  it('FunASR：WebSocket 会话就绪与一次静音帧识别闭环时延', async () => {
    const url = funAsrWsUrl();
    const { startToReadyMs, stopToFinalMs } = await funAsrPipelineOnce(url);

    expect(startToReadyMs).toBeGreaterThanOrEqual(0);
    expect(startToReadyMs).toBeLessThan(60_000);
    expect(stopToFinalMs).toBeGreaterThanOrEqual(0);
    expect(stopToFinalMs).toBeLessThan(180_000);
  });

  it('语音克隆：WebSocket 可达与 check_status 模型就绪状态往返时延', async () => {
    const { voiceCloneService } = await import('../../services/voiceCloneService');

    const tConn0 = performance.now();
    const ok = await voiceCloneService.checkConnection();
    const tConn1 = performance.now();
    const checkConnectionMs = Math.round(tConn1 - tConn0);
    console.log(`REAL_VOICE_CLONE_check_connection_ms=${checkConnectionMs}`);
    expect(ok).toBe(true);

    const tSt0 = performance.now();
    const status = await voiceCloneService.checkStatus();
    const tSt1 = performance.now();
    const checkStatusMs = Math.round(tSt1 - tSt0);
    console.log(`REAL_VOICE_CLONE_check_status_roundtrip_ms=${checkStatusMs}`);

    expect(status.hasModel).toBe(true);
    expect(status.modelReady).toBe(true);
    expect(checkStatusMs).toBeGreaterThanOrEqual(0);
    expect(checkStatusMs).toBeLessThan(60_000);
  });
});
