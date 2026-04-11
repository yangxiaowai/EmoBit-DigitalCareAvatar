import React from 'react';
import { Mic, Volume2, Loader2, Battery, Wifi, Signal, Clock } from 'lucide-react';
import { useAvatarFallback } from '../../hooks/useAvatarFallback';

interface CompanionHomeProps {
    isTalking: boolean;
    isListening: boolean;
    isThinking: boolean;
    aiMessage: string;
    interimText: string;
    onToggleMic: () => void;
    time: string;
    dateStr: string;
}

export const CompanionHome: React.FC<CompanionHomeProps> = ({
    isTalking,
    isListening,
    isThinking,
    aiMessage,
    interimText,
    onToggleMic,
    time,
    dateStr
}) => {
    const { hasVideoError, handleVideoError } = useAvatarFallback();

    return (
        <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden font-sans">
            {/* Status Bar */}
            <div className="px-6 pt-6 flex justify-between items-center z-10">
                <div className="flex items-center gap-2 text-slate-400 font-bold">
                    <Clock size={16} />
                    <span>{time}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                    <Signal size={16} />
                    <Wifi size={16} />
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-bold">85%</span>
                        <Battery size={16} />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                {/* Avatar Section */}
                <div className={`relative w-[280px] h-[280px] rounded-[4rem] overflow-hidden shadow-2xl transition-all duration-700 flex items-center justify-center bg-white border-8 border-white
                    ${isTalking ? "scale-105" : "scale-100"}
                `}>
                    {/* Interaction Glows */}
                    {isTalking && <div className="absolute inset-0 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse z-0" />}
                    {isListening && <div className="absolute inset-0 bg-emerald-500 rounded-full blur-3xl opacity-20 animate-pulse z-0" />}

                    {hasVideoError ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-6 z-10 animate-fade-in">
                            <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                                <span className="text-4xl">👴</span>
                            </div>
                            <p className="text-slate-600 font-black text-xl mb-1">小明在陪您</p>
                            <p className="text-slate-400 text-sm font-medium">语音交互正常运行中</p>
                        </div>
                    ) : (
                        <video 
                            id="avatar-video"
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

                {/* Message Display Area */}
                <div className="mt-12 w-full min-h-[160px] flex flex-col items-center justify-center">
                    {isThinking ? (
                        <div className="flex flex-col items-center gap-4 animate-fade-in">
                            <Loader2 size={32} className="text-indigo-500 animate-spin" />
                            <p className="text-slate-400 font-bold">正在思考...</p>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            {isListening ? (
                                <div className="space-y-4">
                                    <p className="text-indigo-600 font-black text-2xl leading-tight">
                                        {interimText || "我在听，您请说..."}
                                    </p>
                                    <div className="flex justify-center gap-1 h-4">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="w-1.5 bg-indigo-400 rounded-full animate-wave" style={{ animationDelay: `${i * 0.1}s` }} />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-slate-800 font-black text-2xl leading-relaxed text-balance">
                                    {aiMessage}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Interaction Area */}
            <div className="p-8 pb-12 flex flex-col items-center gap-6 bg-gradient-to-t from-white via-white/80 to-transparent">
                <button
                    onClick={onToggleMic}
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-90
                        ${isListening ? 'bg-red-500 shadow-red-500/30' : 'bg-indigo-600 shadow-indigo-600/30'}
                    `}
                >
                    {isListening ? (
                        <div className="w-8 h-8 bg-white rounded-md" />
                    ) : (
                        <Mic size={36} className="text-white" />
                    )}
                </button>
                <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    {isListening ? "松开结束" : "长按说话"}
                </div>
            </div>

            <style>{`
                @keyframes wave {
                    0%, 100% { transform: scaleY(1); }
                    50% { transform: scaleY(2); }
                }
                .animate-wave {
                    animation: wave 1s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};
