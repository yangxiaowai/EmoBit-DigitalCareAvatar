import React, { useEffect, useState } from 'react';
import { Footprints, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';
import { wanderingService, WanderingState } from '../../../services/wanderingService';
import { locationAutomationService, LocationAutomationState } from '../../../services/locationAutomationService';
import type { RiskCardProps, RiskLevel } from '../types';

function calculateWanderingRisk(
  wanderingState: WanderingState,
  locationState: LocationAutomationState
): RiskLevel {
  if (wanderingState.wanderingType === 'lost' || wanderingState.outsideSafeZone) {
    return 'high';
  }
  if (wanderingState.isWandering || locationState.unfamiliarStay) {
    return 'medium';
  }
  return 'low';
}

function getRiskBadgeStyles(risk: RiskLevel): string {
  switch (risk) {
    case 'high':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'medium':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'low':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }
}

function getRiskLabel(risk: RiskLevel): string {
  switch (risk) {
    case 'high':
      return '高风险';
    case 'medium':
      return '中风险';
    case 'low':
      return '低风险';
  }
}

function getWanderingTypeLabel(type: WanderingState['wanderingType']): string {
  switch (type) {
    case 'lost':
      return '疑似走失';
    case 'circling':
      return '异常打转';
    case 'pacing':
      return '反复踱步';
    default:
      return '正常活动';
  }
}

const WanderingRiskCard: React.FC<RiskCardProps> = ({ onOpenDetail }) => {
  const [wanderingState, setWanderingState] = useState<WanderingState>(wanderingService.getState());
  const [locationState, setLocationState] = useState<LocationAutomationState>(locationAutomationService.getState());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [simulatedDistance, setSimulatedDistance] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWanderingState(wanderingService.getState());
      setLocationState(locationAutomationService.getState());
      setLastUpdate(new Date());

      // 模拟距离变化：在0-500米之间随机波动
      setSimulatedDistance(Math.floor(Math.random() * 500));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const riskLevel = calculateWanderingRisk(wanderingState, locationState);
  const locationLabel = locationState.currentLocation?.label || '未知位置';
  const isInSafeZone = !wanderingState.outsideSafeZone;

  return (
    <div
      onClick={() => onOpenDetail('wandering')}
      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-center justify-between gap-4">
        {/* 左侧：图标 + 标题 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <MapPin className="text-white" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900 whitespace-nowrap">实时定位</h3>
            <p className="text-xs text-slate-500 truncate">{locationLabel}</p>
          </div>
        </div>

        {/* 右侧：核心数据 + 状态标签 */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
            isInSafeZone ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {isInSafeZone ? '围栏内' : '已超出'}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900">{simulatedDistance}</span>
            <span className="text-sm text-slate-500 font-medium">米</span>
          </div>
          <p className="text-xs text-slate-600 whitespace-nowrap">
            距离家
          </p>
        </div>
      </div>
    </div>
  );
};

export default WanderingRiskCard;
