import type { MedicationReminder } from '../../services/medicationService';
import type { SundowningRiskSnapshot } from '../../services/sundowningService';
import type { WanderingState } from '../../services/wanderingService';
import { SimulationType, SystemStatus } from '../../types';
import type { LogEntry } from '../../types';
import type { ScenarioElderAction, ScenarioElderMessage, ScenarioEvent, ScenarioHydratableState } from './scenarioEvents';

export const APP_SHELL_STORAGE_KEY = 'emobit_app_shell_v1';
const MAX_LOG_COUNT = 50;
const APP_STATE_VERSION = 1;

export interface AppState extends ScenarioHydratableState {
  version: number;
  hydrationSource: 'default' | 'local' | 'backend';
}

export type AppAction =
  | { type: 'event.ingested'; event: ScenarioEvent }
  | { type: 'state.replaced'; state: AppState };

export function createDefaultAppState(): AppState {
  return {
    version: APP_STATE_VERSION,
    hydrationSource: 'default',
    activeView: 'dashboard',
    simulation: SimulationType.NONE,
    logs: [],
    systemStatus: SystemStatus.NORMAL,
    elderMessage: null,
    elderAction: null,
    wanderingState: null,
    medicationReminder: null,
    sundowningSnapshot: null,
    lastEventTraceId: null,
    lastUpdatedAt: Date.now(),
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  if (action.type === 'state.replaced') {
    return action.state;
  }

  return reduceScenarioEvent(state, action.event);
}

export function toHydratableAppState(state: AppState): ScenarioHydratableState {
  return {
    activeView: state.activeView,
    simulation: state.simulation,
    logs: state.logs.slice(0, MAX_LOG_COUNT),
    systemStatus: state.systemStatus,
    elderMessage: state.elderMessage,
    elderAction: state.elderAction,
    wanderingState: state.wanderingState,
    medicationReminder: state.medicationReminder,
    sundowningSnapshot: state.sundowningSnapshot,
    lastEventTraceId: state.lastEventTraceId,
    lastUpdatedAt: state.lastUpdatedAt,
  };
}

export function persistAppState(state: AppState): void {
  if (typeof window === 'undefined') return;

  try {
    const payload = {
      version: APP_STATE_VERSION,
      hydrationSource: state.hydrationSource,
      ...toHydratableAppState(state),
    };
    window.localStorage.setItem(APP_SHELL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore local persistence failures and keep the UI functional.
  }
}

export function loadPersistedAppState(): AppState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(APP_SHELL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return restorePersistedAppState(parsed);
  } catch {
    return null;
  }
}

export function restorePersistedAppState(value: unknown): AppState | null {
  if (!isRecord(value)) return null;

  const state = createDefaultAppState();
  const restored = coerceHydratableState(value);
  if (!restored) return null;

  return {
    ...state,
    ...restored,
    version: APP_STATE_VERSION,
    hydrationSource: 'local',
  };
}

function reduceScenarioEvent(state: AppState, event: ScenarioEvent): AppState {
  const next: AppState = {
    ...state,
    lastEventTraceId: event.traceId,
    lastUpdatedAt: event.timestamp,
  };

  switch (event.type) {
    case 'demo.simulation.requested': {
      next.simulation = event.payload.simulation;
      next.systemStatus = deriveSystemStatus(next);
      return next;
    }

    case 'system.reset': {
      next.simulation = SimulationType.NONE;
      next.elderMessage = null;
      next.elderAction = null;
      next.medicationReminder = null;
      next.wanderingState = null;
      next.systemStatus = deriveSystemStatus(next);
      next.logs = appendLog(next.logs, {
        module: 'SYSTEM',
        message: '系统重置。监控已激活。',
        level: 'info',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'view.switch.requested': {
      next.activeView = event.payload.view;
      return next;
    }

    case 'system.status.updated': {
      next.systemStatus = event.payload.status;
      return next;
    }

    case 'system.log.added': {
      next.logs = appendLog(next.logs, event.payload.log, event.timestamp, event.traceId);
      return next;
    }

    case 'bridge.outbound.recorded': {
      next.logs = appendLog(next.logs, {
        module: 'OPENCLAW',
        message: event.payload.ignored
          ? `已忽略误投到老人前端的家属通知记录（${event.payload.purpose}）`
          : `已执行通知动作（${event.payload.purpose}/${event.payload.channel})${event.payload.targets.length > 0 ? ` → ${event.payload.targets.join(',')}` : ''}`,
        level: event.payload.ignored ? 'warn' : 'success',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'family.message.sent': {
      next.elderMessage = event.payload.message;
      next.logs = appendLog(next.logs, {
        module: 'OPENCLAW',
        message: `已将老人沟通文案回写到前端（${event.payload.message.purpose || 'general'}）`,
        level: 'info',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'elder.action.confirmed': {
      next.elderAction = event.payload.action;
      next.logs = appendLog(next.logs, {
        module: 'OPENCLAW',
        message: `已下发家属联动动作（${event.payload.action.action}）`,
        level: 'info',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'wandering.detected': {
      next.wanderingState = event.payload.state;
      next.systemStatus = deriveSystemStatus(next);
      next.logs = appendLog(next.logs, {
        module: 'DBSCAN',
        message: `检测到游走风险：${getWanderingLabel(event.payload.state)}。置信度 ${Math.round((event.payload.state.confidence || 0) * 100)}%。`,
        level: 'warn',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'wandering.resolved': {
      next.wanderingState = event.payload.state;
      next.systemStatus = deriveSystemStatus(next);
      next.logs = appendLog(next.logs, {
        module: 'DBSCAN',
        message: '游走风险已解除，定位已恢复稳定。',
        level: 'success',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'medication.reminder.triggered': {
      next.medicationReminder = event.payload.reminder;
      next.systemStatus = deriveSystemStatus(next);
      next.logs = appendLog(next.logs, {
        module: 'MEDICATION',
        message: `已触发用药提醒：${event.payload.medicationName}（${event.payload.scheduledTime}）。`,
        level: 'info',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'medication.confirmed': {
      next.medicationReminder = null;
      next.systemStatus = deriveSystemStatus(next);
      next.logs = appendLog(next.logs, {
        module: 'MEDICATION',
        message: `已确认服药：${event.payload.medicationName}。`,
        level: 'success',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'medication.snoozed': {
      next.medicationReminder = event.payload.reminder;
      next.systemStatus = deriveSystemStatus(next);
      next.logs = appendLog(next.logs, {
        module: 'MEDICATION',
        message: `用药提醒已延后：${event.payload.medicationName}。`,
        level: 'warn',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'sundowning.risk.updated': {
      const previousLevel = state.sundowningSnapshot?.riskLevel;
      next.sundowningSnapshot = event.payload.snapshot;
      next.systemStatus = deriveSystemStatus(next);
      if (previousLevel !== event.payload.snapshot.riskLevel) {
        next.logs = appendLog(next.logs, {
          module: 'SUNDOWNING',
          message: `黄昏风险更新为${getRiskLabel(event.payload.snapshot.riskLevel)}，指数 ${event.payload.snapshot.riskScore}。`,
          level: event.payload.snapshot.riskLevel === 'high' ? 'warn' : 'info',
        }, event.timestamp, event.traceId);
      }
      return next;
    }

    case 'sundowning.intervention.started': {
      next.systemStatus = next.systemStatus === SystemStatus.CRITICAL ? SystemStatus.CRITICAL : SystemStatus.WARNING;
      next.logs = appendLog(next.logs, {
        module: 'SUNDOWNING',
        message: `已启动主动干预：${event.payload.plan.title}。`,
        level: 'warn',
      }, event.timestamp, event.traceId);
      return next;
    }

    case 'state.rehydrated': {
      const hydrated = coerceHydratableState(event.payload.state);
      if (!hydrated) return next;

      const shouldOverrideShell = state.hydrationSource === 'default';
      next.hydrationSource = event.payload.from === 'backend' ? 'backend' : 'local';
      next.wanderingState = hydrated.wanderingState ?? next.wanderingState;
      next.medicationReminder = hydrated.medicationReminder ?? next.medicationReminder;
      next.sundowningSnapshot = hydrated.sundowningSnapshot ?? next.sundowningSnapshot;
      next.lastUpdatedAt = hydrated.lastUpdatedAt ?? next.lastUpdatedAt;
      next.lastEventTraceId = hydrated.lastEventTraceId ?? next.lastEventTraceId;

      if (shouldOverrideShell) {
        next.activeView = hydrated.activeView ?? next.activeView;
        next.simulation = hydrated.simulation ?? next.simulation;
        next.systemStatus = hydrated.systemStatus ?? next.systemStatus;
        next.elderMessage = hydrated.elderMessage ?? next.elderMessage;
        next.elderAction = hydrated.elderAction ?? next.elderAction;
      }

      if (hydrated.logs && state.logs.length === 0) {
        next.logs = hydrated.logs;
      }

      next.systemStatus = deriveSystemStatus(next);
      return next;
    }

    default:
      return next;
  }
}

function deriveSystemStatus(state: Pick<AppState, 'simulation' | 'wanderingState' | 'sundowningSnapshot'>): SystemStatus {
  if (state.simulation === SimulationType.FALL) {
    return SystemStatus.CRITICAL;
  }

  if (state.wanderingState?.isWandering) {
    return SystemStatus.WARNING;
  }

  if (state.simulation === SimulationType.WANDERING || state.simulation === SimulationType.SUNDOWNING) {
    return SystemStatus.WARNING;
  }

  if (state.sundowningSnapshot?.riskLevel === 'high') {
    return SystemStatus.WARNING;
  }

  return SystemStatus.NORMAL;
}

function appendLog(
  current: LogEntry[],
  input: Pick<LogEntry, 'module' | 'message' | 'level'>,
  timestamp: number,
  traceId: string,
): LogEntry[] {
  const next: LogEntry = {
    id: `log_${traceId}_${timestamp}_${current.length}`,
    timestamp: formatLogClock(timestamp),
    module: input.module,
    message: input.message,
    level: input.level,
  };

  return [next, ...current].slice(0, MAX_LOG_COUNT);
}

function coerceHydratableState(value: unknown): Partial<ScenarioHydratableState> | null {
  if (!isRecord(value)) return null;

  const next: Partial<ScenarioHydratableState> = {};

  if (value.activeView === 'dashboard' || value.activeView === 'app') {
    next.activeView = value.activeView;
  }

  if (isSimulationType(value.simulation)) {
    next.simulation = value.simulation;
  }

  if (isSystemStatus(value.systemStatus)) {
    next.systemStatus = value.systemStatus;
  }

  if (Array.isArray(value.logs)) {
    next.logs = value.logs
      .filter((item): item is LogEntry => isRecord(item) && typeof item.module === 'string' && typeof item.message === 'string' && isLogLevel(item.level))
      .slice(0, MAX_LOG_COUNT)
      .map((item, index) => ({
        id: typeof item.id === 'string' ? item.id : `restored_log_${index}`,
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : formatLogClock(Date.now()),
        module: item.module,
        message: item.message,
        level: item.level,
      }));
  }

  if (isRecord(value.elderMessage) && typeof value.elderMessage.id === 'string' && typeof value.elderMessage.text === 'string') {
    next.elderMessage = value.elderMessage as ScenarioElderMessage;
  }

  if (isRecord(value.elderAction) && typeof value.elderAction.id === 'string' && typeof value.elderAction.action === 'string') {
    next.elderAction = value.elderAction as ScenarioElderAction;
  }

  if (isRecord(value.wanderingState)) {
    next.wanderingState = value.wanderingState as WanderingState;
  }

  if (isRecord(value.medicationReminder)) {
    next.medicationReminder = value.medicationReminder as MedicationReminder;
  }

  if (isRecord(value.sundowningSnapshot)) {
    next.sundowningSnapshot = value.sundowningSnapshot as SundowningRiskSnapshot;
  }

  if (typeof value.lastEventTraceId === 'string') {
    next.lastEventTraceId = value.lastEventTraceId;
  }

  if (typeof value.lastUpdatedAt === 'number' && Number.isFinite(value.lastUpdatedAt)) {
    next.lastUpdatedAt = value.lastUpdatedAt;
  } else if (typeof value.lastUpdatedAt === 'string') {
    const parsed = new Date(value.lastUpdatedAt).getTime();
    if (Number.isFinite(parsed)) {
      next.lastUpdatedAt = parsed;
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

function formatLogClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
  });
}

function getWanderingLabel(state: WanderingState): string {
  if (state.wanderingType === 'lost') return '疑似走失';
  if (state.wanderingType === 'circling') return '异常打转';
  if (state.wanderingType === 'pacing') return '反复踱步';
  return '轨迹异常';
}

function getRiskLabel(level: SundowningRiskSnapshot['riskLevel']): string {
  if (level === 'high') return '高风险';
  if (level === 'medium') return '中风险';
  return '低风险';
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

function isLogLevel(value: unknown): value is LogEntry['level'] {
  return value === 'info' || value === 'warn' || value === 'error' || value === 'success';
}
