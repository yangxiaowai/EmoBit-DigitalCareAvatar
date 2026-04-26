export function buildContext(type, elder, now = new Date()) {
    switch (type) {
        case 'wandering':
            return buildWanderingContext(elder);
        case 'medication':
            return buildMedicationContext(elder, now);
        case 'daily-report':
            return buildDailyReportContext(elder, now);
        case 'sundowning':
            return buildSundowningContext(elder);
        case 'care-plan':
            return buildCarePlanContext(elder, now);
        case 'trends':
            return buildTrendsContext(elder, now);
        case 'family-control':
            return buildFamilyControlContext(elder, now);
        default:
            return null;
    }
}

function buildWanderingContext(elder) {
    const state = elder.wandering?.state || null;
    const lastKnownLocation = state?.lastKnownLocation || null;
    const nearbyMemoryAnchors = lastKnownLocation
        ? (elder.memoryAnchors || [])
            .map((anchor) => ({
                ...anchor,
                distanceMeters: Math.round(distanceMeters(
                    { latitude: lastKnownLocation.latitude, longitude: lastKnownLocation.longitude },
                    { latitude: anchor.location?.lat, longitude: anchor.location?.lng },
                )),
            }))
            .filter((anchor) => Number.isFinite(anchor.distanceMeters))
            .sort((a, b) => a.distanceMeters - b.distanceMeters)
            .slice(0, 5)
        : [];

    return {
        profile: elder.profile,
        wanderingState: state,
        recentWanderingEvents: (elder.wandering?.events || []).slice(0, 8),
        nearbyMemoryAnchors,
        safeZones: elder.wanderingConfig?.safeZones || [],
        homeLocation: elder.wanderingConfig?.homeLocation || null,
        recentOutbound: filterOutboundByPurpose(elder, ['wandering']).slice(0, 6),
        escalationHints: {
            guardianNotifiedRecently: hasRecentOutbound(elder, 'wandering', ['guardians'], 15),
            voiceCallRecently: hasRecentOutbound(elder, 'wandering', ['voicecall'], 30),
        },
    };
}

function buildMedicationContext(elder, now) {
    return {
        profile: elder.profile,
        medications: elder.medications || [],
        activeReminder: elder.activeReminder || null,
        dueItems: computeDueMedicationItems(elder, now),
        todayLogs: (elder.medicationLogs || []).filter((log) => log.date === formatLocalDate(now)),
        recentMedicationEvents: (elder.medicationEvents || []).slice(0, 10),
        recentOutbound: filterOutboundByPurpose(elder, ['medication']).slice(0, 10),
        adherence7d: computeMedicationAdherence(elder, 7, now),
    };
}

function buildDailyReportContext(elder, now) {
    const conversations = (elder.cognitive?.conversations || []).slice(0, 40);
    const positive = conversations.filter((item) => item.sentiment === 'positive').length;
    const negative = conversations.filter((item) => item.sentiment === 'negative').length;
    return {
        profile: elder.profile,
        health: elder.health,
        medication: {
            adherence7d: computeMedicationAdherence(elder, 7, now),
            logs7d: (elder.medicationLogs || []).slice(0, 40),
        },
        cognitive: {
            conversationCount: conversations.length,
            positive,
            negative,
            recentConversations: conversations,
        },
        sundowning: {
            snapshot: elder.sundowning?.snapshot || null,
            recentAlerts: (elder.sundowning?.alerts || []).slice(0, 8),
        },
        carePlan: {
            trend: elder.carePlan?.trend || null,
            upcomingItems: computeUpcomingCareItems(elder, now),
        },
        locationAutomation: {
            state: elder.locationAutomation?.state || null,
            recentEvents: (elder.locationAutomation?.events || []).slice(0, 6),
        },
        recentOutbound: filterOutboundByPurpose(elder, ['daily_report']).slice(0, 4),
        reportAlreadySentToday: hasRecentOutboundSinceStartOfDay(elder, 'daily_report', now),
    };
}

