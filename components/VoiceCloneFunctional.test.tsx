import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('voice clone (functional)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('clones voice successfully with measurable latency', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-19T10:00:00.000Z'));

    vi.doMock('../services/voiceCloneService', () => {
      return {
        voiceCloneService: {
          checkConnection: vi.fn(async () => true),
          registerVoice: vi.fn(
            () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({
                    name: '爷爷声音样本A',
                    status: 'ready',
                  });
                }, 80);
              }),
          ),
          listVoices: vi.fn(async () => []),
        },
      };
    });

    const { VoiceService } = await import('../services/api');
    const startedAt = Date.now();
    const clonePromise = VoiceService.cloneVoice(new Blob(['mock-voice']), '爷爷声音样本A');

    await vi.advanceTimersByTimeAsync(80);
    const profile = await clonePromise;
    const cloneReadyLatencyMs = Date.now() - startedAt;
    console.log(`[VOICE-CLONE] clone_ready_latency_ms=${cloneReadyLatencyMs}`);

    expect(cloneReadyLatencyMs).toBe(80);
    expect(profile.status).toBe('ready');
    expect(profile.isCloned).toBe(true);
    expect(profile.id.startsWith('cloned_')).toBe(true);
    vi.useRealTimers();
  });

  it('falls back safely when clone service unavailable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.doMock('../services/voiceCloneService', () => {
      return {
        voiceCloneService: {
          checkConnection: vi.fn(async () => false),
          registerVoice: vi.fn(),
          listVoices: vi.fn(async () => []),
        },
      };
    });

    const { VoiceService } = await import('../services/api');
    const profile = await VoiceService.cloneVoice(new Blob(['mock-voice']), '回退验证');

    expect(profile.status).toBe('failed');
    expect(profile.isCloned).toBe(false);
    expect(profile.id).toBe('voice_xiaoxiao');

    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

