import React from 'react';
import { CloudSun, AlertCircle, Images, Keyboard, Send } from 'lucide-react';
import { SystemStatus } from '../../../types';
import { SundowningInterventionPlan, SundowningPushAlert, SundowningRiskSnapshot } from '../../../services/sundowningService';
import { CompanionAvatarCard } from './CompanionAvatarCard';

interface CompanionHomeLayerProps {
    hiddenByScenario: boolean;
    time: string;
    dateStr: string;
    status: SystemStatus;
    isTalking: boolean;
    isListening: boolean;
    isThinking: boolean;
    aiMessage: string;
    voiceInputDisplay: string | null;
    memoryAnchorName?: string | null;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onOpenAvatarCreator: () => void;
    onOpenAlbum: () => void;
    useKeyboardInput: boolean;
    onToggleInputMode: () => void;
    textInputValue: string;
    onChangeTextInput: (value: string) => void;
    onTextSubmit: () => void;
    onTextInputKeyDown: (key: string) => void;
    onHoldStart: React.PointerEventHandler<HTMLDivElement>;
    onHoldEnd: React.PointerEventHandler<HTMLDivElement>;
    sundowningSnapshot: SundowningRiskSnapshot;
    sundowningAlerts: SundowningPushAlert[];
    activeSundowningPlan: SundowningInterventionPlan | null;
    showBreathingGuide: boolean;
    breathingGuideSteps: string[];
    breathingGuideIndex: number;
    onFamilySoothing: () => void;
    onBreathingExercise: () => void;
    customAvatarUrl?: string | null;
}

