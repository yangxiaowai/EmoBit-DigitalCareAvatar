import React, { useMemo, useState } from 'react';
import { Pill } from 'lucide-react';
import { FullScreenSceneCard } from './FullScreenSceneCard';

interface MedicationSceneProps {
    medicationName?: string;
    medicationImageUrl?: string;
    onTaken: () => void;
    onRemindLater: () => void;
    onContactFamily: () => void;
}

export const MedicationScene: React.FC<MedicationSceneProps> = ({
    medicationName = "日常药物",
    medicationImageUrl,
    onTaken,
    onRemindLater,
    onContactFamily
}) => {
    const [imageLoadFailed, setImageLoadFailed] = useState(false);
    const normalizedImageUrl = useMemo(() => {
        if (!medicationImageUrl) return null;
        if (medicationImageUrl.startsWith('http://') || medicationImageUrl.startsWith('https://') || medicationImageUrl.startsWith('data:')) {
            return medicationImageUrl;
        }
        // 本地路径里包含中文文件名时，编码后可避免静态资源 404。
        return encodeURI(medicationImageUrl);
    }, [medicationImageUrl]);

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
        >
            {normalizedImageUrl && !imageLoadFailed ? (
                <div className="h-full rounded-3xl border border-slate-100 bg-slate-50 overflow-hidden">
                    <img
                        src={normalizedImageUrl}
                        alt={`${medicationName} 药品图片`}
                        className="w-full h-full object-cover"
                        onError={() => setImageLoadFailed(true)}
                    />
                </div>
            ) : (
                <div className="h-full rounded-3xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center px-4 text-center text-slate-400 text-base">
                    暂无更多数据，系统会继续陪伴您。
                </div>
            )}
        </FullScreenSceneCard>
    );
};
