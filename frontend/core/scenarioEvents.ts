import type { MedicationReminder } from '../services/medicationService';
import type { SundowningInterventionPlan, SundowningRiskSnapshot } from '../services/sundowningService';
import type { WanderingState } from '../services/wanderingService';
import { SimulationType, SystemStatus } from '../types';
import type { LogEntry } from '../types';

export type AppView = 'dashboard' | 'app';

export type ScenarioSource =
  | 'demo'
  | 'service.wandering'
  | 'service.medication'
  | 'service.sundowning'
  | 'bridge'
  | 'system'
  | 'persistence.local'
  | 'persistence.backend';

export interface ScenarioElderMessage {
  id: string;
  text: string;
  purpose?: string;
  timestamp?: number;
}

export interface ScenarioElderAction {
  id: string;
  action: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
}

export interface ScenarioHydratableState {
  activeView: AppView;
  simulation: SimulationType;
  logs: LogEntry[];
  systemStatus: SystemStatus;
  elderMessage: ScenarioElderMessage | null;
  elderAction: ScenarioElderAction | null;
  wanderingState: WanderingState | null;
  medicationReminder: MedicationReminder | null;
  sundowningSnapshot: SundowningRiskSnapshot | null;
  lastEventTraceId: string | null;
  lastUpdatedAt: number;
}

export interface ScenarioEventPayloadMap {
  'wandering.detected': {
    state: WanderingState;
    originalType: string;
  };
  'wandering.resolved': {
    state: WanderingState;
    originalType: string;
  };
  'medication.reminder.triggered': {
    medicationId: string;
    medicationName: string;
    scheduledTime: string;
    reminder: MedicationReminder | null;
  };
  'medication.confirmed': {
    medicationId: string;
    medicationName: string;
    scheduledTime: string;
  };
  'medication.snoozed': {
    medicationId: string;
    medicationName: string;
    scheduledTime: string;
    reminder: MedicationReminder | null;
  };
  'sundowning.risk.updated': {
    snapshot: SundowningRiskSnapshot;
  };
  'sundowning.intervention.started': {
    plan: SundowningInterventionPlan;
  };
  'family.message.sent': {
    message: ScenarioElderMessage;
  };
  'elder.action.confirmed': {
    action: ScenarioElderAction;
  };
  'system.reset': {
    reason?: string;
  };
  'view.switch.requested': {
    view: AppView;
  };
  'system.status.updated': {
    status: SystemStatus;
  };
  'system.log.added': {
    log: Pick<LogEntry, 'module' | 'message' | 'level'>;
  };
  'bridge.outbound.recorded': {
    purpose: string;
    channel: string;
    audience: string;
    message: string;
    targets: string[];
    ignored: boolean;
  };
  'demo.simulation.requested': {
    simulation: SimulationType;
  };
  'state.rehydrated': {
    state: Partial<ScenarioHydratableState>;
    from: 'local' | 'backend';
  };
}

export type ScenarioEventType = keyof ScenarioEventPayloadMap;

export interface ScenarioEvent<T extends ScenarioEventType = ScenarioEventType> {
  type: T;
  source: ScenarioSource;
  timestamp: number;
  payload: ScenarioEventPayloadMap[T];
  traceId: string;
}

export function buildTraceId(prefix = 'scenario'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createScenarioEvent<T extends ScenarioEventType>(input: {
  type: T;
  source: ScenarioSource;
  payload: ScenarioEventPayloadMap[T];
  timestamp?: number;
  traceId?: string;
}): ScenarioEvent<T> {
  return {
    type: input.type,
    source: input.source,
    timestamp: typeof input.timestamp === 'number' ? input.timestamp : Date.now(),
    payload: input.payload,
    traceId: input.traceId || buildTraceId(input.type.replace(/[^a-z0-9]+/gi, '_')),
  };
}
