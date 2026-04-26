import { medicationService } from '../../services/medicationService';
import { sundowningService } from '../../services/sundowningService';
import { wanderingService } from '../../services/wanderingService';
import type { ScenarioEventBus } from '../eventBus';
import { createScenarioEvent } from '../scenarioEvents';

export function mountServiceAdapter(eventBus: ScenarioEventBus): () => void {
  const cleanups: Array<() => void> = [];

  if (typeof wanderingService.subscribe === 'function') {
    cleanups.push(wanderingService.subscribe((event) => {
      const isResolved = event.type === 'wandering_end' || event.type === 'returned_safe';
      eventBus.publish(createScenarioEvent({
        type: isResolved ? 'wandering.resolved' : 'wandering.detected',
        source: 'service.wandering',
        timestamp: event.timestamp.getTime(),
        payload: {
          state: event.state,
          originalType: event.type,
        },
      }));
    }));
  }

  if (typeof medicationService.subscribe === 'function') {
    cleanups.push(medicationService.subscribe((event) => {
      if (event.type === 'reminder') {
        eventBus.publish(createScenarioEvent({
          type: 'medication.reminder.triggered',
          source: 'service.medication',
          timestamp: event.timestamp.getTime(),
          payload: {
            medicationId: event.medication.id,
            medicationName: event.medication.name,
            scheduledTime: event.scheduledTime,
            reminder: typeof medicationService.getActiveReminder === 'function' ? medicationService.getActiveReminder() : null,
          },
        }));
        return;
      }

      if (event.type === 'taken') {
        eventBus.publish(createScenarioEvent({
          type: 'medication.confirmed',
          source: 'service.medication',
          timestamp: event.timestamp.getTime(),
          payload: {
            medicationId: event.medication.id,
            medicationName: event.medication.name,
            scheduledTime: event.scheduledTime,
          },
        }));
        return;
      }

      if (event.type === 'snooze') {
        eventBus.publish(createScenarioEvent({
          type: 'medication.snoozed',
          source: 'service.medication',
          timestamp: event.timestamp.getTime(),
          payload: {
            medicationId: event.medication.id,
            medicationName: event.medication.name,
            scheduledTime: event.scheduledTime,
            reminder: typeof medicationService.getActiveReminder === 'function' ? medicationService.getActiveReminder() : null,
          },
        }));
      }
    }));
  }

  if (typeof sundowningService.subscribe === 'function') {
    cleanups.push(sundowningService.subscribe((snapshot) => {
      eventBus.publish(createScenarioEvent({
        type: 'sundowning.risk.updated',
        source: 'service.sundowning',
        timestamp: snapshot.timestamp,
        payload: { snapshot },
      }));
    }));
  }

  if (typeof sundowningService.subscribeInterventions === 'function') {
    cleanups.push(sundowningService.subscribeInterventions((plan) => {
      if (!plan || plan.status !== 'running') return;
      eventBus.publish(createScenarioEvent({
        type: 'sundowning.intervention.started',
        source: 'service.sundowning',
        timestamp: plan.startedAt,
        payload: { plan },
      }));
    }));
  }

  const currentWanderingState = typeof wanderingService.getState === 'function' ? wanderingService.getState() : null;
  if (currentWanderingState?.isWandering) {
    eventBus.publish(createScenarioEvent({
      type: 'wandering.detected',
      source: 'service.wandering',
      payload: {
        state: currentWanderingState,
        originalType: 'snapshot',
      },
    }));
  }

  const activeReminder = typeof medicationService.getActiveReminder === 'function' ? medicationService.getActiveReminder() : null;
  if (activeReminder) {
    eventBus.publish(createScenarioEvent({
      type: 'medication.reminder.triggered',
      source: 'service.medication',
      payload: {
        medicationId: activeReminder.medication.id,
        medicationName: activeReminder.medication.name,
        scheduledTime: activeReminder.scheduledTime,
        reminder: activeReminder,
      },
    }));
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
