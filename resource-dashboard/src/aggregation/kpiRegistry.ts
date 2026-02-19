import type { KPICardKey, KPIResults } from '../types';

export type KPIFormat = 'percent' | 'hours' | 'count' | 'decimal';

export interface KPIDefinition {
  key: KPICardKey;
  label: string;
  shortLabel: string;
  format: KPIFormat;
  thresholds: {
    green: number;
    yellow: number;
    invertColor?: boolean;
  };
  description: string;
  category: 'utilization' | 'workMix' | 'teamHealth' | 'throughput';
  getValue: (results: KPIResults) => number;
  applicableToSingleProject: boolean;
}

export const KPI_REGISTRY: Record<KPICardKey, KPIDefinition> = {
  teamUtilization: {
    key: 'teamUtilization',
    label: 'Team Utilization',
    shortLabel: 'Utilization',
    format: 'percent',
    thresholds: { green: 0.85, yellow: 1.0, invertColor: false },
    description: 'Productive hours as a percentage of total team capacity (engineers x standard monthly hours).',
    category: 'utilization',
    getValue: r => r.teamUtilization,
    applicableToSingleProject: true,
  },
  npdFocus: {
    key: 'npdFocus',
    label: 'NPD Focus',
    shortLabel: 'NPD Focus',
    format: 'percent',
    thresholds: { green: 0.6, yellow: 0.4, invertColor: false },
    description: 'Percentage of productive hours spent on New Product Development projects.',
    category: 'workMix',
    getValue: r => r.npdFocus,
    applicableToSingleProject: false,
  },
  firefightingLoad: {
    key: 'firefightingLoad',
    label: 'Firefighting Load',
    shortLabel: 'Firefighting',
    format: 'percent',
    thresholds: { green: 0.1, yellow: 0.2, invertColor: true },
    description: 'Percentage of productive hours spent on unplanned/firefighting work.',
    category: 'workMix',
    getValue: r => r.firefightingLoad,
    applicableToSingleProject: false,
  },
  activeEngineers: {
    key: 'activeEngineers',
    label: 'Active Engineers',
    shortLabel: 'Engineers',
    format: 'count',
    thresholds: { green: 999, yellow: 999, invertColor: false },
    description: 'Number of engineers who logged productive hours this month.',
    category: 'utilization',
    getValue: r => r.activeEngineers,
    applicableToSingleProject: true,
  },
  totalHoursLogged: {
    key: 'totalHoursLogged',
    label: 'Total Hours Logged',
    shortLabel: 'Total Hours',
    format: 'hours',
    thresholds: { green: 999999, yellow: 999999, invertColor: false },
    description: 'Total productive hours (NPD + Sustaining + Sprint), excluding admin and out-of-office.',
    category: 'utilization',
    getValue: r => r.totalHoursLogged,
    applicableToSingleProject: true,
  },
  projectsTouched: {
    key: 'projectsTouched',
    label: 'Projects Touched',
    shortLabel: 'Projects',
    format: 'count',
    thresholds: { green: 999, yellow: 999, invertColor: false },
    description: 'Number of distinct project codes with logged hours, excluding admin and OOO.',
    category: 'throughput',
    getValue: r => r.projectsTouched,
    applicableToSingleProject: false,
  },
  busFactorRisk: {
    key: 'busFactorRisk',
    label: 'Bus Factor Risk',
    shortLabel: 'Bus Factor',
    format: 'percent',
    thresholds: { green: 0.25, yellow: 0.5, invertColor: true },
    description: 'Percentage of significant projects (>10h) where only one engineer contributed.',
    category: 'teamHealth',
    getValue: r => r.busFactorRisk,
    applicableToSingleProject: false,
  },
  focusScore: {
    key: 'focusScore',
    label: 'Avg Projects per Engineer',
    shortLabel: 'Focus Score',
    format: 'decimal',
    thresholds: { green: 3, yellow: 5, invertColor: true },
    description: 'Average number of distinct projects each engineer worked on. Lower = more focused.',
    category: 'teamHealth',
    getValue: r => r.focusScore,
    applicableToSingleProject: false,
  },
  meetingTaxHours: {
    key: 'meetingTaxHours',
    label: 'Meeting Tax',
    shortLabel: 'Meetings',
    format: 'hours',
    thresholds: { green: 30, yellow: 60, invertColor: true },
    description: 'Total hours spent on team meetings across all engineers.',
    category: 'teamHealth',
    getValue: r => r.meetingTaxHours,
    applicableToSingleProject: false,
  },
  labUtilization: {
    key: 'labUtilization',
    label: 'Lab Utilization',
    shortLabel: 'Lab Ratio',
    format: 'percent',
    thresholds: { green: 0.5, yellow: 0.7, invertColor: false },
    description: 'Lab testing hours as a percentage of total engineering + lab hours.',
    category: 'workMix',
    getValue: r => r.labUtilization,
    applicableToSingleProject: true,
  },
  taskCompletionRate: {
    key: 'taskCompletionRate',
    label: 'Task Completion Rate',
    shortLabel: 'Completion',
    format: 'percent',
    thresholds: { green: 0.6, yellow: 0.4, invertColor: false },
    description: 'Percentage of tasks worked on this month that were marked as done.',
    category: 'throughput',
    getValue: r => r.taskCompletionRate,
    applicableToSingleProject: true,
  },
  adminOverhead: {
    key: 'adminOverhead',
    label: 'Admin Overhead',
    shortLabel: 'Admin',
    format: 'percent',
    thresholds: { green: 0.08, yellow: 0.15, invertColor: true },
    description: 'Admin hours as a percentage of total work time. Lower means more time on deliverables.',
    category: 'teamHealth',
    getValue: r => r.adminOverhead,
    applicableToSingleProject: false,
  },
  sustainingLoad: {
    key: 'sustainingLoad',
    label: 'Sustaining Load',
    shortLabel: 'Sustaining',
    format: 'percent',
    thresholds: { green: 0.4, yellow: 0.6, invertColor: true },
    description: 'Percentage of productive hours spent on sustaining work.',
    category: 'workMix',
    getValue: r => r.sustainingLoad,
    applicableToSingleProject: false,
  },
  unplannedSustainingPct: {
    key: 'unplannedSustainingPct',
    label: 'Unplanned Sustaining',
    shortLabel: 'Unplanned %',
    format: 'percent',
    thresholds: { green: 0.2, yellow: 0.4, invertColor: true },
    description: 'Of all sustaining hours, how much was unplanned/firefighting.',
    category: 'workMix',
    getValue: r => r.unplannedSustainingPct,
    applicableToSingleProject: false,
  },
  avgHoursPerEngineer: {
    key: 'avgHoursPerEngineer',
    label: 'Avg Hours / Engineer',
    shortLabel: 'Avg Hours',
    format: 'hours',
    thresholds: { green: 999, yellow: 999, invertColor: false },
    description: 'Average productive hours per active engineer.',
    category: 'utilization',
    getValue: r => r.avgHoursPerEngineer,
    applicableToSingleProject: true,
  },
  loadSpread: {
    key: 'loadSpread',
    label: 'Load Spread',
    shortLabel: 'Spread',
    format: 'hours',
    thresholds: { green: 40, yellow: 80, invertColor: true },
    description: 'Gap in hours between the most-loaded and least-loaded engineer. Lower = more balanced.',
    category: 'teamHealth',
    getValue: r => r.loadSpread,
    applicableToSingleProject: false,
  },
  deepWorkRatio: {
    key: 'deepWorkRatio',
    label: 'Deep Work Ratio',
    shortLabel: 'Deep Work',
    format: 'percent',
    thresholds: { green: 0.9, yellow: 0.8, invertColor: false },
    description: 'Percentage of all non-OOO time spent on actual project work vs. admin overhead.',
    category: 'utilization',
    getValue: r => r.deepWorkRatio,
    applicableToSingleProject: false,
  },
};

