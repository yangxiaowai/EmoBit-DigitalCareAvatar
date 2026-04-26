import { ShieldCheck, AlertTriangle, Clock, Wifi, ChevronDown } from "lucide-react";

type OverallStatus = "good" | "attention" | "alert";

interface StatusBannerProps {
  status: OverallStatus;
  alertCount: number;
  lastSync: string;
}

const statusConfig: Record<
  OverallStatus,
  { label: string; desc: string; gradient: string; icon: React.ReactNode; pulse: boolean }
> = {
  good: {
    label: "今日状态良好",
    desc: "爸爸各项体征均在正常范围",
    gradient: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
    icon: <ShieldCheck className="w-5 h-5 text-white" />,
    pulse: false,
  },
  attention: {
    label: "需要您关注",
    desc: "爸爸部分指标偏离正常范围",
    gradient: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)",
    icon: <AlertTriangle className="w-5 h-5 text-white" />,
    pulse: true,
  },
  alert: {
    label: "健康预警",
    desc: "检测到异常指标，请及时了解",
    gradient: "linear-gradient(135deg, #EF4444 0%, #F87171 100%)",
    icon: <AlertTriangle className="w-5 h-5 text-white" />,
    pulse: true,
  },
};

export function StatusBanner({ status, alertCount, lastSync }: StatusBannerProps) {
  const config = statusConfig[status];

  return (
    <div className="px-5 mb-3">
      {/* Parent selector bar */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
          >
            <span style={{ fontSize: "14px", fontWeight: 700 }}>爸</span>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-[15px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                爸爸的健康
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <span className="text-[11px] text-gray-400">75岁 · 高血压病史</span>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 text-right">
          <p>2026年2月24日</p>
          <p className="text-[10px] mt-0.5">周二</p>
        </div>
      </div>

      {/* Status card */}
      <div
        className="rounded-2xl p-4 text-white relative overflow-hidden"
        style={{ background: config.gradient }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute bottom-1 right-14 w-10 h-10 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center ${
                  config.pulse ? "animate-pulse" : ""
                }`}
              >
                {config.icon}
              </div>
              <div>
                <p style={{ fontSize: "16px", fontWeight: 700 }}>{config.label}</p>
                <p className="text-[11px] text-white/70 mt-0.5">{config.desc}</p>
              </div>
            </div>
            {alertCount > 0 && (
              <div className="bg-white/25 rounded-full px-2.5 py-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span className="text-[11px]" style={{ fontWeight: 600 }}>
                  {alertCount}项
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-white/15">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-white/60" />
              <span className="text-[11px] text-white/70">手环在线</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-white/60" />
              <span className="text-[11px] text-white/70">同步于 {lastSync}</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
              <span className="text-[11px] text-white/70">实时监测中</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
