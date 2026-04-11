import React from 'react';
import { X, Phone, MapPin, MessageSquare, Volume2, CheckCircle, Wand2, Camera, Clock, AlertCircle, Activity } from 'lucide-react';
import type { RiskType, RiskMetric, SystemAction, RecommendedAction } from '../types';
import type { WanderingState } from '../../../services/wanderingService';
import type { LocationAutomationState } from '../../../services/locationAutomationService';
import type { MedicationReminder, MedicationLog } from '../../../services/medicationService';
import type { SundowningRiskSnapshot, SundowningInterventionPlan } from '../../../services/sundowningService';
import type { LogEntry } from '../../../types';
import type { ScenarioElderMessage, ScenarioElderAction } from '../../../src/core/scenarioEvents';

interface RiskDetailModalProps {
  type: RiskType | null;
  isOpen: boolean;
  onClose: () => void;
  // 数据依赖
  wanderingState: WanderingState | null;
  locationState: LocationAutomationState | null;
  medicationReminder: MedicationReminder | null;
  medicationLogs: MedicationLog[];
  sundowningSnapshot: SundowningRiskSnapshot | null;
  sundowningIntervention: SundowningInterventionPlan | null;
  logs: LogEntry[];
  elderMessage: ScenarioElderMessage | null;
  elderAction: ScenarioElderAction | null;
}

// 提取风险指标
function getRiskMetrics(type: RiskType, data: any): RiskMetric[] {
  switch (type) {
    case 'wandering':
      if (!data.wanderingState) return [];
      return [
        {
          label: '距离家',
          value: `${Math.round(data.wanderingState.distanceFromHome)}米`,
          threshold: '100米',
          status: data.wanderingState.outsideSafeZone ? 'danger' : 'safe'
        },
        {
          label: '置信度',
          value: `${Math.round(data.wanderingState.confidence * 100)}%`,
          threshold: '70%',
          status: data.wanderingState.confidence > 0.7 ? 'danger' : 'safe'
        },
        {
          label: '游荡类型',
          value: data.wanderingState.wanderingType === 'none' ? '正常' : data.wanderingState.wanderingType,
          threshold: 'none',
          status: data.wanderingState.isWandering ? 'warning' : 'safe'
        },
        {
          label: '持续时间',
          value: `${Math.round(data.wanderingState.duration / 60)}分钟`,
          threshold: '30分钟',
          status: data.wanderingState.duration > 1800 ? 'danger' : 'safe'
        },
      ];

    case 'medication':
      const missedCount = data.medicationLogs.filter((l: MedicationLog) => l.status === 'missed').length;
      const takenCount = data.medicationLogs.filter((l: MedicationLog) => l.status === 'taken').length;
      return [
        {
          label: '今日服药',
          value: `${takenCount}/${data.medicationLogs.length}`,
          threshold: '全部',
          status: missedCount > 0 ? 'warning' : 'safe'
        },
        {
          label: '延后次数',
          value: `${data.medicationReminder?.snoozeCount || 0}次`,
          threshold: '0次',
          status: (data.medicationReminder?.snoozeCount || 0) > 2 ? 'danger' : 'safe'
        },
        {
          label: '当前状态',
          value: data.medicationReminder ? '待服药' : '已完成',
          threshold: '按时',
          status: data.medicationReminder ? 'warning' : 'safe'
        },
      ];

    case 'cognitive':
      if (!data.sundowningSnapshot) return [];
      return [
        {
          label: '风险指数',
          value: `${data.sundowningSnapshot.riskScore}`,
          threshold: '50',
          status: data.sundowningSnapshot.riskLevel === 'high' ? 'danger' : data.sundowningSnapshot.riskLevel === 'medium' ? 'warning' : 'safe'
        },
        {
          label: '困惑程度',
          value: `${data.sundowningSnapshot.behaviorSummary.confusionScore}`,
          threshold: '50',
          status: data.sundowningSnapshot.behaviorSummary.confusionScore > 50 ? 'danger' : 'safe'
        },
        {
          label: '重复提问',
          value: `${data.sundowningSnapshot.behaviorSummary.repeatedQuestions}次`,
          threshold: '3次',
          status: data.sundowningSnapshot.behaviorSummary.repeatedQuestions > 3 ? 'warning' : 'safe'
        },
        {
          label: '焦虑程度',
          value: `${data.sundowningSnapshot.behaviorSummary.agitationScore}`,
          threshold: '50',
          status: data.sundowningSnapshot.behaviorSummary.agitationScore > 50 ? 'danger' : 'safe'
        },
      ];
  }
}

// 提取系统动作
function getSystemActions(type: RiskType, logs: LogEntry[]): SystemAction[] {
  const relevantModules: Record<RiskType, string[]> = {
    wandering: ['DBSCAN', 'GEOFENCE', 'LOCATION', 'OPENCLAW'],
    medication: ['MEDICATION', 'REMINDER', 'OPENCLAW'],
    cognitive: ['SUNDOWNING', 'INTERVENTION', 'COGNITIVE', 'OPENCLAW'],
  };

  return logs
    .filter(log => relevantModules[type].some(m => log.module.toUpperCase().includes(m)))
    .slice(0, 10);
}

