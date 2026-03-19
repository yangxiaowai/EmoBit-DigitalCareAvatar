---
name: elder-care-orchestrator
description: Handle wandering, medication escalation, daily caregiver reports, and sundowning interventions for the EmoBit elderly-care system.
metadata: {"openclaw":{"homepage":"https://docs.openclaw.ai"}}
---

# EmoBit Elder-Care Orchestrator

Use this skill whenever the conversation or a webhook/cron message is about EmoBit elderly care.

Available EmoBit tools:
- `emobit_get_wandering_context`
- `emobit_get_medication_context`
- `emobit_get_daily_report_context`
- `emobit_get_sundowning_context`
- `emobit_get_care_plan_context`
- `emobit_get_trends_context`
- `emobit_get_family_control_context`
- `emobit_notify_guardians`
- `emobit_notify_elder`
- `emobit_place_guardian_call`
- `emobit_control_elder_frontend`

General rules:
- Prefer short, calm, plain-language messages for the elder.
- Prefer concise, actionable summaries for guardians.
- Do not give medical diagnosis. Escalate, remind, summarize, and recommend human follow-up.
- Avoid duplicate alerts. Check the `recentOutbound` and escalation hints from the context tools first.

## Wandering / Lost flow

1. Call `emobit_get_wandering_context`.
2. If an Android node is available and you need fresher location, use the built-in `location_get` tool.
3. If the elder is outside the safe zone or already marked `lost`, send a reassurance message with `emobit_notify_elder`.
4. Notify guardians with `emobit_notify_guardians` when `guardianNotifiedRecently` is false.
5. If `distanceFromHome` is large, `wanderingType` is `lost`, or the event repeats and `voiceCallRecently` is false, place a call with `emobit_place_guardian_call`.
6. Mention nearby memory anchors only if they help re-orient the elder.

## Medication flow

1. Call `emobit_get_medication_context`.
2. Focus on `dueItems`.
3. For each overdue dose:
   - If `elderNotifiedRecently` is false, remind the elder first with `emobit_notify_elder`.
   - If overdue is significant or `guardianNotifiedRecently` is false after a missed confirmation window, notify guardians with `emobit_notify_guardians`.
   - If the dose is seriously overdue and `voiceCallRecently` is false, place a guardian call.
4. When messaging guardians, include medication name, scheduled time, and overdue minutes.

## Daily report flow

1. Call `emobit_get_daily_report_context`.
2. If `reportAlreadySentToday` is true, do not send a duplicate report unless explicitly asked.
3. Summarize:
   - health metrics and alerts,
   - medication adherence,
   - cognitive interaction trend,
   - sundowning risk if relevant.
4. Send one caregiver-facing summary with `emobit_notify_guardians` using purpose `daily_report`.

## Care-plan / Reminder flow

1. Call `emobit_get_care_plan_context`.
2. Focus on `upcomingItems` and recent `carePlan.events`.
3. For medication / hydration / sleep / follow-up reminders:
   - use `emobit_control_elder_frontend` when you want the avatar to speak, open the album, show medication, or start breathing guidance;
   - use `emobit_notify_guardians` only when a family-facing summary or escalation is needed.
4. Prefer calm, short instructions for the elder and structured summaries for guardians.

## Family control flow

1. When a guardian replies in Feishu asking the avatar to act, call `emobit_control_elder_frontend`.
2. Valid actions include `speak_text`, `open_memory_album`, `show_medication`, `show_care_plan`, and `start_breathing`.
3. If needed, call `emobit_get_trends_context` first so the action matches the current risk and reminder state.

## Trends flow

1. Call `emobit_get_trends_context`.
2. Summarize cognition, medication adherence, sundowning peaks, face-recognition anomalies, and location automation.
3. Use the trend context to decide whether to send a daily family summary, escalate a risk, or trigger a frontend action for the elder.

## Sundowning / Proactive support flow

1. Call `emobit_get_sundowning_context`.
2. If risk is medium or high, send a calm reassurance to the elder with `emobit_notify_elder`.
3. Notify guardians when risk is high and `guardianNotifiedRecently` is false.
4. If risk stays high, repeated, or safety concerns are obvious and `voiceCallRecently` is false, place a guardian call.
5. Keep the message non-confrontational and reassuring.
