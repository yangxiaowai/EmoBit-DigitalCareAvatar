import React from 'react';
import { SystemStatus, SimulationType } from '../../../types';
import { AvatarHeroCard, WanderingRiskCard, MedicationStatusCard, CognitiveStatusCard } from '../cards';
import type { RiskType } from '../types';

interface OverviewTabProps {
  status: SystemStatus;
  simulation: SimulationType;
  onOpenDetail: (type: RiskType) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ status, simulation, onOpenDetail }) => {
  const now = new Date();
  const greeting = now.getHours() < 12 ? '早上好' : now.getHours() < 18 ? '下午好' : '晚上好';
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="px-5 py-4 space-y-4 pb-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{greeting}, 李先生</h2>
          <p className="text-xs text-slate-500 mt-1">{dateStr}</p>
        </div>
      </div>

      {/* 3D 数字人卡片 */}
      <AvatarHeroCard status={status} />

      {/* 三张核心风险卡片 - 纵向堆叠 */}
      <div className="flex flex-col gap-3">
        <WanderingRiskCard onOpenDetail={onOpenDetail} />
        <MedicationStatusCard onOpenDetail={onOpenDetail} />
        <CognitiveStatusCard onOpenDetail={onOpenDetail} />
      </div>
    </div>
  );
};

export default OverviewTab;