// 提取建议操作
function getRecommendedActions(type: RiskType, onClose: () => void): RecommendedAction[] {
  switch (type) {
    case 'wandering':
      return [
        { icon: Phone, label: '立即致电老人', handler: () => { alert('拨打电话功能'); }, priority: 'high' },
        { icon: MapPin, label: '查看实时位置', handler: () => { onClose(); /* 跳转定位页 */ }, priority: 'high' },
        { icon: MessageSquare, label: '发送语音提醒', handler: () => { alert('发送提醒功能'); }, priority: 'medium' },
      ];
    case 'medication':
      return [
        { icon: Phone, label: '致电提醒服药', handler: () => { alert('拨打电话功能'); }, priority: 'high' },
        { icon: Volume2, label: '发送语音提醒', handler: () => { alert('发送提醒功能'); }, priority: 'high' },
        { icon: CheckCircle, label: '标记已服药', handler: () => { alert('标记服药功能'); }, priority: 'medium' },
      ];
    case 'cognitive':
      return [
        { icon: Phone, label: '视频通话安抚', handler: () => { alert('视频通话功能'); }, priority: 'high' },
        { icon: Wand2, label: '启动主动干预', handler: () => { alert('启动干预功能'); }, priority: 'high' },
        { icon: Camera, label: '播放家庭相册', handler: () => { alert('播放相册功能'); }, priority: 'medium' },
      ];
  }
}

function getTitle(type: RiskType): string {
  switch (type) {
    case 'wandering':
      return '走失/游荡风险详情';
    case 'medication':
      return '服药状态详情';
    case 'cognitive':
      return '认知/黄昏状态详情';
  }
}

function getMetricStatusStyles(status: RiskMetric['status']): string {
  switch (status) {
    case 'danger':
      return 'bg-rose-50 border-rose-200 text-rose-700';
    case 'warning':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'safe':
      return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  }
}

function getLogLevelStyles(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'bg-rose-100 text-rose-700';
    case 'warn':
      return 'bg-amber-100 text-amber-700';
    case 'success':
      return 'bg-emerald-100 text-emerald-700';
    case 'info':
      return 'bg-blue-100 text-blue-700';
  }
}

function getPriorityStyles(priority: RecommendedAction['priority']): string {
  switch (priority) {
    case 'high':
      return 'bg-rose-600 hover:bg-rose-700 text-white';
    case 'medium':
      return 'bg-blue-600 hover:bg-blue-700 text-white';
    case 'low':
      return 'bg-slate-600 hover:bg-slate-700 text-white';
  }
}

const RiskDetailModal: React.FC<RiskDetailModalProps> = ({
  type,
  isOpen,
  onClose,
  wanderingState,
  locationState,
  medicationReminder,
  medicationLogs,
  sundowningSnapshot,
  sundowningIntervention,
  logs,
  elderMessage,
  elderAction,
}) => {
  if (!isOpen || !type) return null;

  const data = {
    wanderingState,
    locationState,
    medicationReminder,
    medicationLogs,
    sundowningSnapshot,
    sundowningIntervention,
  };

  const metrics = getRiskMetrics(type, data);
  const systemActions = getSystemActions(type, logs);
  const recommendedActions = getRecommendedActions(type, onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">{getTitle(type)}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-slate-600" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. 风险评估区块 */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">风险评估</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map((metric, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border-2 ${getMetricStatusStyles(metric.status)}`}
                >
                  <p className="text-xs font-medium mb-1">{metric.label}</p>
                  <p className="text-2xl font-bold mb-1">{metric.value}</p>
                  <p className="text-xs opacity-75">阈值: {metric.threshold}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 2. 系统动作记录区块 */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">系统动作记录</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {systemActions.length > 0 ? (
                systemActions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getLogLevelStyles(action.level)}`}>
                      {action.module}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-slate-800">{action.message}</p>
                      <p className="text-xs text-slate-500 mt-1">{action.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">暂无系统动作记录</p>
              )}
            </div>
          </section>

          {/* 3. 老人端状态区块 */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">老人端状态</h3>
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs font-semibold text-blue-700 mb-2">当前收到的消息</p>
                <p className="text-sm text-blue-900">
                  {elderMessage?.text || '暂无提示'}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <p className="text-xs font-semibold text-purple-700 mb-2">当前执行的动作</p>
                <p className="text-sm text-purple-900">
                  {elderAction?.action || '系统待命'}
                </p>
              </div>
            </div>
          </section>

          {/* 4. 建议操作区块 */}
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">建议操作</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendedActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <button
                    key={index}
                    onClick={action.handler}
                    className={`flex items-center gap-3 p-4 rounded-xl font-semibold transition-all ${getPriorityStyles(action.priority)}`}
                  >
                    <Icon size={20} />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RiskDetailModal;
