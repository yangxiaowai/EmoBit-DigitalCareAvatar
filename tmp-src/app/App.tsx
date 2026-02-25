import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { StatusBanner } from "./components/StatusBanner";
import { AlertCard } from "./components/AlertCard";
import { VitalCharts } from "./components/VitalCharts";
import { SleepAnalysis } from "./components/SleepAnalysis";
import { AIHealthReport } from "./components/AIHealthReport";
import { BottomNav } from "./components/BottomNav";
import { HealthDailyReport } from "./components/HealthDailyReport";
import { CognitiveReport } from "./components/CognitiveReport";

type ReportOverlay = "none" | "daily" | "cognitive";

export default function App() {
  const [activeTab, setActiveTab] = useState("health");
  const [reportOverlay, setReportOverlay] = useState<ReportOverlay>("none");

  return (
    <div className="size-full flex items-center justify-center bg-[#E8ECF4]">
      {/* Phone Frame */}
      <div className="w-[390px] h-[844px] bg-[#F5F6FA] rounded-[44px] shadow-2xl overflow-hidden relative border border-gray-200/60">
        {/* Status Bar Notch */}
        <div className="h-[52px] bg-transparent flex items-end justify-center pb-1 absolute top-0 left-0 right-0 z-20">
          <div className="w-[120px] h-[34px] bg-black rounded-full" />
        </div>

        {/* Scrollable Content */}
        <div
          className="h-[calc(100%-56px)] overflow-y-auto pt-[58px]"
          style={{ scrollbarWidth: "none" }}
        >
          {/* 1. 被监护人信息 + 整体健康状态 */}
          <StatusBanner status="attention" alertCount={1} lastSync="16:08" />

          {/* 2. 异常告警 — 优先展示需要子女关注的指标 */}
          <AlertCard />

          {/* 3. 实时体征监测 — 心率/血压/血氧趋势图 */}
          <VitalCharts />

          {/* 4. 昨夜睡眠分析 */}
          <SleepAnalysis />

          {/* 5. AI 智能分析 — 健康日报 + 认知评估 */}
          <AIHealthReport
            onOpenDailyReport={() => setReportOverlay("daily")}
            onOpenCognitiveReport={() => setReportOverlay("cognitive")}
          />

          {/* Bottom spacing */}
          <div className="h-24" />
        </div>

        {/* Bottom Navigation */}
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Report Overlays */}
        <AnimatePresence>
          {reportOverlay === "daily" && (
            <HealthDailyReport
              key="daily-report"
              onClose={() => setReportOverlay("none")}
            />
          )}
          {reportOverlay === "cognitive" && (
            <CognitiveReport
              key="cognitive-report"
              onClose={() => setReportOverlay("none")}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
