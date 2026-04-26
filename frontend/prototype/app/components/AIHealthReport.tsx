import { useState } from "react";
import {
  Sparkles,
  FileText,
  Brain,
  ChevronRight,
  MessageSquare,
  TrendingUp,
  Shield,
  Heart,
} from "lucide-react";

type ReportTab = "daily" | "cognitive";

interface AIHealthReportProps {
  onOpenDailyReport: () => void;
  onOpenCognitiveReport: () => void;
}

export function AIHealthReport({ onOpenDailyReport, onOpenCognitiveReport }: AIHealthReportProps) {
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowReport(true);
    }, 2000);
  };

  const handleGenerateCognitive = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      onOpenCognitiveReport();
    }, 2000);
  };

  const cognitiveMetrics = [
    { label: "语义连贯性", score: 95, color: "#10B981", icon: "🧠", desc: "优秀" },
    { label: "词汇丰富度", score: 88, color: "#3B82F6", icon: "📖", desc: "良好" },
    { label: "情感表达", score: 91, color: "#F59E0B", icon: "💬", desc: "优秀" },
    { label: "记忆关联", score: 85, color: "#8B5CF6", icon: "🔗", desc: "良好" },
  ];

  return (
    <div className="px-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#1a1a2e]" style={{ fontSize: "15px", fontWeight: 600 }}>
            AI 智能分析
          </span>
          <span
            className="bg-gradient-to-r from-[#6C5CE7] to-[#a29bfe] text-white text-[9px] px-1.5 py-0.5 rounded-md"
            style={{ fontWeight: 600 }}
          >
            AI
          </span>
        </div>
      </div>

      {/* Segmented Control */}
      <div className="bg-gray-100 rounded-xl p-1 flex gap-1 mb-3">
        <button
          onClick={() => setActiveTab("daily")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] transition-all ${
            activeTab === "daily" ? "bg-white text-[#1a1a2e] shadow-sm" : "text-gray-400"
          }`}
          style={activeTab === "daily" ? { fontWeight: 600 } : {}}
        >
          <FileText className="w-3.5 h-3.5" />
          健康日报
        </button>
        <button
          onClick={() => setActiveTab("cognitive")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] transition-all ${
            activeTab === "cognitive" ? "bg-white text-[#1a1a2e] shadow-sm" : "text-gray-400"
          }`}
          style={activeTab === "cognitive" ? { fontWeight: 600 } : {}}
        >
          <Brain className="w-3.5 h-3.5" />
          认知评估
        </button>
      </div>

      {activeTab === "daily" ? (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100/80">
          {/* Report Header */}
          <div
            className="p-4 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
          >
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute bottom-2 right-16 w-8 h-8 rounded-full bg-white/5" />

            <div className="relative flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white" style={{ fontSize: "15px", fontWeight: 700 }}>
                  爸爸的健康日报
                </h3>
                <p className="text-white/60 text-[11px] mt-0.5">
                  综合体征数据 + 认知交互记录分析生成
                </p>
              </div>
            </div>
          </div>

          <div className="p-4">
            {showReport ? (
              <>
                <div className="space-y-3 mb-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Shield className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[13px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>
                        整体评估
                      </p>
                      <p className="text-[12px] text-gray-500 leading-relaxed mt-0.5">
                        爸爸今日整体健康状况良好。心率、血氧均在正常范围，睡眠质量优秀，您无需过度担心。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[13px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>
                        需要留意
                      </p>
                      <p className="text-[12px] text-gray-500 leading-relaxed mt-0.5">
                        收缩压128mmHg略偏高，建议下次通话时提醒爸爸饮食少盐，并鼓励饭后散步。
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Heart className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[13px] text-[#1a1a2e]" style={{ fontWeight: 600 }}>
                        亲情建议
                      </p>
                      <p className="text-[12px] text-gray-500 leading-relaxed mt-0.5">
                        爸爸认知状态良好、情绪稳定。近期可以多聊聊回忆性话题，有助于维持认知活力。
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onOpenDailyReport}
                  className="w-full flex items-center justify-center gap-1 text-[12px] text-white py-2.5 rounded-xl active:scale-[0.98] transition-all"
                  style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                >
                  查看完整报告 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <p className="text-[12px] text-gray-500 leading-relaxed mb-3">
                  系统将综合爸爸今日的心率、血压、血氧、睡眠数据以及认知交互记录，生成一份简明的健康评估报告。
                </p>

                {/* Previous report summary */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-[11px] text-gray-400 mb-1">📋 昨日报告摘要</p>
                  <p className="text-[12px] text-gray-600 leading-relaxed">
                    整体健康良好，心率稳定，血压略偏高建议注意饮食，睡眠质量优秀，认知功能正常...
                  </p>
                  <button
                    onClick={onOpenDailyReport}
                    className="flex items-center gap-0.5 mt-1.5 text-[11px] text-[#6C5CE7]"
                  >
                    查看完整报告 <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-2.5 rounded-xl text-white text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-80"
                  style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      正在分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      生成今日健康日报
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-gray-100/80">
          {/* Cognitive Header */}
          <div
            className="p-4 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #059669 0%, #34D399 100%)" }}
          >
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10" />

            <div className="relative flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-white/80" />
                  <span className="text-white" style={{ fontSize: "15px", fontWeight: 700 }}>
                    爸爸的认知评估
                  </span>
                </div>
                <p className="text-white/60 text-[11px] mt-1">基于日常对话的 NLP 智能分析</p>
              </div>
              <div className="relative">
                <svg width="52" height="52" viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                  <circle
                    cx="26"
                    cy="26"
                    r="22"
                    fill="none"
                    stroke="#A7F3D0"
                    strokeWidth="4"
                    strokeDasharray={`${(92 / 100) * 138.2} 138.2`}
                    strokeLinecap="round"
                    transform="rotate(-90 26 26)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-white" style={{ fontSize: "18px", fontWeight: 800, lineHeight: 1 }}>
                    92
                  </span>
                  <span className="text-[7px] text-white/50 mt-0.5">综合分</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {cognitiveMetrics.map((metric) => (
                <div key={metric.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px]">{metric.icon}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-md"
                        style={{
                          backgroundColor: `${metric.color}15`,
                          color: metric.color,
                          fontWeight: 500,
                        }}
                      >
                        {metric.desc}
                      </span>
                      <span className="text-[13px]" style={{ fontWeight: 700, color: metric.color }}>
                        {metric.score}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">{metric.label}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${metric.score}%`,
                        backgroundColor: metric.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Interaction Summary */}
            <div className="bg-[#F5F3FF] rounded-xl p-3 mb-3">
              <div className="flex items-start gap-2">
                <MessageSquare className="w-4 h-4 text-[#7C3AED] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">近期交互评估</p>
                  <p className="text-[12px] text-gray-600 leading-relaxed">
                    爸爸近日对话中语义表达清晰，能够准确回忆近期事件，逻辑连贯性良好。认知功能未发现退化迹象，您可以放心。
                  </p>
                </div>
              </div>
            </div>

            {/* Actionable advice for child */}
            <div className="bg-[#EFF6FF] rounded-xl p-3 mb-3">
              <div className="flex items-start gap-2">
                <Heart className="w-4 h-4 text-[#3B82F6] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">陪伴建议</p>
                  <p className="text-[12px] text-gray-600 leading-relaxed">
                    记忆关联得分85分，建议多和爸爸聊聊往事和家庭趣事，有助于巩固长期记忆，增进亲子情感。
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerateCognitive}
              disabled={isGenerating}
              className="w-full py-2.5 rounded-xl text-white text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-80"
              style={{ background: "linear-gradient(135deg, #059669 0%, #34D399 100%)" }}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  查看详细认知报告
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