function buildSundowningContext(elder) {
    return {
        profile: elder.profile,
        snapshot: elder.sundowning?.snapshot || null,
        alerts: (elder.sundowning?.alerts || []).slice(0, 10),
        interventions: (elder.sundowning?.interventions || []).slice(0, 10),
        health: elder.health,
        recentOutbound: filterOutboundByPurpose(elder, ['sundowning']).slice(0, 8),
        escalationHints: {
            guardianNotifiedRecently: hasRecentOutbound(elder, 'sundowning', ['guardians'], 15),
            voiceCallRecently: hasRecentOutbound(elder, 'sundowning', ['voicecall'], 30),
        },
    };
}

function buildCarePlanContext(elder, now) {
    return {
        profile: elder.profile,
        carePlan: elder.carePlan,
        upcomingItems: computeUpcomingCareItems(elder, now),
        recentLocationAutomation: (elder.locationAutomation?.events || []).slice(0, 6),
        recentOutbound: filterOutboundByPurpose(elder, ['care_plan', 'family_control']).slice(0, 10),
    };
}

function buildTrendsContext(elder, now) {
    const assessments = elder.cognitive?.assessments || [];
    const lowScores = assessments
        .filter((item) => Number(item.score) <= Math.max(1, Number(item.maxScore || 1) / 2))
        .slice(0, 8);
    const recentAlerts = (elder.sundowning?.alerts || []).slice(0, 10);
    const peakSundowningRisk = recentAlerts.reduce(
        (max, item) => Math.max(max, Number(item.riskScore || 0)),
        Number(elder.sundowning?.snapshot?.riskScore || 0),
    );
    return {
        profile: elder.profile,
        cognition: {
            conversationCount7d: (elder.cognitive?.conversations || []).slice(0, 80).length,
            assessmentCount7d: assessments.slice(0, 80).length,
            lowScoreAssessments: lowScores,
        },
        medication: {
            adherence7d: computeMedicationAdherence(elder, 7, now),
            recentMedicationEvents: (elder.medicationEvents || []).slice(0, 8),
        },
        sundowning: {
            currentSnapshot: elder.sundowning?.snapshot || null,
            peakRisk7d: peakSundowningRisk,
            recentAlerts,
        },
        carePlan: {
            trend: elder.carePlan?.trend || null,
            upcomingItems: computeUpcomingCareItems(elder, now),
        },
        location: {
            state: elder.locationAutomation?.state || null,
            recentEvents: (elder.locationAutomation?.events || []).slice(0, 8),
        },
        faces: {
            recentEvents: (elder.faceEvents || []).slice(0, 6),
        },
    };
}

function buildFamilyControlContext(elder, now) {
    const upcoming = computeUpcomingCareItems(elder, now);
    const mediumHighRisk = Number(elder.sundowning?.snapshot?.riskScore || 0) >= 50;
    return {
        profile: elder.profile,
        actionableCards: [
            mediumHighRisk ? {
                action: 'start_breathing',
                title: '启动呼吸放松',
                reason: '黄昏风险中高，需要主动安抚。',
            } : null,
            upcoming[0] ? {
                action: 'show_care_plan',
                title: '播报今日提醒',
                reason: `下一条提醒为 ${upcoming[0].title}（${upcoming[0].time}）。`,
            } : null,
            {
                action: 'open_memory_album',
                title: '打开家庭相册',
                reason: '可用于安抚或唤起熟悉记忆。',
            },
        ].filter(Boolean),
        latestUiCommands: (elder.uiCommands || []).slice(0, 8),
        recentOutbound: filterOutboundByPurpose(elder, ['family_control']).slice(0, 8),
    };
}

