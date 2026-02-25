import { Moon, ChevronRight, ArrowUpRight } from "lucide-react";

interface SleepStage {
  label: string;
  hours: number;
  color: string;
  desc: string;
}

export function SleepAnalysis() {
  const sleepScore = 95;
  const totalSleep = "7h 0m";
  const bedtime = "22:30";
  const wakeTime = "05:30";
  const yesterdayDiff = "+0.5h";

  const stages: SleepStage[] = [
    { label: "深睡", hours: 2.5, color: "#3730A3", desc: "充足" },
    { label: "浅睡", hours: 3.5, color: "#818CF8", desc: "正常" },
    { label: "REM", hours: 1.0, color: "#C4B5FD", desc: "正常" },
  ];

  const totalHours = stages.reduce((s, v) => s + v.hours, 0);

  const timelineBlocks = [
    { type: "light", w: 12 },
    { type: "deep", w: 18 },
    { type: "light", w: 8 },
    { type: "rem", w: 10 },
    { type: "deep", w: 16 },
    { type: "light", w: 14 },
    { type: "rem", w: 8 },
    { type: "light", w: 14 },
  ];

  const typeColor: Record<string, string> = {
    deep: "#3730A3",
    light: "#818CF8",
    rem: "#C4B5FD",
  };

  const scoreLabel = sleepScore >= 90 ? "优秀" : sleepScore >= 70 ? "一般" : "较差";

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[#1a1a2e]" style={{ fontSize: "15px", fontWeight: 600 }}>
          昨夜睡眠
        </span>
        <button className="flex items-center gap-0.5 text-[12px] text-[#6C5CE7]">
          查看详情 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100/80">
        {/* Header */}
        <div
          className="p-4 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #4338CA 0%, #6366F1 50%, #818CF8 100%)" }}
        >
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Moon className="w-4 h-4 text-white/80" />
                <span className="text-[12px] text-white/70">
                  入睡 {bedtime} — 起床 {wakeTime}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1 }}>{totalSleep}</span>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <ArrowUpRight className="w-3 h-3 text-[#A5F3FC]" />
                <span className="text-[11px] text-[#A5F3FC]">较前一晚 {yesterdayDiff}</span>
              </div>
            </div>

            {/* Score Ring */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <svg width="56" height="56" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
                  <circle
                    cx="28"
                    cy="28"
                    r="23"
                    fill="none"
                    stroke="#A5F3FC"
                    strokeWidth="5"
                    strokeDasharray={`${(sleepScore / 100) * 144.5} 144.5`}
                    strokeLinecap="round"
                    transform="rotate(-90 28 28)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white" style={{ fontSize: "18px", fontWeight: 800, lineHeight: 1 }}>
                    {sleepScore}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-white/60 mt-1">{scoreLabel}</span>
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Sleep Timeline */}
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-gray-400">睡眠阶段分布</p>
            <div className="flex gap-3">
              {stages.map((s) => (
                <div key={s.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[10px] text-gray-400">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-[2px] mb-4 h-6 rounded-lg overflow-hidden">
            {timelineBlocks.map((block, i) => (
              <div
                key={i}
                className="h-full rounded-sm"
                style={{
                  width: `${block.w}%`,
                  backgroundColor: typeColor[block.type],
                }}
              />
            ))}
          </div>

          {/* Stages breakdown */}
          <div className="flex gap-2 mb-3">
            {stages.map((stage) => (
              <div key={stage.label} className="flex-1 bg-gray-50 rounded-xl p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-gray-500">{stage.label}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${stage.color}10`,
                      color: stage.color,
                      fontWeight: 500,
                    }}
                  >
                    {stage.desc}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span style={{ fontSize: "16px", fontWeight: 700, color: stage.color }}>
                    {stage.hours}h
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {Math.round((stage.hours / totalHours) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* AI tip */}
          <div className="bg-[#F0FDF4] rounded-xl px-3 py-2.5 flex items-start gap-2">
            <span className="text-[13px] mt-0.5">💡</span>
            <p className="text-[12px] text-[#166534] leading-relaxed">
              爸爸昨夜睡眠质量优秀，深睡占比35.7%高于同龄平均水平，作息时间规律，您无需担心。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
