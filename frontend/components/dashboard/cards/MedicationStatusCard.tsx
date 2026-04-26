import React, { useEffect, useState } from 'react';
import { Heart, Activity, Droplet, Moon } from 'lucide-react';
import type { RiskCardProps } from '../types';

type HealthStatus = 'normal' | 'attention' | 'warning';

function getHealthStatus(heartRate: number, bloodPressure: { systolic: number; diastolic: number }, bloodOxygen: number): HealthStatus {
  const isHeartNormal = heartRate >= 60 && heartRate <= 100;
  const isBpNormal = bloodPressure.systolic < 140 && bloodPressure.diastolic < 90;
  const isOxygenNormal = bloodOxygen >= 95;

  if (!isHeartNormal || !isBpNormal || bloodOxygen < 90) return 'warning';
  if (bloodOxygen < 95) return 'attention';
  return 'normal';
}

function getStatusBadgeStyles(status: HealthStatus): string {
  switch (status) {
    case 'normal':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'attention':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'warning':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
  }
}

function getStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'normal':
      return '正常';
    case 'attention':
      return '需关注';
    case 'warning':
      return '异常';
  }
}

const MedicationStatusCard: React.FC<RiskCardProps> = ({ onOpenDetail }) => {
  // 模拟健康数据
  const [heartRate, setHeartRate] = useState(72);
  const [bloodPressure, setBloodPressure] = useState({ systolic: 120, diastolic: 80 });
  const [bloodOxygen, setBloodOxygen] = useState(98);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      // 模拟数据更新
      setHeartRate(Math.floor(Math.random() * 20) + 65); // 65-85
      setBloodPressure({
        systolic: Math.floor(Math.random() * 30) + 110, // 110-140
        diastolic: Math.floor(Math.random() * 20) + 70, // 70-90
      });
      setBloodOxygen(Math.floor(Math.random() * 5) + 95); // 95-100
      setSleepHours(Math.random() * 3 + 6); // 6-9
      setLastUpdate(new Date());
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const status = getHealthStatus(heartRate, bloodPressure, bloodOxygen);
  const sleepDisplay = `${Math.floor(sleepHours)}小时${Math.round((sleepHours % 1) * 60)}分`;

  return (
    <div
      onClick={() => onOpenDetail('medication')}
      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
    >
      {/* 头部：标题和状态 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
            <Heart className="text-white" size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 whitespace-nowrap">健康监测</h3>
            <p className="text-xs text-slate-500">实时体征监测</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusBadgeStyles(status)}`}>
          {getStatusLabel(status)}
        </span>
      </div>

      {/* 健康指标网格 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 心率 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0">
            <Activity size={16} className="text-rose-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">心率</p>
            <p className="text-lg font-bold text-slate-900">{heartRate} <span className="text-xs font-normal text-slate-500">bpm</span></p>
          </div>
        </div>

        {/* 血压 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Droplet size={16} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">血压</p>
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-bold text-slate-900">{bloodPressure.systolic}</span>
              <span className="text-xs text-slate-500">(高)</span>
              <span className="text-lg font-bold text-slate-900">/{bloodPressure.diastolic}</span>
              <span className="text-xs text-slate-500">(低)</span>
            </div>
          </div>
        </div>

        {/* 血氧 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center flex-shrink-0">
            <Activity size={16} className="text-cyan-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">血氧</p>
            <p className="text-lg font-bold text-slate-900">{bloodOxygen} <span className="text-xs font-normal text-slate-500">%</span></p>
          </div>
        </div>

        {/* 睡眠 */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Moon size={16} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">睡眠</p>
            <p className="text-sm font-bold text-slate-900 truncate">{sleepDisplay}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationStatusCard;
