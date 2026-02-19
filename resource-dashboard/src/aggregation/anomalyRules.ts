import type { AnomalyThreshold } from '../types';

export interface AnomalyParameter {
  key: string;
  label: string;
  description: string;
  type: 'number' | 'percent';
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export interface AnomalyRuleDefinition {
  ruleId: string;
  name: string;
  description: string;
  category: 'capacity' | 'risk' | 'planning' | 'efficiency';
  defaultSeverity: 'info' | 'warning' | 'alert';
  defaultEnabled: boolean;
  parameters: AnomalyParameter[];
  rationale: string;
}

export const ANOMALY_RULES: AnomalyRuleDefinition[] = [
  {
    ruleId: 'overtime',
    name: 'Overtime Indicator',
    description: 'Flags team members who consistently log more than 8 hours per day.',
    category: 'capacity',
    defaultSeverity: 'warning',
    defaultEnabled: true,
    rationale: 'Sustained overtime can indicate unsustainable workload, impending burnout, or under-staffing on key projects.',
    parameters: [
      {
        key: 'minDaysOver8',
        label: 'Minimum days over threshold',
        description: 'How many days in the month must exceed the daily hours threshold to trigger this alert.',
        type: 'number',
        defaultValue: 3,
        min: 1,
        max: 20,
        step: 1,
        unit: 'days',
      },
      {
        key: 'dailyHoursThreshold',
        label: 'Daily hours threshold',
        description: 'What counts as an overtime day.',
        type: 'number',
        defaultValue: 8,
        min: 7,
        max: 12,
        step: 0.5,
        unit: 'hours',
      },
    ],
  },
  {
    ruleId: 'context-switching',
    name: 'Extreme Context Switching',
    description: "Flags engineers whose time is fragmented across too many projects daily.",
    category: 'efficiency',
    defaultSeverity: 'warning',
    defaultEnabled: true,
    rationale: 'Research shows context switching between projects reduces engineering productivity by 20-40%. Engineers with low focus scores may benefit from consolidated assignments.',
    parameters: [
      {
        key: 'focusScoreThreshold',
        label: 'Focus score threshold',
        description: "Trigger when an engineer's focus score falls below this value (0-100, lower = more fragmented).",
        type: 'number',
        defaultValue: 30,
        min: 10,
        max: 80,
        step: 5,
        unit: 'score',
      },
    ],
  },
  {
    ruleId: 'bus-factor',
    name: 'Single Point of Failure',
    description: 'Flags NPD projects where all knowledge is concentrated in one person.',
    category: 'risk',
    defaultSeverity: 'alert',
    defaultEnabled: true,
    rationale: 'Projects with a single contributor have no backup coverage. If that person is unavailable, the project stops. Cross-training or pair assignments reduce this risk.',
    parameters: [
      {
        key: 'maxBusFactor',
        label: 'Maximum bus factor',
        description: 'Flag projects where this many or fewer people cover >50% of work.',
        type: 'number',
        defaultValue: 1,
        min: 1,
        max: 3,
        step: 1,
        unit: 'people',
      },
      {
        key: 'minProjectHours',
        label: 'Minimum project hours',
        description: 'Only flag projects with at least this many hours (ignore trivial entries).',
        type: 'number',
        defaultValue: 20,
        min: 5,
        max: 100,
        step: 5,
        unit: 'hours',
      },
      {
        key: 'projectTypesFilter',
        label: 'Only flag NPD projects',
        description: 'When set to 1, only NPD projects trigger this rule. Set to 0 to include sustaining projects.',
        type: 'number',
        defaultValue: 1,
        min: 0,
        max: 1,
        step: 1,
        unit: '',
      },
    ],
  },
  {
    ruleId: 'meeting-heavy',
    name: 'Meeting-Heavy Engineer',
    description: 'Flags engineers spending a disproportionate amount of time in meetings.',
    category: 'efficiency',
    defaultSeverity: 'info',
    defaultEnabled: true,
    rationale: 'Excessive meeting load reduces time available for engineering work. Flagging helps identify candidates for meeting audit or delegation.',
    parameters: [
      {
        key: 'meetingPctThreshold',
        label: 'Meeting percentage threshold',
        description: 'Trigger when meetings exceed this percentage of total hours.',
        type: 'percent',
        defaultValue: 20,
        min: 5,
        max: 50,
        step: 5,
        unit: '%',
      },
    ],
  },
  {
    ruleId: 'project-over-burn',
    name: 'Project Over-Burning',
    description: 'Flags NPD projects where actual hours significantly exceed planned hours.',
    category: 'planning',
    defaultSeverity: 'warning',
    defaultEnabled: true,
    rationale: 'Projects burning faster than planned may have scope creep, underestimated complexity, or quality issues requiring rework.',
    parameters: [
      {
        key: 'overBurnPct',
        label: 'Over-burn percentage',
        description: 'Trigger when actual hours exceed planned by this percentage.',
        type: 'percent',
        defaultValue: 30,
        min: 10,
        max: 100,
        step: 5,
        unit: '%',
      },
    ],
  },
  {
    ruleId: 'project-under-burn',
    name: 'Project Under-Burning',
    description: 'Flags projects where actual hours are significantly below planned pace.',
    category: 'planning',
    defaultSeverity: 'info',
    defaultEnabled: true,
    rationale: 'Projects well under planned pace may be blocked, de-prioritized, or lacking assigned resources.',
    parameters: [
      {
        key: 'underBurnPct',
        label: 'Under-burn percentage',
        description: 'Trigger when actual hours are below this percentage of planned.',
        type: 'percent',
        defaultValue: 50,
        min: 10,
        max: 80,
        step: 5,
        unit: '%',
      },
    ],
  },
  {
    ruleId: 'firefighting-spike',
    name: 'Firefighting Spike',
    description: 'Flags when unplanned/firefighting work exceeds a healthy threshold.',
    category: 'capacity',
    defaultSeverity: 'warning',
    defaultEnabled: true,
    rationale: 'High firefighting load indicates reactive work is displacing planned engineering. Sustained levels above 15% typically signal systemic issues.',
    parameters: [
      {
        key: 'firefightingPctThreshold',
        label: 'Firefighting percentage threshold',
        description: 'Trigger when unplanned work exceeds this percentage of productive hours.',
        type: 'percent',
        defaultValue: 15,
        min: 5,
        max: 40,
        step: 5,
        unit: '%',
      },
    ],
  },
  {
    ruleId: 'new-person',
    name: 'New Team Member Detected',
    description: 'Flags when a person appears in timesheet data for the first time.',
    category: 'capacity',
    defaultSeverity: 'info',
    defaultEnabled: true,
    rationale: 'Awareness of team composition changes. New members may need onboarding time that affects project velocity.',
    parameters: [],
  },
];

// ── Helper functions ──

type ThresholdMap = Map<string, AnomalyThreshold>;

export function isRuleEnabled(thresholdMap: ThresholdMap, ruleId: string): boolean {
  const stored = thresholdMap.get(ruleId);
  if (stored !== undefined) return stored.enabled;
  const ruleDef = ANOMALY_RULES.find(r => r.ruleId === ruleId);
  return ruleDef?.defaultEnabled ?? true;
}

export function getThreshold(thresholdMap: ThresholdMap, ruleId: string, paramKey: string): number {
  const stored = thresholdMap.get(ruleId);
  if (stored?.thresholds?.[paramKey] !== undefined) {
    return stored.thresholds[paramKey];
  }
  const ruleDef = ANOMALY_RULES.find(r => r.ruleId === ruleId);
  const param = ruleDef?.parameters.find(p => p.key === paramKey);
  return param?.defaultValue ?? 0;
}

export function getRuleSeverity(thresholdMap: ThresholdMap, ruleId: string): 'info' | 'warning' | 'alert' {
  const stored = thresholdMap.get(ruleId);
  if (stored?.severity) return stored.severity;
  const ruleDef = ANOMALY_RULES.find(r => r.ruleId === ruleId);
  return ruleDef?.defaultSeverity ?? 'info';
}

export function isCustomValue(thresholdMap: ThresholdMap, ruleId: string, paramKey: string): boolean {
  const stored = thresholdMap.get(ruleId);
  if (!stored?.thresholds?.[paramKey]) return false;
  const ruleDef = ANOMALY_RULES.find(r => r.ruleId === ruleId);
  const param = ruleDef?.parameters.find(p => p.key === paramKey);
  return param ? stored.thresholds[paramKey] !== param.defaultValue : false;
}

export function getDefaultThresholdsForRule(ruleId: string): Record<string, number> {
  const ruleDef = ANOMALY_RULES.find(r => r.ruleId === ruleId);
  if (!ruleDef) return {};
  return Object.fromEntries(ruleDef.parameters.map(p => [p.key, p.defaultValue]));
}

export function seedAnomalyDefaults(): AnomalyThreshold[] {
  return ANOMALY_RULES.map(rule => ({
    ruleId: rule.ruleId,
    enabled: rule.defaultEnabled,
    severity: rule.defaultSeverity,
    thresholds: Object.fromEntries(rule.parameters.map(p => [p.key, p.defaultValue])),
  }));
}
