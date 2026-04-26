import React, { useEffect, useState } from 'react';
import { CloudSun, Wind } from 'lucide-react';
import { FullScreenSceneCard } from './FullScreenSceneCard';

interface SundowningSceneProps {
    riskLevel: 'low' | 'medium' | 'high';
    interventionText?: string;
    onContactFamily: () => void;
    onDismiss: () => void;
}

export const SundowningScene: React.FC<SundowningSceneProps> = ({
    riskLevel,
    interventionText = "深呼吸，慢慢吐气... 我们都在这里陪着您。",
    onContactFamily,
    onDismiss
}) => {
    const [breathState, setBreathState] = useState<'inhale' | 'hold' | 'exhale'>('inhale');

    // Simple breathing animation cycle (4s inhale, 2s hold, 6s exhale)
    useEffect(() => {
        let timer: NodeJS.Timeout;
        const startCycle = () => {
            setBreathState('inhale');
            timer = setTimeout(() => {
                setBreathState('hold');
                timer = setTimeout(() => {
                    setBreathState('exhale');
                    timer = setTimeout(startCycle, 6000); // 6s exhale
                }, 2000); // 2s hold
            }, 4000); // 4s inhale
        };

        startCycle();
        return () => clearTimeout(timer);
    }, []);

    const riskText = riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '中风险' : '低风险';

    return (
        <FullScreenSceneCard
            icon={<CloudSun size={30} />}
            title="黄昏守护"
            statusText={`风险等级：${riskText} · 当前干预进行中`}
            description="傍晚时段可能出现焦虑和迷失感，系统会持续安抚并引导您放松。"
            onClose={onDismiss}
            primaryAction={{ label: '我感觉好多了', onClick: onDismiss, tone: 'primary' }}
            secondaryAction={{ label: '联系家人', onClick: onContactFamily, tone: 'warning' }}
        >
            <div className="h-full rounded-3xl bg-sky-50 border border-sky-100 p-6 flex flex-col items-center justify-center text-center">
                <div className="relative w-32 h-32 flex items-center justify-center mb-6">
                    <div
                        className="absolute inset-0 bg-sky-400 rounded-full opacity-20 transition-all duration-1000 ease-in-out"
                        style={{
                            transform: breathState === 'inhale' ? 'scale(1.5)' : breathState === 'hold' ? 'scale(1.5)' : 'scale(0.8)'
                        }}
                    />
                    <div className="relative w-20 h-20 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-lg z-10">
                        <Wind size={34} className={breathState === 'exhale' ? 'animate-pulse' : ''} />
                    </div>
                </div>
                <p className="text-2xl font-black text-sky-800 mb-2">
                    {breathState === 'inhale' ? '请跟着吸气...' : breathState === 'hold' ? '稍微屏息...' : '缓慢呼出...'}
                </p>
                <p className="text-base font-semibold text-sky-700">{interventionText}</p>
            </div>
        </FullScreenSceneCard>
    );
};
