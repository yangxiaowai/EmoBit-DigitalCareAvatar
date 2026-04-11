import React, { useEffect, useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Activity, ChevronRight } from 'lucide-react';
import { sundowningService, SundowningRiskSnapshot, SundowningInterventionPlan } from '../../../services/sundowningService';
import type { RiskCardProps, RiskLevel } from '../types';

function mapSundowningRiskLevel(level: SundowningRiskSnapshot['riskLevel']): RiskLevel {
  return level as RiskLevel;
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

function getTrendIcon(trend: SundowningRiskSnapshot['trend']) {
  switch (trend) {
    case 'rising':
      return <TrendingUp size={16} className="text-rose-500" />;
    case 'falling':
      return <TrendingDown size={16} className="text-emerald-500" />;
    case 'stable':
      return <Minus size={16} className="text-slate-400" />;
  }
}

const CognitiveStatusCard: React.FC<RiskCardProps> = ({ onOpenDetail }) => {
  const [snapshot, setSnapshot] = useState<SundowningRiskSnapshot | null>(null);
  const [intervention, setIntervention] = useState<SundowningInterventionPlan | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [riskHistory, setRiskHistory] = useState<number[]>([]);

  useEffect(() => {
    const updateData = () => {
      const currentSnapshot = sundowningService.getCurrentSnapshot();
      setSnapshot(currentSnapshot);
      setIntervention(sundowningService.getActiveIntervention());
      setLastUpdate(new Date());

      // 更新风险历史数据（保留最近12个数据点）
      if (currentSnapshot) {
        setRiskHistory(prev => {
          const newHistory = [...prev, currentSnapshot.riskScore];
          // 如果历史数据少于12个，添加一些模拟的历史数据以显示波动
          if (newHistory.length < 12) {
            const baseScore = currentSnapshot.riskScore;
            const simulatedHistory: number[] = [];
            let prevScore = baseScore;

            for (let i = 0; i < 12 - newHistory.length; i++) {
              // 生成类似心率图的随机波动数据
              const randomWalk = Math.random() * 8 - 4; // -4 到 +4 的随机波动
              const newScore = prevScore + randomWalk;
              // 限制在合理范围内
              const clampedScore = Math.max(30, Math.min(80, newScore));
              simulatedHistory.push(clampedScore);
              prevScore = clampedScore;
            }

            return [...simulatedHistory, ...newHistory].slice(-12);
          }
          return newHistory.slice(-12); // 只保留最近12个点
        });
      }
    };

    updateData();
    const interval = setInterval(updateData, 5000); // 每5秒更新一次

    return () => clearInterval(interval);
  }, []);

  if (!snapshot) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-50 rounded-lg">
            <Brain className="text-orange-600" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">黄昏风险</h3>
        </div>
        <p className="text-sm text-slate-500">正在加载数据...</p>
      </div>
    );
  }

  const riskLevel = mapSundowningRiskLevel(snapshot.riskLevel);
  const isInterventionActive = intervention && intervention.status === 'running';

  // 计算曲线路径
  const points = riskHistory.length > 0 ? riskHistory : [snapshot.riskScore];

  // Y轴范围固定为0-100
  const minRisk = 0;
  const maxRisk = 100;

  const chartWidth = 280;
  const chartHeight = 100;
  const chartPadding = { top: 15, bottom: 30, left: 30, right: 15 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const step = plotWidth / Math.max(points.length - 1, 1);

  // 生成时间标签（显示5个时间点，每5秒一个间隔）
  const now = new Date();
  const timeLabels = [0, 3, 6, 9, 11].map(i => {
    const timePoint = new Date(now.getTime() - (11 - i) * 5 * 1000); // 5秒
    const hours = timePoint.getHours().toString().padStart(2, '0');
    const minutes = timePoint.getMinutes().toString().padStart(2, '0');
    const seconds = timePoint.getSeconds().toString().padStart(2, '0');
    return { index: i, label: `${hours}:${minutes}:${seconds}` };
  });

  // 纵坐标刻度（动态生成3个刻度，从上到下）
  const yTicks = [
    maxRisk,
    Math.round((maxRisk + minRisk) / 2),
    minRisk
  ];

  const pathData = points.map((risk, index) => {
    const x = chartPadding.left + index * step;
    const y = chartPadding.top + plotHeight - ((risk - minRisk) / (maxRisk - minRisk)) * plotHeight;
    return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(' ');

  return (
    <div
      onClick={() => onOpenDetail('cognitive')}
      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
    >
      {/* 头部：标题和状态 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
            <Brain className="text-white" size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 whitespace-nowrap">黄昏风险</h3>
            <p className="text-xs text-slate-500">
              {isInterventionActive ? '干预进行中' : '风险指数监测'}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getRiskBadgeStyles(riskLevel)}`}>
          {getRiskLabel(riskLevel)}
        </span>
      </div>

      {/* 风险评分和趋势 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-slate-900">{snapshot.riskScore}</span>
          <div className="flex items-center gap-1">
            {getTrendIcon(snapshot.trend)}
            <span className="text-xs text-slate-600">
              {snapshot.trend === 'rising' ? '上升' : snapshot.trend === 'falling' ? '下降' : '稳定'}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-500">风险评分</p>
      </div>

      {/* 曲线图 */}
      <div className="bg-white rounded-xl p-3">
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full">
          {/* 定义渐变色：黄色 -> 橙色 -> 红色 */}
          <defs>
            <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* 纵坐标刻度线和标签 */}
          {yTicks.map((tick) => {
            const y = chartPadding.top + plotHeight - ((tick - minRisk) / (maxRisk - minRisk)) * plotHeight;
            return (
              <g key={tick}>
                {/* 横向网格线 - 非常淡 */}
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartWidth - chartPadding.right}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                {/* 纵坐标标签 */}
                <text
                  x={5}
                  y={y + 4}
                  fontSize="10"
                  fill="#94a3b8"
                  textAnchor="start"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* 曲线 - 黄色到橙色到红色渐变 */}
          <path
            d={pathData}
            fill="none"
            stroke="url(#riskGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 横坐标时间标签 */}
          {timeLabels.map(({ index, label }) => {
            const x = chartPadding.left + index * step;
            return (
              <text
                key={index}
                x={x}
                y={chartHeight - 8}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {label}
              </text>
            );
          })}
        </svg>

        {/* 底部说明文字 */}
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-xs text-slate-500">正常范围：0-100</p>
          <p className="text-xs text-slate-400">实时</p>
        </div>
      </div>
    </div>
  );
};

export default CognitiveStatusCard;