function computeDueMedicationItems(elder, now) {
    const currentTime = formatLocalTime(now);
    const today = formatLocalDate(now);
    return (elder.medications || []).flatMap((medication) => {
        const times = Array.isArray(medication.times) ? medication.times : [];
        return times
            .filter((scheduledTime) => scheduledTime <= currentTime)
            .map((scheduledTime) => {
                const taken = (elder.medicationLogs || []).some((log) =>
                    log.medicationId === medication.id &&
                    log.scheduledTime === scheduledTime &&
                    log.date === today &&
                    log.status === 'taken'
                );
                if (taken) return null;
                return {
                    medication,
                    scheduledTime,
                    overdueMinutes: Math.max(0, diffMinutes(scheduledTime, currentTime)),
                    elderNotifiedRecently: hasRecentOutbound(elder, 'medication', ['elder'], 15, {
                        medicationId: medication.id,
                        scheduledTime,
                    }),
                    guardianNotifiedRecently: hasRecentOutbound(elder, 'medication', ['guardians'], 30, {
                        medicationId: medication.id,
                        scheduledTime,
                    }),
                    voiceCallRecently: hasRecentOutbound(elder, 'medication', ['voicecall'], 60, {
                        medicationId: medication.id,
                        scheduledTime,
                    }),
                };
            })
            .filter(Boolean);
    });
}

function computeUpcomingCareItems(elder, now) {
    const currentTime = formatLocalTime(now);
    const items = Array.isArray(elder.carePlan?.items) ? elder.carePlan.items : [];
    return [...items]
        .filter((item) => item?.enabled)
        .sort((a, b) => {
            const aOffset = a.time >= currentTime ? 0 : 1;
            const bOffset = b.time >= currentTime ? 0 : 1;
            if (aOffset !== bOffset) return aOffset - bOffset;
            return String(a.time || '').localeCompare(String(b.time || ''));
        })
        .slice(0, 6);
}

function computeMedicationAdherence(elder, days, now) {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = formatLocalDate(cutoff);
    const relevantLogs = (elder.medicationLogs || []).filter((log) => log.date >= cutoffDate);
    if (relevantLogs.length === 0) return 100;
    const taken = relevantLogs.filter((log) => log.status === 'taken').length;
    return Math.round((taken / relevantLogs.length) * 100);
}

function filterOutboundByPurpose(elder, purposes) {
    const purposeSet = new Set(purposes);
    return (elder.outboundEvents || elder.outbound || []).filter((item) => {
        const purpose = String(item?.purpose || item?.metadata?.purpose || '');
        return purposeSet.has(purpose) || purposes.some((prefix) => purpose.startsWith(prefix));
    });
}

function hasRecentOutbound(elder, purposePrefix, audiences, minutes, metadata = {}) {
    const cutoff = Date.now() - minutes * 60_000;
    const audienceSet = new Set(audiences);
    return (elder.outboundEvents || elder.outbound || []).some((item) => {
        const timestamp = new Date(item.timestamp || 0).getTime();
        if (!Number.isFinite(timestamp) || timestamp < cutoff) return false;
        const purpose = String(item.purpose || item.metadata?.purpose || '');
        if (!purpose.startsWith(purposePrefix)) return false;
        const audience = String(item.audience || item.channel || '');
        if (![...audienceSet].some((entry) => audience.includes(entry) || (item.channel || '').includes(entry))) return false;
        return Object.entries(metadata).every(([key, value]) => item.metadata?.[key] === value);
    });
}

function hasRecentOutboundSinceStartOfDay(elder, purposePrefix, now) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return (elder.outboundEvents || elder.outbound || []).some((item) => {
        const timestamp = new Date(item.timestamp || 0).getTime();
        const purpose = String(item.purpose || item.metadata?.purpose || '');
        return Number.isFinite(timestamp) && timestamp >= start.getTime() && purpose.startsWith(purposePrefix);
    });
}

function distanceMeters(a, b) {
    const lat1 = Number(a.latitude);
    const lon1 = Number(a.longitude);
    const lat2 = Number(b.latitude);
    const lon2 = Number(b.longitude);
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Number.NaN;
    const earthRadius = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function diffMinutes(startHHmm, endHHmm) {
    const [sh, sm] = String(startHHmm || '00:00').split(':').map(Number);
    const [eh, em] = String(endHHmm || '00:00').split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}

function formatLocalTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatLocalDate(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}
