import React from 'react';
import { X } from 'lucide-react';

interface SceneAction {
    label: string;
    onClick: () => void;
    tone?: 'primary' | 'neutral' | 'warning';
}

interface FullScreenSceneCardProps {
    icon: React.ReactNode;
    title: string;
    statusText: string;
    description: string;
    primaryAction: SceneAction;
    secondaryAction?: SceneAction;
    tertiaryAction?: SceneAction;
    onClose: () => void;
    children?: React.ReactNode;
}

const toneClassMap: Record<NonNullable<SceneAction['tone']>, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    neutral: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
};

const ActionButton: React.FC<{ action: SceneAction; large?: boolean }> = ({ action, large = false }) => {
    const tone = action.tone ?? 'primary';
    return (
        <button
            type="button"
            onClick={action.onClick}
            className={`w-full rounded-[1.75rem] font-bold transition-all active:scale-[0.98] ${
                large ? 'h-16 text-xl' : 'h-14 text-lg'
            } ${toneClassMap[tone]}`}
        >
            {action.label}
        </button>
    );
};

export const FullScreenSceneCard: React.FC<FullScreenSceneCardProps> = ({
    icon,
    title,
    statusText,
    description,
    primaryAction,
    secondaryAction,
    tertiaryAction,
    onClose,
    children,
}) => {
    return (
        <div className="absolute inset-0 z-[90] bg-slate-950/75 backdrop-blur-md p-4 animate-fade-in">
            <div className="h-full w-full rounded-[2.5rem] bg-white shadow-[0_28px_60px_rgba(15,23,42,0.28)] overflow-hidden flex flex-col animate-slide-up">
                <div className="px-6 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                {icon}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold tracking-wide text-slate-500">陪伴场景</p>
                                <h2 className="text-[1.65rem] leading-tight font-black text-slate-800">{title}</h2>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center shrink-0"
                            aria-label="退出场景"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-indigo-600">{statusText}</p>
                    <p className="mt-1 text-base leading-relaxed text-slate-600">{description}</p>
                </div>

                <div className="flex-1 px-6 py-5 overflow-y-auto">
                    {children ?? (
                        <div className="h-full rounded-3xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center px-4 text-center text-slate-400 text-base">
                            暂无更多数据，系统会继续陪伴您。
                        </div>
                    )}
                </div>

                <div className="px-6 pb-6 pt-3 border-t border-slate-100 space-y-3">
                    <ActionButton action={primaryAction} large />
                    {secondaryAction && <ActionButton action={secondaryAction} />}
                    {tertiaryAction && <ActionButton action={tertiaryAction} />}
                </div>
            </div>
        </div>
    );
};
