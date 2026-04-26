import React from 'react';
import { WanderingScene } from '../scenes/WanderingScene';
import { MedicationScene } from '../scenes/MedicationScene';
import { SundowningScene } from '../scenes/SundowningScene';

export type CareSceneType = 'none' | 'wandering' | 'medication' | 'sundowning';

interface CareSceneOverlayLayerProps {
    activeCareScene: CareSceneType;
    medicationName?: string;
    medicationImageUrl?: string;
    riskLevel: 'low' | 'medium' | 'high';
    interventionText?: string;
    onClose: () => void;
    onNavigateHome: () => void;
    onMedicationTaken: () => void;
    onMedicationRemindLater: () => void;
    onContactFamily: () => void;
}

export const CareSceneOverlayLayer: React.FC<CareSceneOverlayLayerProps> = ({
    activeCareScene,
    medicationName,
    medicationImageUrl,
    riskLevel,
    interventionText,
    onClose,
    onNavigateHome,
    onMedicationTaken,
    onMedicationRemindLater,
    onContactFamily,
}) => {
    if (activeCareScene === 'none') return null;

    if (activeCareScene === 'wandering') {
        return (
            <WanderingScene
                onGoHome={onNavigateHome}
                onContactFamily={onContactFamily}
                onDismiss={onClose}
            />
        );
    }

    if (activeCareScene === 'medication') {
        return (
            <MedicationScene
                medicationName={medicationName || '日常药物'}
                medicationImageUrl={medicationImageUrl}
                onTaken={onMedicationTaken}
                onRemindLater={onMedicationRemindLater}
                onContactFamily={onContactFamily}
            />
        );
    }

    return (
        <SundowningScene
            riskLevel={riskLevel}
            interventionText={interventionText}
            onContactFamily={onContactFamily}
            onDismiss={onClose}
        />
    );
};
