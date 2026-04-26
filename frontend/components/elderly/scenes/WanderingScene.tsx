import React from 'react';
import { AlertCircle } from 'lucide-react';
import { FullScreenSceneCard } from './FullScreenSceneCard';

interface WanderingSceneProps {
    onGoHome: () => void;
    onContactFamily: () => void;
    onDismiss: () => void;
}

export const WanderingScene: React.FC<WanderingSceneProps> = ({
    onGoHome,
    onContactFamily,
    onDismiss
}) => {
    return (
        <FullScreenSceneCard
            icon={<AlertCircle size={30} />}
            title="系统检测到迷路/徘徊"
            statusText="当前状态：定位异常，建议立即干预"
            description="张爷爷，您好像偏离了常走路线。我们会持续守护您，您可以选择回家或联系家人。"
            onClose={onDismiss}
            primaryAction={{ label: '我需要回家', onClick: onGoHome, tone: 'primary' }}
            secondaryAction={{ label: '联系家人', onClick: onContactFamily, tone: 'warning' }}
            tertiaryAction={{ label: '我没事', onClick: onDismiss, tone: 'neutral' }}
        />
    );
};
