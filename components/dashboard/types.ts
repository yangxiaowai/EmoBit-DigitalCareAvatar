import type { LucideIcon } from 'lucide-react';

export type RiskLevel = 'high' | 'medium' | 'low';
export type RiskType = 'wandering' | 'medication' | 'cognitive';

export interface RiskCardProps {
  onOpenDetail: (type: RiskType) => void;
}

export interface RiskMetric {
  label: string;
  value: string;
  threshold: string;
  status: 'danger' | 'warning' | 'safe';
}

export interface SystemAction {
  timestamp: string;
  module: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

export interface RecommendedAction {
  icon: LucideIcon;
  label: string;
  handler: () => void;
  priority: 'high' | 'medium' | 'low';
}
