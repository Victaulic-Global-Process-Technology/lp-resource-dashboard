import type { NarrativeObservationKey, NarrativeConfig } from '../types';

export type NarrativeMode = 'team' | 'project';

export interface ObservationDefinition {
  key: NarrativeObservationKey;
  label: string;
  modes: NarrativeMode[];
  teamTemplate: string;
  projectTemplate: string;
}

/**
 * Registry of all narrative observations.
 * The default order here matches the spec's default priority.
 */
export const NARRATIVE_OBSERVATIONS: ObservationDefinition[] = [
  {
    key: 'busFactorRisks',
    label: 'Single Point of Failure Risk',
    modes: ['team', 'project'],
    teamTemplate: '{count} projects have single-point-of-failure risk',
    projectTemplate: 'This project depends on a single contributor ({name}), creating key-person risk',
  },
  {
    key: 'firefightingLoad',
    label: 'Firefighting Load',
    modes: ['team'],
    teamTemplate: 'Firefighting reached {pct}% of productive hours',
    projectTemplate: '',
  },
  {
    key: 'focusFragmentation',
    label: 'Focus / Context Switching',
    modes: ['team', 'project'],
    teamTemplate: '{name} shows significant context fragmentation',
    projectTemplate: '{name}, the primary contributor, is also active on {count} other projects this month',
  },
  {
    key: 'overtimeIndicators',
    label: 'Overtime Indicators',
    modes: ['team'],
    teamTemplate: '{name} logged overtime on {days} days',
    projectTemplate: '',
  },
  {
    key: 'meetingTax',
    label: 'Meeting Tax',
    modes: ['team'],
    teamTemplate: '{name} spent {pct}% of capacity in meetings',
    projectTemplate: '',
  },
  {
    key: 'projectOverBurn',
    label: 'Project Over-Burning',
    modes: ['team', 'project'],
    teamTemplate: '{project} is {pct}% over planned hours',
    projectTemplate: 'Hours are running {pct}% above plan — {actual}h logged against {planned}h planned',
  },
  {
    key: 'projectUnderBurn',
    label: 'Project Under-Burning',
    modes: ['team', 'project'],
    teamTemplate: '{project} is under planned pace',
    projectTemplate: 'Only {pct}% of planned hours have been logged — {actual}h of {planned}h',
  },
  {
    key: 'labTechContribution',
    label: 'Lab Technician Contribution',
    modes: ['team'],
    teamTemplate: 'Lab technicians logged {hours} hours across {count} projects',
    projectTemplate: '',
  },
];

/**
 * Returns the default NarrativeConfig for DB seeding and fallback.
 */
export const DEFAULT_NARRATIVE_CONFIG: NarrativeConfig = {
  id: 1,
  observations: {
    firefightingLoad: true,
    busFactorRisks: true,
    focusFragmentation: true,
    meetingTax: true,
    overtimeIndicators: true,
    projectOverBurn: true,
    projectUnderBurn: false,
    labTechContribution: false,
  },
  observationPriority: [
    'busFactorRisks',
    'firefightingLoad',
    'focusFragmentation',
    'overtimeIndicators',
    'meetingTax',
    'projectOverBurn',
    'projectUnderBurn',
    'labTechContribution',
  ],
  nameIndividuals: true,
  includeSpecificNumbers: true,
  includeTrendComparisons: true,
  maxObservations: 2,
  customOpening: '',
  customClosing: '',
};
