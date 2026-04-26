import { useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  Heart,
  Droplets,
  Thermometer,
  ChevronRight,
  TrendingDown,
  Minus,
  Activity,
} from "lucide-react";

const heartRateData = [
  { time: "08:00", value: 72 },
  { time: "09:00", value: 78 },
  { time: "10:00", value: 75 },
  { time: "11:00", value: 82 },
  { time: "12:00", value: 76 },
  { time: "13:00", value: 71 },
  { time: "14:00", value: 80 },
  { time: "15:00", value: 85 },
  { time: "16:00", value: 89 },
  { time: "16:08", value: 78 },
];

const bloodPressureData = [
  { time: "08:00", systolic: 118, diastolic: 76 },
  { time: "09:00", systolic: 122, diastolic: 78 },
  { time: "10:00", systolic: 120, diastolic: 80 },
  { time: "11:00", systolic: 125, diastolic: 82 },
  { time: "12:00", systolic: 119, diastolic: 77 },
  { time: "13:00", systolic: 123, diastolic: 80 },
  { time: "14:00", systolic: 128, diastolic: 84 },
  { time: "15:00", systolic: 130, diastolic: 85 },
  { time: "16:00", systolic: 128, diastolic: 82 },
];

const bloodOxygenData = [
  { time: "08:00", value: 98 },
  { time: "09:00", value: 97 },
  { time: "10:00", value: 98 },
  { time: "11:00", value: 97 },
  { time: "12:00", value: 96 },
  { time: "13:00", value: 98 },
  { time: "14:00", value: 97 },
  { time: "15:00", value: 98 },
  { time: "16:00", value: 97 },
];

type ChartTab = "heartRate" | "bloodPressure" | "bloodOxygen";

const tabConfig: Record<
  ChartTab,
  { label: string; icon: React.ReactNode; color: string; activeColor: string }
> = {
  heartRate: {
    label: "心率",
    icon: <Heart className="w-3.5 h-3.5" />,
    color: "#FF6B6B",
    activeColor: "#FF6B6B",
  },
  bloodPressure: {
    label: "血压",
    icon: <Droplets className="w-3.5 h-3.5" />,
    color: "#6C5CE7",
    activeColor: "#6C5CE7",
  },
  bloodOxygen: {
    label: "血氧",
    icon: <Activity className="w-3.5 h-3.5" />,
    color: "#3B82F6",
    activeColor: "#3B82F6",
  },
};

