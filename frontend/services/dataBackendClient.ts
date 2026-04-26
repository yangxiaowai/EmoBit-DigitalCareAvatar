import { getDataBackendBaseUrl } from '../utils/runtimeConfig';
import type { MedicationReminder } from './medicationService';
import type { SundowningRiskSnapshot } from './sundowningService';
import type { WanderingState } from './wanderingService';
import { SimulationType, SystemStatus } from '../types';
import type { ScenarioElderAction, ScenarioElderMessage, ScenarioHydratableState } from '../core/scenarioEvents';

export function buildDataBackendUrl(pathname: string): string {
  const baseUrl = getDataBackendBaseUrl();
  const url = new URL(pathname, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  return url.toString();
}

export async function dataBackendFetch(pathname: string, init?: RequestInit): Promise<Response> {
  return fetch(buildDataBackendUrl(pathname), init);
}

interface DataBackendEnvelope<T> {
  ok?: boolean;
  elder?: T;
  state?: T;
}

interface DataBackendElderState {
  appShell?: {
    activeView?: ScenarioHydratableState['activeView'];
    simulation?: SimulationType;
    systemStatus?: SystemStatus;
    elderMessage?: ScenarioElderMessage | null;
    elderAction?: ScenarioElderAction | null;
    updatedAt?: string | number;
  };
  wandering?: {
    state?: WanderingState | null;
  };
  activeReminder?: MedicationReminder | null;
  sundowning?: {
    snapshot?: SundowningRiskSnapshot | null;
  };
}

export async function fetchElderStateFromDataBackend(elderId: string): Promise<DataBackendElderState | null> {
  try {
    const response = await dataBackendFetch(`/api/elder?elderId=${encodeURIComponent(elderId)}`);
    if (!response.ok) return null;
    const json = await response.json() as DataBackendEnvelope<DataBackendElderState>;
    return json.elder || json.state || null;
  } catch {
    return null;
  }
}

export async function restoreAppShellFromDataBackend(elderId: string): Promise<Partial<ScenarioHydratableState> | null> {
  const elder = await fetchElderStateFromDataBackend(elderId);
  if (!elder) return null;

  const restored: Partial<ScenarioHydratableState> = {};
  const appShell = isRecord(elder.appShell) ? elder.appShell : null;

  if (appShell?.activeView === 'dashboard' || appShell?.activeView === 'app') {
    restored.activeView = appShell.activeView;
  }

  if (isSimulationType(appShell?.simulation)) {
    restored.simulation = appShell.simulation;
  }

  if (isSystemStatus(appShell?.systemStatus)) {
    restored.systemStatus = appShell.systemStatus;
  }

  if (isRecord(appShell?.elderMessage) && typeof appShell.elderMessage.id === 'string' && typeof appShell.elderMessage.text === 'string') {
    restored.elderMessage = appShell.elderMessage as ScenarioElderMessage;
  }

  if (isRecord(appShell?.elderAction) && typeof appShell.elderAction.id === 'string' && typeof appShell.elderAction.action === 'string') {
    restored.elderAction = appShell.elderAction as ScenarioElderAction;
  }

  if (typeof appShell?.updatedAt === 'number') {
    restored.lastUpdatedAt = appShell.updatedAt;
  } else if (typeof appShell?.updatedAt === 'string') {
    const parsed = new Date(appShell.updatedAt).getTime();
    if (Number.isFinite(parsed)) {
      restored.lastUpdatedAt = parsed;
    }
  }

  if (isRecord(elder.wandering) && isRecord(elder.wandering.state)) {
    restored.wanderingState = elder.wandering.state as WanderingState;
  }

  if (isRecord(elder.activeReminder)) {
    restored.medicationReminder = elder.activeReminder as MedicationReminder;
  }

  if (isRecord(elder.sundowning) && isRecord(elder.sundowning.snapshot)) {
    restored.sundowningSnapshot = elder.sundowning.snapshot as SundowningRiskSnapshot;
  }

  return Object.keys(restored).length > 0 ? restored : null;
}

export async function syncAppShellState(elderId: string, state: ScenarioHydratableState): Promise<boolean> {
  try {
    const response = await dataBackendFetch('/api/elder/state/appShell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        elderId,
        payload: {
          version: 1,
          updatedAt: new Date(state.lastUpdatedAt || Date.now()).toISOString(),
          activeView: state.activeView,
          simulation: state.simulation,
          systemStatus: state.systemStatus,
          elderMessage: state.elderMessage,
          elderAction: state.elderAction,
        },
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSimulationType(value: unknown): value is SimulationType {
  return typeof value === 'string' && Object.values(SimulationType).includes(value as SimulationType);
}

function isSystemStatus(value: unknown): value is SystemStatus {
  return typeof value === 'string' && Object.values(SystemStatus).includes(value as SystemStatus);
}