export const KPI_PRESETS: Record<string, { label: string; cards: KPICardKey[] }> = {
  executive: {
    label: 'Executive',
    cards: ['teamUtilization', 'npdFocus', 'firefightingLoad', 'activeEngineers', 'totalHoursLogged', 'projectsTouched'],
  },
  engineeringLead: {
    label: 'Engineering Lead',
    cards: ['teamUtilization', 'busFactorRisk', 'taskCompletionRate', 'focusScore', 'firefightingLoad', 'adminOverhead'],
  },
  capacityPlanning: {
    label: 'Capacity Planning',
    cards: ['teamUtilization', 'avgHoursPerEngineer', 'loadSpread', 'activeEngineers', 'sustainingLoad', 'labUtilization'],
  },
};

export const DEFAULT_KPI_CARDS: KPICardKey[] = KPI_PRESETS.executive.cards;

export const KPI_CATEGORIES = [
  { id: 'utilization', label: 'Utilization' },
  { id: 'workMix', label: 'Work Mix' },
  { id: 'teamHealth', label: 'Team Health' },
  { id: 'throughput', label: 'Throughput' },
] as const;

/**
 * Format a KPI value for display.
 */
export function formatKPIValue(value: number, format: KPIFormat): string {
  switch (format) {
    case 'percent':
      return String(Math.round(value * 100));
    case 'hours':
      return value % 1 === 0 ? String(value) : value.toFixed(1);
    case 'count':
      return String(Math.round(value));
    case 'decimal':
      return value.toFixed(1);
  }
}

/**
 * Get the color for a KPI value based on its thresholds.
 */
export function getKPIColor(
  value: number,
  thresholds: KPIDefinition['thresholds']
): 'green' | 'yellow' | 'red' | 'neutral' {
  // "No color coding" sentinel: both thresholds at absurd values
  if (thresholds.green >= 999 && thresholds.yellow >= 999) return 'neutral';

  if (thresholds.invertColor) {
    // Lower is better (e.g., firefighting)
    if (value <= thresholds.green) return 'green';
    if (value <= thresholds.yellow) return 'yellow';
    return 'red';
  } else {
    // Higher is better (e.g., utilization ≤0.85 = green)
    if (value <= thresholds.green) return 'green';
    if (value <= thresholds.yellow) return 'yellow';
    return 'red';
  }
}
