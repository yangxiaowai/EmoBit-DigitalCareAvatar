import type { ScenarioEvent } from './scenarioEvents';

export type ScenarioEventListener = (event: ScenarioEvent) => void;

export interface ScenarioEventBus {
  publish(event: ScenarioEvent): ScenarioEvent;
  subscribe(listener: ScenarioEventListener): () => void;
  getRecentEvents(limit?: number): ScenarioEvent[];
}

export function createScenarioEventBus(): ScenarioEventBus {
  const listeners = new Set<ScenarioEventListener>();
  const history: ScenarioEvent[] = [];

  return {
    publish(event) {
      history.unshift(event);
      if (history.length > 100) {
        history.pop();
      }

      listeners.forEach((listener) => {
        listener(event);
      });

      return event;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getRecentEvents(limit = 20) {
      return history.slice(0, limit);
    },
  };
}
