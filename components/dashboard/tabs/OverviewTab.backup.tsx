/**
 * 总览 Tab - 移动照护指挥台
 * 极度聚焦：一眼看懂"当前最危险的是什么"
 * 只包含：数字人展示区 + 三张核心卡片
 */

import React, { useState } from 'react';
import { GuardianPhoneContent } from '../GuardianPhoneShell';
import { RiskSummaryCard } from '../cards/RiskSummaryCard';
import { MedicationStatusCard } from '../cards/MedicationStatusCard';
import { CognitiveStatusCard } from '../cards/CognitiveStatusCard';
import { RiskEventDetailModal } from '../RiskEventDetailModal';
import AvatarStatus3D from '../../AvatarStatus3D';
import { useGuardianDashboardState } from '../../../hooks/useGuardianDashboardState';

export const OverviewTab: React.FC = () => {
    const { state, actions } = useGuardianDashboardState();
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedEventType, setSelectedEventType] = useState<'location' | 'medication' | 'cognitive'>('location');
    const { avatarState } = state;

    // 处理卡片点击，打开详情模态框
    const handleCardClick = (eventId: string, eventType: 'location' | 'medication' | 'cognitive') => {
        setSelectedEventId(eventId);
        setSelectedEventType(eventType);
        setShowDetailModal(true);
    };

    // 获取当前选中事件的详情
    const currentEventDetail = selectedEventId && selectedEventType
        ? actions.getRiskEventDetail(selectedEventId, selectedEventType)
        : null;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* 数字人展示区 */}
            <div className="bg-gradient-to-b from-slate-100 to-slate-50 border-b border-slate-200 shrink-0">
                <div className="px-4 py-3">
                    {/* 问候语 */}
                    <div className="text-center mb-2">
                        <h2 className="text-xl font-bold text-slate-800">
                            {new Date().getHours() < 12
                                ? '早上好'
                                : new Date().getHours() < 18
                                ? '下午好'
                                : '晚上好'}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">张爷爷今日状态</p>
                    </div>

                    {/* 数字人 3D 展示 */}
                    <div className="w-full h-48 bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
                        <AvatarStatus3D
                            state={avatarState}
                            className="w-full h-full"
                        />
                    </div>

                    {/* 数字人状态摘要 */}
                    <div className="mt-3 text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    avatarState.alertLevel === 'critical'
                                        ? 'bg-red-500 animate-pulse'
                                        : avatarState.alertLevel === 'warning'
                                        ? 'bg-orange-500 animate-pulse'
                                        : avatarState.alertLevel === 'attention'
                                        ? 'bg-yellow-500'
                                        : 'bg-green-500'
                                }`}
                            />
                            <span className="text-sm font-medium text-slate-700">
                                {avatarState.message || '状态正常'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 核心卡片区域 */}
            <GuardianPhoneContent className="flex-1 overflow-y-auto">
                <div className="space-y-4">
                    {/* 标题 */}
                    <div className="text-center pt-2">
                        <h3 className="text-lg font-bold text-slate-800">核心监护指标</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            实时监控三大关键风险
                        </p>
                    </div>

                    {/* 三张核心卡片 */}
                    <RiskSummaryCard onViewDetail={(eventId) => handleCardClick(eventId, 'location')} />
                    <MedicationStatusCard onViewDetail={(eventId) => handleCardClick(eventId, 'medication')} />
                    <CognitiveStatusCard onViewDetail={(eventId) => handleCardClick(eventId, 'cognitive')} />

                    {/* 底部提示 */}
                    <div className="text-center py-4">
                        <p className="text-xs text-slate-400">
                            点击底部导航查看更多详情
                        </p>
                    </div>
                </div>
            </GuardianPhoneContent>

            {/* 风险事件详情模态框 */}
            {currentEventDetail && (
                <RiskEventDetailModal
                    isOpen={showDetailModal}
                    onClose={() => {
                        setShowDetailModal(false);
                        setSelectedEventId(null);
                    }}
                    eventDetail={currentEventDetail}
                />
            )}
        </div>
    );
};