export const CompanionHomeLayer: React.FC<CompanionHomeLayerProps> = ({
    hiddenByScenario,
    time,
    dateStr,
    status,
    isTalking,
    isListening,
    isThinking,
    aiMessage,
    voiceInputDisplay,
    memoryAnchorName,
    messagesEndRef,
    onOpenAvatarCreator,
    onOpenAlbum,
    useKeyboardInput,
    onToggleInputMode,
    textInputValue,
    onChangeTextInput,
    onTextSubmit,
    onTextInputKeyDown,
    onHoldStart,
    onHoldEnd,
    sundowningSnapshot,
    sundowningAlerts,
    activeSundowningPlan,
    showBreathingGuide,
    breathingGuideSteps,
    breathingGuideIndex,
    onFamilySoothing,
    onBreathingExercise,
    customAvatarUrl,
}) => {
    const companionStatusText = isListening
        ? '正在聆听您的声音'
        : isTalking
            ? '正在温和回应您'
            : '主陪伴入口已就绪';

    return (
        <div className={`w-full h-full flex flex-col relative transition-all duration-500 overflow-hidden bg-gradient-to-b from-indigo-50 to-white ${hiddenByScenario ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}`}>
            <div className="w-full px-8 pt-14 pb-2 flex justify-between items-end relative z-10 animate-fade-in-up shrink-0">
                <div className="flex flex-col">
                    <span className="text-5xl font-black text-slate-800 tracking-tighter leading-none">{time}</span>
                    <span className="text-sm font-bold text-slate-500 mt-2 pl-1 tracking-widest uppercase">{dateStr}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-3xl font-black text-slate-800">24°</span>
                    <CloudSun size={32} className="text-amber-500" />
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center relative min-h-0 -mt-8 overflow-hidden">
                <div className="transform scale-90 shrink-0">
                    <CompanionAvatarCard
                        isTalking={isTalking}
                        isListening={isListening}
                        onOpenMainInteraction={onOpenAvatarCreator}
                        companionStatusText={companionStatusText}
                        customAvatarUrl={customAvatarUrl}
                    />
                </div>

                {status === SystemStatus.WARNING && (
                    <div className="absolute top-4 right-6 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center animate-pulse z-50">
                        <AlertCircle size={14} className="text-white" />
                    </div>
                )}

                {memoryAnchorName && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-bounce whitespace-nowrap z-50">
                        定位触发：{memoryAnchorName}
                    </div>
                )}
            </div>

            {(sundowningSnapshot.riskLevel !== 'low' || activeSundowningPlan?.status === 'running' || showBreathingGuide) && (
                <div className="shrink-0 px-4 pb-2 relative z-10">
                    <div className={`rounded-2xl border p-3 backdrop-blur-sm ${
                        sundowningSnapshot.riskLevel === 'high'
                            ? 'bg-rose-50/90 border-rose-200'
                            : sundowningSnapshot.riskLevel === 'medium'
                                ? 'bg-amber-50/90 border-amber-200'
                                : 'bg-white/70 border-slate-200'
                    }`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] font-bold text-slate-700">黄昏守护</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    sundowningSnapshot.riskLevel === 'high'
                                        ? 'bg-rose-100 text-rose-700'
                                        : sundowningSnapshot.riskLevel === 'medium'
                                            ? 'bg-amber-100 text-amber-700'
                                            : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {sundowningSnapshot.riskLevel === 'high' ? '高风险' : sundowningSnapshot.riskLevel === 'medium' ? '中风险' : '低风险'}
                                </span>
                            </div>
                            <span className="text-[10px] text-slate-500">风险指数 {sundowningSnapshot.riskScore}</span>
                        </div>

                        <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ease-out ${
                                    sundowningSnapshot.riskLevel === 'high'
                                        ? 'bg-rose-500'
                                        : sundowningSnapshot.riskLevel === 'medium'
                                            ? 'bg-amber-500'
                                            : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.max(6, sundowningSnapshot.riskScore)}%` }}
                            />
                        </div>

                        <p className="mt-2 text-[10px] text-slate-600">{sundowningSnapshot.keyFactors.slice(0, 2).join('；') || '系统持续观察中'}</p>

                        {activeSundowningPlan?.status === 'running' && (
                            <p className="mt-1 text-[10px] font-medium text-indigo-600">正在干预：{activeSundowningPlan.title}</p>
                        )}

                        {showBreathingGuide && (
                            <div className="mt-2 rounded-xl bg-sky-50 border border-sky-100 px-2.5 py-2">
                                <p className="text-[11px] font-semibold text-sky-700">呼吸训练：{breathingGuideSteps[breathingGuideIndex]}</p>
                            </div>
                        )}

                        {sundowningAlerts[0] && (
                            <p className="mt-1 text-[10px] text-slate-500">推送：{sundowningAlerts[0].title}</p>
                        )}

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={onFamilySoothing} className="h-8 rounded-xl bg-indigo-500 text-white text-[11px] font-semibold">
                                家属安抚
                            </button>
                            <button type="button" onClick={onBreathingExercise} className="h-8 rounded-xl bg-sky-500 text-white text-[11px] font-semibold">
                                呼吸放松
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(voiceInputDisplay || aiMessage) && (
                <div className="shrink-0 px-4 pb-1 relative z-10 min-h-0">
                    <div className="bg-white/60 backdrop-blur-sm py-2 px-3 rounded-xl text-center">
                        {voiceInputDisplay ? (
                            <p className="text-slate-800 text-sm font-bold truncate">"{voiceInputDisplay}"</p>
                        ) : (
                            <p className="text-slate-600 text-sm font-medium truncate">{aiMessage}</p>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            <div className="shrink-0 px-3 pb-6 pt-2 relative z-10">
                <div className="bg-[#F7F7F7] rounded-[2rem] min-h-[68px] flex items-center justify-between px-4 py-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] select-none">
                    <button
                        type="button"
                        onClick={onToggleInputMode}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${useKeyboardInput ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-400/60 text-slate-600 hover:bg-slate-100'}`}
                        title={useKeyboardInput ? '切换为语音输入' : '使用键盘输入'}
                    >
                        <Keyboard size={24} strokeWidth={2} />
                    </button>

                    {useKeyboardInput ? (
                        <div className="flex-1 flex items-center gap-2 min-w-0 mx-3">
                            <input
                                type="text"
                                value={textInputValue}
                                onChange={(e) => onChangeTextInput(e.target.value)}
                                onKeyDown={(e) => onTextInputKeyDown(e.key)}
                                placeholder="输入文字发送..."
                                className="flex-1 min-w-0 h-12 px-4 rounded-2xl bg-white border border-slate-200 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={onTextSubmit}
                                disabled={!textInputValue.trim()}
                                className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <Send size={20} strokeWidth={2} />
                            </button>
                        </div>
                    ) : (
                        <div
                            className="flex-1 flex items-center justify-center min-h-[48px] min-w-0 mx-3 cursor-pointer active:opacity-80 transition-opacity"
                            onPointerDown={onHoldStart}
                            onPointerUp={onHoldEnd}
                            onPointerLeave={onHoldEnd}
                            onPointerCancel={onHoldEnd}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            <span className="text-slate-600 font-medium text-lg">
                                {isListening ? '正在聆听...' : isThinking ? '思考中...' : '长按说话'}
                            </span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={onOpenAlbum}
                        className="w-12 h-12 rounded-full border-2 border-slate-400/60 flex items-center justify-center flex-shrink-0 text-slate-600 hover:bg-slate-100 transition-colors"
                        title="打开相册"
                    >
                        <Images size={26} strokeWidth={2} />
                    </button>
                </div>
            </div>
        </div>
    );
};
