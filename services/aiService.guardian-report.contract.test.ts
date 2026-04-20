import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./openclawSyncService', () => ({
  openclawSyncService: {
    syncProfile: vi.fn(),
    syncMedications: vi.fn(),
    syncMedicationLogs: vi.fn(),
    syncMedicationEvent: vi.fn(),
  },
}));

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal(
    'localStorage',
    {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => void store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage
  );
}

describe('aiService guardian report contract', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
    // 强制走本地分支，避免受 .env 中真实模型 Key 影响导致网络调用超时
    vi.stubEnv('VITE_GROQ_API_KEY', '');
    vi.stubEnv('VITE_LLM_API_KEY', '');
    vi.stubEnv('VITE_SPARK_API_KEY', '');
    vi.stubEnv('VITE_TONGYI_API_KEY', '');
    vi.stubEnv('VITE_DEEPSEEK_API_KEY', '');
    vi.stubEnv('VITE_KIMI_API_KEY', '');
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('本地结构化评分稳定输出：风险等级与告警由本地算法决定', async () => {
    const { aiService } = await import('./aiService');
    aiService.setApiKey('');
    const report = await aiService.generateGuardianDailyReport(
      { bpm: 112, pressure: '142/90', sleep: 5.5 },
      []
    );

    expect(report.structured.riskLevel).toBe('high');
    expect(report.structured.score).toBeLessThan(90);
    expect(report.structured.alerts.join('|')).toContain('心率');
    expect(report.structured.alerts.join('|')).toContain('血压');
    expect(report.narrative).toContain('## 今日关键结论');
  });

  it('云端文案生成时，提示词包含本地结构化评分基线', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '## 今日关键结论\n\n整体良好。' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { aiService } = await import('./aiService');
    aiService.setApiKey('test-groq-key');

    const report = await aiService.generateGuardianDailyReport(
      { bpm: 78, pressure: '126/82', sleep: 7.2 },
      []
    );
    expect(report.structured.riskLevel).toBe('low');

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const userPrompt = body.messages.find((m: { role: string }) => m.role === 'user')?.content || '';
    expect(userPrompt).toContain('本地结构化评分结果');
    expect(userPrompt).toContain('"riskLevel"');
    expect(userPrompt).toContain('"indicators"');
  });
});

