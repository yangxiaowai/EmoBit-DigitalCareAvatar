import { restoreAppShellFromDataBackend } from '../../../services/dataBackendClient';
import { type LocalUiCommand, subscribeLocalUiCommands } from '../../../services/localUiCommandBus';
import { openclawSyncService } from '../../../services/openclawSyncService';
import { SystemStatus } from '../../../types';
import { isGuardianOnlyBridgeMessage } from '../../../utils/openclawMessageGuards';
import { getOpenClawBridgeBaseUrl } from '../../../utils/runtimeConfig';
import type { ScenarioEventBus } from '../eventBus';
import { createScenarioEvent } from '../scenarioEvents';
import type { AppView } from '../scenarioEvents';

const MAX_SEEN_COMMANDS = 200;

export function mountBridgeAdapter(eventBus: ScenarioEventBus): () => void {
  const seenCommandIds: string[] = [];
  const seenCommandSet = new Set<string>();
  let disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastUiCommandTs = 0;
  let failureCount = 0;
  let backoffUntil = 0;

  const rememberCommand = (command: Required<LocalUiCommand>): boolean => {
    const key = String(command.id || `${command.type}:${command.timestamp}`);
    if (seenCommandSet.has(key)) {
      return false;
    }

    seenCommandSet.add(key);
    seenCommandIds.push(key);
    if (seenCommandIds.length > MAX_SEEN_COMMANDS) {
      const expired = seenCommandIds.shift();
      if (expired) {
        seenCommandSet.delete(expired);
      }
    }
    return true;
  };

  const publishCommand = (command: Required<LocalUiCommand>) => {
    if (!rememberCommand(command)) return;

    const traceId = String(command.id || `bridge_${command.timestamp || Date.now()}`);
    const timestamp = typeof command.timestamp === 'number' ? command.timestamp : Date.now();

    switch (command.type) {
      case 'status.set': {
        const status = normalizeStatus(command.payload?.status);
        if (!status) return;
        eventBus.publish(createScenarioEvent({
          type: 'system.status.updated',
          source: 'bridge',
          traceId,
          timestamp,
          payload: { status },
        }));
        return;
      }

      case 'log.add': {
        eventBus.publish(createScenarioEvent({
          type: 'system.log.added',
          source: 'bridge',
          traceId,
          timestamp,
          payload: {
            log: {
              module: String(command.payload?.module || 'OPENCLAW'),
              message: String(command.payload?.message || '收到 OpenClaw 指令'),
              level: normalizeLogLevel(command.payload?.level),
            },
          },
        }));
        return;
      }

      case 'view.set': {
        const view = normalizeView(command.payload?.view);
        if (!view) return;
        eventBus.publish(createScenarioEvent({
          type: 'view.switch.requested',
          source: 'bridge',
          traceId,
          timestamp,
          payload: { view },
        }));
        return;
      }

      case 'outbound.recorded': {
        const purpose = String(command.payload?.purpose || 'general');
        const channel = String(command.payload?.channel || 'message');
        const audience = String(command.payload?.audience || '');
        const message = String(command.payload?.message || '').trim();
        const ignored = audience === 'elder'
          && channel === 'frontend'
          && isGuardianOnlyBridgeMessage({ text: message, purpose });

        eventBus.publish(createScenarioEvent({
          type: 'bridge.outbound.recorded',
          source: 'bridge',
          traceId,
          timestamp,
          payload: {
            purpose,
            channel,
            audience,
            message,
            targets: Array.isArray(command.payload?.targets)
              ? command.payload?.targets.map((target) => String(target))
              : [],
            ignored,
          },
        }));
        return;
      }

      case 'elder.message': {
        const text = String(command.payload?.message || '').trim();
        if (!text) return;
        const purpose = String(command.payload?.purpose || 'general');
        if (isGuardianOnlyBridgeMessage({ text, purpose })) {
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'bridge',
            traceId,
            timestamp,
            payload: {
              log: {
                module: 'OPENCLAW',
                message: `已拦截家属专属消息，未向老人端播报（${purpose}）`,
                level: 'warn',
              },
            },
          }));
          return;
        }

        eventBus.publish(createScenarioEvent({
          type: 'family.message.sent',
          source: 'bridge',
          traceId,
          timestamp,
          payload: {
            message: {
              id: String(command.id || `elder_${timestamp}`),
              text,
              purpose,
              timestamp,
            },
          },
        }));
        return;
      }

      case 'elder.action': {
        const action = String(command.payload?.action || '').trim();
        if (!action) return;
        eventBus.publish(createScenarioEvent({
          type: 'elder.action.confirmed',
          source: 'bridge',
          traceId,
          timestamp,
          payload: {
            action: {
              id: String(command.id || `elder_action_${timestamp}`),
              action,
              payload: command.payload || {},
              timestamp,
            },
          },
        }));
        return;
      }

      default:
        return;
    }
  };

  const unsubscribeLocal = subscribeLocalUiCommands((command) => {
    publishCommand(command);
  });

  void restoreAppShellFromDataBackend(openclawSyncService.getElderId()).then((restoredState) => {
    if (disposed || !restoredState) return;
    eventBus.publish(createScenarioEvent({
      type: 'state.rehydrated',
      source: 'persistence.backend',
      payload: {
        state: restoredState,
        from: 'backend',
      },
    }));
  });

  const enabled = openclawSyncService.isEnabled();
  const baseUrl = (openclawSyncService.getBaseUrl?.() || getOpenClawBridgeBaseUrl()).replace(/\/$/, '');
  const elderId = openclawSyncService.getElderId();

  if (enabled && baseUrl) {
    lastUiCommandTs = Date.now();
    const token = import.meta.env.VITE_OPENCLAW_BRIDGE_TOKEN as string | undefined;

    const poll = async () => {
      if (disposed || Date.now() < backoffUntil) {
        return;
      }

      try {
        const url = new URL('/api/ui/commands', baseUrl);
        url.searchParams.set('elderId', elderId);
        url.searchParams.set('since', String(lastUiCommandTs));
        const response = await fetch(url.toString(), {
          headers: {
            ...(token ? { 'x-emobit-bridge-token': token } : {}),
          },
        });
        if (!response.ok) return;

        const json = await response.json();
        const commands = Array.isArray(json.commands) ? json.commands : [];
        failureCount = 0;
        backoffUntil = 0;

        for (const command of commands.reverse()) {
          if (typeof command.timestamp === 'number') {
            lastUiCommandTs = Math.max(lastUiCommandTs, command.timestamp);
          }
          publishCommand({
            id: command.id,
            type: command.type,
            timestamp: typeof command.timestamp === 'number' ? command.timestamp : Date.now(),
            payload: command.payload || {},
          });
        }
      } catch {
        failureCount += 1;
        const backoffMs = Math.min(30000, 2000 * (2 ** (failureCount - 1)));
        backoffUntil = Date.now() + backoffMs;
      }
    };

    void poll();
    pollTimer = setInterval(() => {
      void poll();
    }, 2000);
  }

  return () => {
    disposed = true;
    unsubscribeLocal();
    if (pollTimer) {
      clearInterval(pollTimer);
    }
  };
}

function normalizeStatus(value: unknown): SystemStatus | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical') return SystemStatus.CRITICAL;
  if (normalized === 'warning') return SystemStatus.WARNING;
  if (normalized === 'normal') return SystemStatus.NORMAL;
  return null;
}

function normalizeView(value: unknown): AppView | null {
  return value === 'dashboard' || value === 'app' ? value : null;
}

function normalizeLogLevel(value: unknown): 'info' | 'warn' | 'error' | 'success' {
  if (value === 'warn' || value === 'error' || value === 'success') {
    return value;
  }
  return 'info';
}
