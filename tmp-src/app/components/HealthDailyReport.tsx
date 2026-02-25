import { motion } from "motion/react";
import {
  X,
  Shield,
  Heart,
  Droplets,
  Activity,
  Moon,
  TrendingUp,
  AlertTriangle,
  Brain,
  Share2,
  Download,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface HealthDailyReportProps {
  onClose: () => void;
}

const weeklyBPData = [
  { day: "周一", systolic: 122, status: "normal" },
  { day: "周二", systolic: 118, status: "normal" },
  { day: "周三", systolic: 130, status: "high" },
  { day: "周四", systolic: 125, status: "normal" },
  { day: "周五", systolic: 120, status: "normal" },
  { day: "周六", systolic: 128, status: "high" },
  { day: "今日", systolic: 128, status: "high" },
];

export function HealthDailyReport({ onClose }: HealthDailyReportProps) {
  const overallScore = 82;

  const vitalSummary = [
    {
      icon: <Heart className="w-4 h-4" />,
      label: "心率",
      value: "78",
      unit: "bpm",
      range: "71-89",
      status: "正常",
      statusColor: "#059669",
      statusBg: "#ECFDF5",
      color: "#FF6B6B",
      bg: "#FEF2F2",
    },
    {
      icon: <Droplets className="w-4 h-4" />,
      label: "血压",
      value: "128/82",
      unit: "mmHg",
      range: "118-130",
      status: "偏高",
      statusColor: "#D97706",
      statusBg: "#FFFBEB",
      color: "#6C5CE7",
      bg: "#F5F3FF",
    },
    {
      icon: <Activity className="w-4 h-4" />,
      label: "血氧",
      value: "97",
      unit: "%",
      range: "96-98",
      status: "正常",
      statusColor: "#059669",
      statusBg: "#ECFDF5",
      color: "#3B82F6",
      bg: "#EFF6FF",
    },
    {
      icon: <Moon className="w-4 h-4" />,
      label: "睡眠",
      value: "7.0",
      unit: "小时",
      range: "质量分95",
      status: "优秀",
      statusColor: "#059669",
      statusBg: "#ECFDF5",
      color: "#6366F1",
      bg: "#EEF2FF",
    },
  ];

  return (
    <motion.div
      className="absolute inset-0 z-50 bg-white flex flex-col"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div
        className="pt-14 pb-5 px-5 relative overflow-hidden text-white flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute bottom-4 right-20 w-16 h-16 rounded-full bg-white/5" />
        <div className="absolute top-14 left-4 w-8 h-8 rounded-full bg-white/5" />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-95 transition-transform"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Share2 className="w-3.5 h-3.5 text-white" />
              </button>
              <button className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Download className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/60 text-[11px] mb-1">2026年2月24日 · 周二</p>
              <h1 style={{ fontSize: "20px", fontWeight: 800 }}>爸爸的健康日报</h1>
              <p className="text-white/60 text-[12px] mt-1">
                基于今日全天体征数据综合分析
              </p>
            </div>

            {/* Overall Score Ring */}
            <div className="flex flex-col items-center mr-1">
              <div className="relative">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    fill="none"
                    stroke="#A5F3FC"
                    strokeWidth="5"
                    strokeDasharray={`${(overallScore / 100) * 169.6} 169.6`}
                    strokeLinecap="round"
                    transform="rotate(-90 32 32)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1, color: "#fff" }}>
                    {overallScore}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-white/60 mt-1">健康总分</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto bg-[#F5F6FA]" style={{ scrollbarWidth: "none" }}>
        <div className="px-5 pt-5 pb-8">

          {/* Overall Assessment */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-green-600" />
              </div>
              <span className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                整体评估
              </span>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              爸爸今日整体健康状况<span style={{ color: "#059669", fontWeight: 600 }}>良好</span>。心率全天平稳 (71-89bpm)，
              血氧维持在96%-98%正常水平，昨夜睡眠7小时且深睡充足。收缩压128mmHg处于正常高值边界，
              需持续关注但暂无需就医。
            </p>
          </div>

          {/* Vital Signs Summary Grid */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <p className="text-[14px] text-[#1a1a2e] mb-3" style={{ fontWeight: 700 }}>
              今日体征概览
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {vitalSummary.map((v) => (
                <div
                  key={v.label}
                  className="rounded-xl p-3 border border-gray-100/60"
                  style={{ backgroundColor: v.bg }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5" style={{ color: v.color }}>
                      {v.icon}
                      <span className="text-[12px]" style={{ fontWeight: 600 }}>{v.label}</span>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-md"
                      style={{ backgroundColor: v.statusBg, color: v.statusColor, fontWeight: 600 }}
                    >
                      {v.status}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontSize: "20px", fontWeight: 800, color: v.color, lineHeight: 1 }}>
                      {v.value}
                    </span>
                    <span className="text-[10px] text-gray-400">{v.unit}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1.5">今日范围 {v.range}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Blood Pressure Weekly Trend */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                近7日血压趋势
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#6C5CE7]" />
                  <span className="text-[10px] text-gray-400">正常</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span className="text-[10px] text-gray-400">偏高</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">收缩压 (mmHg)</p>

            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={weeklyBPData} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#aaa" }} axisLine={false} tickLine={false} />
                <YAxis domain={[100, 140]} tick={{ fontSize: 10, fill: "#aaa" }} axisLine={false} tickLine={false} />
                <Bar dataKey="systolic" radius={[4, 4, 0, 0]} maxBarSize={24}>
                  {weeklyBPData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.status === "high" ? "#F59E0B" : "#6C5CE7"}
                      fillOpacity={entry.day === "今日" ? 1 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="bg-[#FFFBEB] rounded-xl px-3 py-2 mt-2">
              <p className="text-[11px] text-[#92400E] leading-relaxed">
                本周有3天收缩压超过125mmHg，呈轻度偏高趋势。建议您关注爸爸的饮食盐分摄入，必要时可咨询医生调整用药方案。
              </p>
            </div>
          </div>

          {/* Attention Items */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <span className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                需要留意
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px]" style={{ fontWeight: 700, color: "#D97706" }}>1</span>
                </div>
                <div>
                  <p className="text-[13px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>
                    血压持续偏高
                  </p>
                  <p className="text-[12px] text-gray-500 leading-relaxed mt-0.5">
                    收缩压128mmHg属于「正常高值」，午后有所回落。近一周有3天超过125mmHg，需持续关注。
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px]" style={{ fontWeight: 700, color: "#D97706" }}>2</span>
                </div>
                <div>
                  <p className="text-[13px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>
                    下午心率短暂升高
                  </p>
                  <p className="text-[12px] text-gray-500 leading-relaxed mt-0.5">
                    15:00-16:00心率达到85-89bpm，可能与活动有关，仍在正常范围内，无需担忧。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cognitive Brief */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                认知状态
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#ECFDF5] text-[#059669] ml-auto"
                style={{ fontWeight: 600 }}
              >
                综合92分
              </span>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              今日对话分析显示，爸爸语义表达流畅 (95分)，情感表达自然 (91分)，能准确回忆近期事件，
              认知功能保持稳定，<span style={{ color: "#059669", fontWeight: 600 }}>未发现退化迹象</span>。
            </p>
          </div>

          {/* Suggestions for Child */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Heart className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                给您的建议
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                { emoji: "🍽️", text: "下次通话时提醒爸爸晚餐少放盐，可建议用醋或柠檬汁提味替代" },
                { emoji: "🚶", text: "鼓励爸爸每天饭后散步20-30分钟，有助于降低血压" },
                { emoji: "💊", text: "如血压持续3天以上>130mmHg，建议陪同爸爸复查或远程咨询医生" },
                { emoji: "💬", text: "多和爸爸聊聊过去的趣事，有助于保持认知活力和情绪愉悦" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-[#F8FAFC] rounded-xl px-3 py-2.5">
                  <span className="text-[14px] mt-0.5">{item.emoji}</span>
                  <p className="text-[12px] text-gray-600 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Next Checkup */}
          <div className="bg-gradient-to-r from-[#EEF2FF] to-[#F5F3FF] rounded-2xl p-4 border border-[#E0E7FF]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-gray-400 mb-1">下次复查提醒</p>
                <p className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                  2月28日 · 周六
                </p>
                <p className="text-[12px] text-gray-500 mt-0.5">社区卫生服务中心 · 高血压随访</p>
              </div>
              <button className="bg-[#6C5CE7] text-white text-[12px] px-4 py-2 rounded-xl" style={{ fontWeight: 600 }}>
                设置提醒
              </button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
