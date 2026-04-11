import React from 'react';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import { useAvatarFallback } from '../../../hooks/useAvatarFallback';

interface CompanionAvatarCardProps {
    isTalking: boolean;
    isListening: boolean;
    onOpenMainInteraction: () => void;
    companionStatusText: string;
    customAvatarUrl?: string | null;
}

export const CompanionAvatarCard: React.FC<CompanionAvatarCardProps> = ({
    isTalking,
    isListening,
    onOpenMainInteraction,
    companionStatusText,
    customAvatarUrl,
}) => {
    const { hasVideoError, handleVideoError } = useAvatarFallback();

    return (
        <div className="relative flex items-center justify-center group cursor-pointer" onClick={onOpenMainInteraction}>
            <div
                className={`relative w-[260px] h-[260px] rounded-[3rem] overflow-hidden shadow-2xl transition-all duration-500 flex items-center justify-center bg-slate-100 ${
                    isTalking ? 'scale-105' : 'scale-100'
                }`}
            >
                {isTalking && <div className="absolute inset-0 bg-indigo-400 rounded-[3rem] blur-2xl opacity-35 animate-pulse pointer-events-none z-20" />}
                {isListening && <div className="absolute inset-0 bg-emerald-400 rounded-[3rem] blur-2xl opacity-35 animate-pulse pointer-events-none z-20" />}

                {hasVideoError ? (
                    <div className="relative z-10 w-full h-full bg-slate-50 flex flex-col items-center justify-center text-center p-5">
                        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow mb-4 bg-slate-200 flex items-center justify-center">
                            {customAvatarUrl ? (
                                <img src={customAvatarUrl} alt="数字人头像" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl">👴</span>
                            )}
                        </div>
                        <p className="text-slate-800 text-lg font-black">陪伴模式已切换</p>
                        <p className="text-slate-500 text-sm font-semibold mt-1">{companionStatusText}</p>
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
                            <AlertCircle size={14} />
                            视频资源异常，语音与主交互可用
                        </div>
                    </div>
                ) : (
                    <video
                        src="/avatar.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover relative z-10"
                        onError={handleVideoError}
                    />
                )}
            </div>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenMainInteraction();
                }}
                className="absolute -bottom-5 z-30 h-11 px-4 rounded-full bg-white border border-slate-200 shadow text-slate-700 text-sm font-bold inline-flex items-center gap-2"
            >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                <Volume2 size={16} />
                继续陪聊
            </button>

            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-40 h-8 bg-black/10 rounded-[100%] blur-md transform scale-x-150 z-[-1] animate-shadow-breath" />
        </div>
    );
};
