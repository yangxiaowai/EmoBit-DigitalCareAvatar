import React from 'react';
import { Pill } from 'lucide-react';
import { FullScreenSceneCard } from './FullScreenSceneCard';

interface MedicationSceneProps {
    medicationName?: string;
    onTaken: () => void;
    onRemindLater: () => void;
    onContactFamily: () => void;
}

export const MedicationScene: React.FC<MedicationSceneProps> = ({
    medicationName = "日常药物",
    onTaken,
    onRemindLater,
    onContactFamily
}) => {
    return (
        <FullScreenSceneCard
            icon={<Pill size={30} />}
            title="现在该吃药"
            statusText={`当前任务：按时服用 ${medicationName}`}
            description="别着急，按医生和家属设置服用即可。完成后系统会自动记录。"
            onClose={onRemindLater}
            primaryAction={{ label: '已服药', onClick: onTaken, tone: 'primary' }}
            secondaryAction={{ label: '稍后提醒', onClick: onRemindLater, tone: 'neutral' }}
            tertiaryAction={{ label: '联系家人', onClick: onContactFamily, tone: 'warning' }}
        />
    );
};
