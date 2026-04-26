import { medicationService } from '../../services/medicationService';
import { openclawSyncService } from '../../services/openclawSyncService';
import { sundowningService } from '../../services/sundowningService';
import { wanderingService } from '../../services/wanderingService';
import { SimulationType } from '../../types';
import type { ScenarioEventBus } from '../eventBus';
import { createScenarioEvent } from '../scenarioEvents';
import type { AppView } from '../scenarioEvents';

export interface DemoAdapter {
  requestSimulation(simulation: SimulationType): void;
  requestViewSwitch(view: AppView): void;
  resetSystem(reason?: string): void;
  emitBootSequence(): () => void;
}

export function createDemoAdapter(eventBus: ScenarioEventBus): DemoAdapter {
  return {
    requestSimulation(simulation) {
      if (simulation === SimulationType.NONE) {
        this.resetSystem('manual-reset');
        return;
      }

      const traceId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      eventBus.publish(createScenarioEvent({
        type: 'demo.simulation.requested',
        source: 'demo',
        traceId,
        payload: { simulation },
      }));

      switch (simulation) {
        case SimulationType.WANDERING:
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'demo',
            traceId,
            payload: {
              log: {
                module: 'DBSCAN',
                message: '检测到地理位置聚类异常。用户偏离安全区 > 500m。',
                level: 'warn',
              },
            },
          }));
          wanderingService.simulateWandering('lost');
          break;
        case SimulationType.FALL:
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'demo',
            traceId,
            payload: {
              log: {
                module: 'ACCELEROMETER',
                message: '检测到Y轴急剧减速 (3.2g)。身体姿态异常。',
                level: 'error',
              },
            },
          }));
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'demo',
            traceId,
            payload: {
              log: {
                module: 'SYSTEM',
                message: '启动一级紧急响应协议。',
                level: 'error',
              },
            },
          }));
          openclawSyncService.emitScenarioSignal('simulation.fall', {
            gForce: 3.2,
            posture: 'abnormal',
            source: 'simulation',
            timestamp: new Date().toISOString(),
          }, 'critical');
          break;
        case SimulationType.MEDICATION:
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'demo',
            traceId,
            payload: {
              log: {
                module: 'CV_CAMERA',
                message: '检测到药盒交互。置信度: 98%。',
                level: 'success',
              },
            },
          }));
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'demo',
            traceId,
            payload: {
              log: {
                module: 'WATCH',
                message: '识别到“吞咽”手势。',
                level: 'success',
              },
            },
          }));
          medicationService.simulateReminder();
          break;
        case SimulationType.SUNDOWNING:
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'demo',
            traceId,
            payload: {
              log: {
                module: 'SUNDOWNING',
                message: '进入黄昏高风险时段，已启动主动干预策略。',
                level: 'warn',
              },
            },
          }));
          sundowningService.startSimulation();
          break;
        default:
          break;
      }
    },

    requestViewSwitch(view) {
      eventBus.publish(createScenarioEvent({
        type: 'view.switch.requested',
        source: 'demo',
        payload: { view },
      }));
    },

    resetSystem(reason = 'manual-reset') {
      sundowningService.stopSimulation();
      eventBus.publish(createScenarioEvent({
        type: 'system.reset',
        source: 'demo',
        payload: { reason },
      }));
    },

    emitBootSequence() {
      const timeouts = [
        window.setTimeout(() => {
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'system',
            payload: {
              log: {
                module: 'BOOT',
                message: '系统初始化完成。正在连接穿戴设备...',
                level: 'info',
              },
            },
          }));
        }, 0),
        window.setTimeout(() => {
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'system',
            payload: {
              log: {
                module: 'NETWORK',
                message: '5G 模组已连接。延迟: 12ms',
                level: 'success',
              },
            },
          }));
        }, 800),
        window.setTimeout(() => {
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'system',
            payload: {
              log: {
                module: 'AI_CORE',
                message: 'Gemini Nano 模型已加载至边缘端。',
                level: 'info',
              },
            },
          }));
        }, 1500),
        window.setTimeout(() => {
          eventBus.publish(createScenarioEvent({
            type: 'system.log.added',
            source: 'system',
            payload: {
              log: {
                module: 'SUNDOWNING',
                message: '黄昏守护引擎已启动。',
                level: 'info',
              },
            },
          }));
        }, 1800),
      ];

      return () => {
        timeouts.forEach((timeoutId) => {
          window.clearTimeout(timeoutId);
        });
      };
    },
  };
}