export function VitalCharts() {
  const [activeChart, setActiveChart] = useState<ChartTab>("heartRate");

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[#1a1a2e]" style={{ fontSize: "15px", fontWeight: 600 }}>
          实时体征监测
        </span>
        <button className="flex items-center gap-0.5 text-[12px] text-[#6C5CE7]">
          查看历史 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Real-time summary cards */}
      <div className="flex gap-2 mb-3">
        {(
          [
            { key: "heartRate" as ChartTab, val: "78", unit: "bpm", label: "心率", status: "正常", statusColor: "#059669", statusBg: "#ECFDF5", iconBg: "#FEF2F2", iconColor: "#FF6B6B", icon: <Heart className="w-3.5 h-3.5" /> },
            { key: "bloodPressure" as ChartTab, val: "128/82", unit: "mmHg", label: "血压", status: "偏高", statusColor: "#D97706", statusBg: "#FFFBEB", iconBg: "#F5F3FF", iconColor: "#6C5CE7", icon: <Droplets className="w-3.5 h-3.5" /> },
            { key: "bloodOxygen" as ChartTab, val: "97", unit: "%", label: "血氧", status: "正常", statusColor: "#059669", statusBg: "#ECFDF5", iconBg: "#EFF6FF", iconColor: "#3B82F6", icon: <Activity className="w-3.5 h-3.5" /> },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            onClick={() => setActiveChart(item.key)}
            className={`flex-1 bg-white rounded-xl p-2.5 text-left transition-all border ${
              activeChart === item.key
                ? "border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                : "border-gray-100/80 shadow-[0_1px_4px_rgba(0,0,0,0.02)]"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: item.iconBg, color: item.iconColor }}
              >
                {item.icon}
              </div>
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: item.statusBg, color: item.statusColor, fontWeight: 500 }}
              >
                {item.status}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">{item.label}</p>
            <div className="flex items-baseline gap-0.5 mt-0.5">
              <span style={{ fontSize: "17px", fontWeight: 700, color: "#1a1a2e", lineHeight: 1 }}>
                {item.val}
              </span>
              <span className="text-[10px] text-gray-400">{item.unit}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Chart Card */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100/80">
        {/* Tab Bar */}
        <div className="flex border-b border-gray-100">
          {(Object.keys(tabConfig) as ChartTab[]).map((key) => {
            const tab = tabConfig[key];
            const isActive = activeChart === key;
            return (
              <button
                key={key}
                onClick={() => setActiveChart(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] transition-all relative ${
                  isActive ? "" : "text-gray-400"
                }`}
                style={{
                  color: isActive ? tab.activeColor : undefined,
                  fontWeight: isActive ? 600 : undefined,
                }}
              >
                {tab.icon}
                {tab.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ backgroundColor: tab.activeColor }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {activeChart === "heartRate" && (
            <>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[11px] text-gray-400">爸爸当前心率</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span style={{ fontSize: "30px", fontWeight: 800, color: "#FF6B6B", lineHeight: 1 }}>78</span>
                    <span className="text-[12px] text-gray-400">bpm</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2 text-right">
                  <div className="flex items-center gap-1 justify-end mb-1">
                    <Minus className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-400">较昨日持平</span>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400">最高</p>
                      <p className="text-[13px] text-[#FF6B6B]" style={{ fontWeight: 600 }}>89</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">最低</p>
                      <p className="text-[13px] text-[#3B82F6]" style={{ fontWeight: 600 }}>71</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1">
                  <span className="w-5 h-2 rounded-sm bg-[#FF6B6B]/10 border border-[#FF6B6B]/20" />
                  <span className="text-[10px] text-gray-400">正常区间 60-100</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={heartRateData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="heartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <ReferenceArea y1={60} y2={100} fill="#FF6B6B" fillOpacity={0.03} />
                  <ReferenceLine y={100} stroke="#FF6B6B" strokeDasharray="3 3" strokeOpacity={0.15} />
                  <ReferenceLine y={60} stroke="#FF6B6B" strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#bbb" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[55, 105]} tick={{ fontSize: 10, fill: "#bbb" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "12px", padding: "8px 12px" }}
                    formatter={(value: number) => [`${value} bpm`, "心率"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#FF6B6B" strokeWidth={2.5} fill="url(#heartGrad)" dot={false} activeDot={{ r: 5, fill: "#FF6B6B", stroke: "#fff", strokeWidth: 2.5 }} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-3 bg-[#F0FDF4] rounded-xl px-3 py-2 flex items-start gap-2">
                <span className="text-[13px] mt-0.5">✅</span>
                <p className="text-[12px] text-[#166534] leading-relaxed">
                  爸爸心率全天平稳，均在正常范围内，无异常波动，请放心。
                </p>
              </div>
            </>
          )}

          {activeChart === "bloodPressure" && (
            <>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[11px] text-gray-400">爸爸当前血压</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span style={{ fontSize: "30px", fontWeight: 800, color: "#6C5CE7", lineHeight: 1 }}>128</span>
                    <span className="text-[14px] text-gray-300" style={{ fontWeight: 300 }}>/</span>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "#a29bfe", lineHeight: 1 }}>82</span>
                    <span className="text-[11px] text-gray-400 ml-0.5">mmHg</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2 text-right">
                  <div className="flex items-center gap-1 justify-end mb-1">
                    <TrendingDown className="w-3 h-3 text-green-500" />
                    <span className="text-[11px] text-gray-400">午后回落</span>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400">收缩峰值</p>
                      <p className="text-[13px] text-[#6C5CE7]" style={{ fontWeight: 600 }}>130</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">舒张峰值</p>
                      <p className="text-[13px] text-[#a29bfe]" style={{ fontWeight: 600 }}>85</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] rounded-full bg-[#6C5CE7]" />
                  <span className="text-[10px] text-gray-400">收缩压</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-4 h-[2px] rounded-full bg-[#a29bfe] opacity-70" />
                  <span className="text-[10px] text-gray-400">舒张压</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-5 h-2 rounded-sm bg-[#6C5CE7]/5 border border-[#6C5CE7]/10" />
                  <span className="text-[10px] text-gray-400">正常区间</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={bloodPressureData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <ReferenceArea y1={90} y2={120} fill="#6C5CE7" fillOpacity={0.03} />
                  <ReferenceLine y={120} stroke="#6C5CE7" strokeDasharray="3 3" strokeOpacity={0.15} label={{ value: "120", position: "right", fontSize: 9, fill: "#6C5CE7" }} />
                  <ReferenceLine y={80} stroke="#a29bfe" strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#bbb" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 145]} tick={{ fontSize: 10, fill: "#bbb" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "12px", padding: "8px 12px" }} />
                  <Line type="monotone" dataKey="systolic" stroke="#6C5CE7" strokeWidth={2.5} dot={false} name="收缩压" activeDot={{ r: 5, fill: "#6C5CE7", stroke: "#fff", strokeWidth: 2.5 }} />
                  <Line type="monotone" dataKey="diastolic" stroke="#a29bfe" strokeWidth={2} dot={false} name="舒张压" strokeDasharray="4 4" activeDot={{ r: 4, fill: "#a29bfe", stroke: "#fff", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-3 bg-[#FFFBEB] rounded-xl px-3 py-2 flex items-start gap-2">
                <span className="text-[13px] mt-0.5">⚠️</span>
                <p className="text-[12px] text-[#92400E] leading-relaxed">
                  收缩压128mmHg属于「正常高值」，午后有回落趋势。建议提醒爸爸晚餐少盐、饭后散步。
                </p>
              </div>
            </>
          )}

          {activeChart === "bloodOxygen" && (
            <>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-[11px] text-gray-400">爸爸当前血氧</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span style={{ fontSize: "30px", fontWeight: 800, color: "#3B82F6", lineHeight: 1 }}>97</span>
                    <span className="text-[12px] text-gray-400">%SpO₂</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-3 py-2 text-right">
                  <div className="flex items-center gap-1 justify-end mb-1">
                    <Minus className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-400">全天稳定</span>
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400">最高</p>
                      <p className="text-[13px] text-[#3B82F6]" style={{ fontWeight: 600 }}>98</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">最低</p>
                      <p className="text-[13px] text-[#60A5FA]" style={{ fontWeight: 600 }}>96</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1">
                  <span className="w-5 h-2 rounded-sm bg-[#3B82F6]/10 border border-[#3B82F6]/20" />
                  <span className="text-[10px] text-gray-400">正常区间 95-100%</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={bloodOxygenData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="oxyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <ReferenceArea y1={95} y2={100} fill="#3B82F6" fillOpacity={0.03} />
                  <ReferenceLine y={95} stroke="#3B82F6" strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#bbb" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[93, 100]} tick={{ fontSize: 10, fill: "#bbb" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "12px", padding: "8px 12px" }}
                    formatter={(value: number) => [`${value}%`, "血氧"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2.5} fill="url(#oxyGrad)" dot={false} activeDot={{ r: 5, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2.5 }} />
                </AreaChart>
              </ResponsiveContainer>

              <div className="mt-3 bg-[#F0FDF4] rounded-xl px-3 py-2 flex items-start gap-2">
                <span className="text-[13px] mt-0.5">✅</span>
                <p className="text-[12px] text-[#166534] leading-relaxed">
                  爸爸血氧全天保持在96%-98%，属于正常水平，呼吸功能良好。
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
