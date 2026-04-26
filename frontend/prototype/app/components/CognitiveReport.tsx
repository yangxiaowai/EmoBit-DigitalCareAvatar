import { motion } from "motion/react";
import {
  X,
  Brain,
  Heart,
  TrendingUp,
  MessageSquare,
  Share2,
  Download,
  Clock,
  Smile,
  BookOpen,
  Link2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface CognitiveReportProps {
  onClose: () => void;
}

const radarData = [
  { subject: "语义连贯", score: 95, fullMark: 100 },
  { subject: "词汇丰富", score: 88, fullMark: 100 },
  { subject: "情感表达", score: 91, fullMark: 100 },
  { subject: "记忆关联", score: 85, fullMark: 100 },
  { subject: "逻辑推理", score: 90, fullMark: 100 },
  { subject: "注意力", score: 87, fullMark: 100 },
];

const weeklyTrend = [
  { day: "2/18", score: 89 },
  { day: "2/19", score: 91 },
  { day: "2/20", score: 90 },
  { day: "2/21", score: 92 },
  { day: "2/22", score: 91 },
  { day: "2/23", score: 93 },
  { day: "今日", score: 92 },
];

const detailedMetrics = [
  {
    icon: <Brain className="w-4 h-4" />,
    label: "语义连贯性",
    score: 95,
    color: "#10B981",
    bg: "#ECFDF5",
    desc: "优秀",
    detail: "对话中上下文衔接自然，能准确理解并回应复杂话题，逻辑链条完整。",
    trend: "+2",
    trendDir: "up" as const,
  },
  {
    icon: <BookOpen className="w-4 h-4" />,
    label: "词汇丰富度",
    score: 88,
    color: "#3B82F6",
    bg: "#EFF6FF",
    desc: "良好",
    detail: "用词多样化程度较高，能使用成语和俗语，偶尔出现词汇重复现象。",
    trend: "+1",
    trendDir: "up" as const,
  },
  {
    icon: <Smile className="w-4 h-4" />,
    label: "情感表达",
    score: 91,
    color: "#F59E0B",
    bg: "#FFFBEB",
    desc: "优秀",
    detail: "情绪表达自然丰富，对话中表现出积极情感，共情能力正常。",
    trend: "0",
    trendDir: "stable" as const,
  },
  {
    icon: <Link2 className="w-4 h-4" />,
    label: "记忆关联",
    score: 85,
    color: "#8B5CF6",
    bg: "#F5F3FF",
    desc: "良好",
    detail: "能回忆近期事件并与过去经历建立关联，长期记忆稳定，短期记忆偶有模糊。",
    trend: "-1",
    trendDir: "down" as const,
  },
];

const conversationSamples = [
  {
    time: "09:15",
    topic: "早餐回忆",
    snippet: "「今天早上吃了小米粥和鸡蛋，昨天好像也是…不对，昨天吃的是面条。」",
    analysis: "能自发纠正记忆偏差，短期记忆校验能力良好",
    score: "A",
    scoreColor: "#10B981",
  },
  {
    time: "11:30",
    topic: "家庭话题",
    snippet: "「小明上次来看我是上周六吧，带了我最喜欢的橘子，他小时候也最爱吃橘子。」",
    analysis: "时间定位准确，能关联近期与远期记忆",
    score: "A+",
    scoreColor: "#10B981",
  },
  {
    time: "14:20",
    topic: "新闻讨论",
    snippet: "「今天新闻说…那个什么来着…哦对，说的是社区要建新的健身设施。」",
    analysis: "出现短暂的词汇提取延迟，但能自行回忆，属于正常现象",
    score: "B+",
    scoreColor: "#3B82F6",
  },
];

export function CognitiveReport({ onClose }: CognitiveReportProps) {
  const overallScore = 92;

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
        style={{ background: "linear-gradient(135deg, #059669 0%, #34D399 100%)" }}
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute bottom-4 right-20 w-16 h-16 rounded-full bg-white/5" />

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
              <h1 style={{ fontSize: "20px", fontWeight: 800 }}>爸爸的认知评估</h1>
              <p className="text-white/60 text-[12px] mt-1">
                基于今日对话的 NLP 深度分析
              </p>
            </div>

            {/* Score Ring */}
            <div className="flex flex-col items-center mr-1">
              <div className="relative">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    fill="none"
                    stroke="#A7F3D0"
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
              <span className="text-[10px] text-white/60 mt-1">认知总分</span>
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
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                综合评估
              </span>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              爸爸今日认知功能评估为<span style={{ color: "#059669", fontWeight: 600 }}>优秀</span> (92/100)，
              六维度指标均在85分以上。语义连贯性和情感表达表现突出，记忆关联能力稳定，
              <span style={{ color: "#059669", fontWeight: 600 }}>未检测到认知退化迹象</span>。
              与上周相比，整体水平保持稳定，您可以放心。
            </p>
          </div>

          {/* Radar Chart */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <p className="text-[14px] text-[#1a1a2e] mb-2" style={{ fontWeight: 700 }}>
              六维认知雷达图
            </p>
            <p className="text-[11px] text-gray-400 mb-1">各维度得分 (满分100)</p>

            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                />
                <Radar
                  dataKey="score"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#059669" }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Metrics */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <p className="text-[14px] text-[#1a1a2e] mb-3" style={{ fontWeight: 700 }}>
              各维度详细分析
            </p>

            <div className="space-y-3">
              {detailedMetrics.map((m) => (
                <div key={m.label} className="rounded-xl p-3 border border-gray-100/60" style={{ backgroundColor: m.bg }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2" style={{ color: m.color }}>
                      {m.icon}
                      <span className="text-[13px]" style={{ fontWeight: 600 }}>{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: `${m.color}18`, color: m.color, fontWeight: 600 }}
                      >
                        {m.desc}
                      </span>
                      <span className="text-[15px]" style={{ fontWeight: 800, color: m.color }}>
                        {m.score}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-white/80 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${m.score}%`, backgroundColor: m.color }}
                    />
                  </div>

                  <p className="text-[12px] text-gray-600 leading-relaxed">{m.detail}</p>

                  <div className="flex items-center gap-1 mt-1.5">
                    <TrendingUp
                      className="w-3 h-3"
                      style={{
                        color: m.trendDir === "up" ? "#059669" : m.trendDir === "down" ? "#D97706" : "#9CA3AF",
                      }}
                    />
                    <span
                      className="text-[10px]"
                      style={{
                        color: m.trendDir === "up" ? "#059669" : m.trendDir === "down" ? "#D97706" : "#9CA3AF",
                        fontWeight: 500,
                      }}
                    >
                      较昨日 {m.trend === "0" ? "持平" : `${m.trend}分`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Trend */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                近7日认知趋势
              </p>
              <span className="text-[11px] text-[#059669] bg-[#ECFDF5] px-2 py-0.5 rounded-md" style={{ fontWeight: 500 }}>
                稳定
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mb-3">综合评分走势</p>

            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={weeklyTrend} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#aaa" }} axisLine={false} tickLine={false} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: "#aaa" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", fontSize: "12px", padding: "8px 12px" }}
                  formatter={(value: number) => [`${value}分`, "认知评分"]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#059669", stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#059669", stroke: "#fff", strokeWidth: 2.5 }}
                />
              </LineChart>
            </ResponsiveContainer>

            <div className="bg-[#ECFDF5] rounded-xl px-3 py-2 mt-2">
              <p className="text-[11px] text-[#166534] leading-relaxed">
                近一周认知评分在89-93分之间波动，整体平稳，无下降趋势，表明认知功能维持良好。
              </p>
            </div>
          </div>

          {/* Conversation Samples */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <span className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                对话样本分析
              </span>
            </div>

            <div className="space-y-3">
              {conversationSamples.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-[11px] text-gray-400">{s.time}</span>
                      <span className="text-[11px] text-gray-500" style={{ fontWeight: 500 }}>
                        {s.topic}
                      </span>
                    </div>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-md text-white"
                      style={{ backgroundColor: s.scoreColor, fontWeight: 700 }}
                    >
                      {s.score}
                    </span>
                  </div>

                  <div className="bg-white rounded-lg px-3 py-2 mb-2 border border-gray-100">
                    <p className="text-[12px] text-gray-700 leading-relaxed italic">{s.snippet}</p>
                  </div>

                  <div className="flex items-start gap-1.5">
                    <ArrowRight className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-gray-500 leading-relaxed">{s.analysis}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100/60">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Heart className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-[14px] text-[#1a1a2e]" style={{ fontWeight: 700 }}>
                陪伴与沟通建议
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  emoji: "💬",
                  title: "聊聊往事",
                  text: "记忆关联85分，建议多和爸爸回忆家庭趣事、年轻时的经历，有助于巩固长期记忆网络",
                },
                {
                  emoji: "🧩",
                  title: "益智互动",
                  text: "可以一起玩简单的猜谜或数字接龙游戏，帮助维持逻辑推理和注意力水平",
                },
                {
                  emoji: "📰",
                  title: "新闻讨论",
                  text: "鼓励爸爸分享对新闻事件的看法，锻炼信息提取和语义组织能力",
                },
                {
                  emoji: "🎵",
                  title: "音乐记忆",
                  text: "播放爸爸喜欢的老歌，音乐能有效激活长期记忆和情感回路",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-[#F8FAFC] rounded-xl px-3 py-2.5">
                  <span className="text-[14px] mt-0.5">{item.emoji}</span>
                  <div>
                    <p className="text-[12px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>{item.title}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-gray-100 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 leading-relaxed text-center">
              本报告由 AI 基于对话数据自动生成，仅供参考。如发现认知能力明显变化，请及时咨询专业医生。
            </p>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
