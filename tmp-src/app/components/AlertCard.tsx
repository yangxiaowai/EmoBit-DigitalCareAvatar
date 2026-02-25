import { AlertTriangle, ChevronRight, X, Bell } from "lucide-react";
import { useState } from "react";

interface AlertItem {
  id: string;
  type: "warning" | "danger";
  metric: string;
  message: string;
  value: string;
  normalRange: string;
  time: string;
  suggestion: string;
  parentAction: string;
}

export function AlertCard() {
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: "bp-high",
      type: "warning",
      metric: "血压",
      message: "收缩压偏高",
      value: "128/82 mmHg",
      normalRange: "90-120 / 60-80",
      time: "16:08",
      suggestion: "目前处于「正常高值」范围，暂无需就医，请持续观察。",
      parentAction: "可提醒爸爸今晚清淡饮食、饭后散步20分钟",
    },
  ]);

  const dismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Bell className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[13px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>
          需要您关注
        </span>
      </div>

      <div className="space-y-2.5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="bg-white rounded-2xl overflow-hidden border shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            style={{
              borderColor: alert.type === "danger" ? "#FECACA" : "#FDE68A",
            }}
          >
            {/* Alert Header */}
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{
                background:
                  alert.type === "danger"
                    ? "linear-gradient(135deg, #FEF2F2, #FEE2E2)"
                    : "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: alert.type === "danger" ? "#EF4444" : "#F59E0B",
                  }}
                />
                <span
                  className="text-[13px]"
                  style={{
                    fontWeight: 600,
                    color: alert.type === "danger" ? "#DC2626" : "#D97706",
                  }}
                >
                  {alert.metric} · {alert.message}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">{alert.time}</span>
                <button
                  onClick={() => dismiss(alert.id)}
                  className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Alert Body */}
            <div className="px-4 py-3">
              {/* Values comparison */}
              <div className="flex gap-3 mb-3">
                <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] text-gray-400">检测值</span>
                  <p
                    className="mt-1"
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: alert.type === "danger" ? "#DC2626" : "#D97706",
                    }}
                  >
                    {alert.value}
                  </p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-2.5 text-center">
                  <span className="text-[10px] text-gray-400">正常范围</span>
                  <p className="text-[15px] text-gray-600 mt-1" style={{ fontWeight: 600 }}>
                    {alert.normalRange}
                  </p>
                </div>
              </div>

              {/* Interpretation */}
              <div className="bg-[#F0FDF4] rounded-xl px-3 py-2 mb-2">
                <p className="text-[12px] text-[#166534] leading-relaxed">
                  📋 {alert.suggestion}
                </p>
              </div>

              {/* Actionable suggestion for child */}
              <div className="bg-[#EFF6FF] rounded-xl px-3 py-2 mb-2.5">
                <p className="text-[12px] text-[#1E40AF] leading-relaxed">
                  💡 {alert.parentAction}
                </p>
              </div>

              <button
                className="flex items-center gap-0.5 text-[12px] text-[#6C5CE7]"
                style={{ fontWeight: 500 }}
              >
                查看血压变化趋势 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
