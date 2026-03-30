import type {
  TeamMember,
  Project,
  ProjectMilestone,
  PlannedAllocation,
  PlannedProjectMonth,
  SkillRating,
  SkillCategory,
  ProjectSkillRequirement,
  AnomalyThreshold,
  NarrativeConfig,
  WeeklyUpdate,
  ScenarioAllocation,
  KPICardKey,
  PDFExportSections,
  PerViewExportSections,
} from '../types';

/**
 * The exported config file wrapper.
 * This is what gets written to the .json file.
 */
export interface ConfigExportFile {
  __rd_config_export: true;
  version: 1;
  exported_at: string;
  exported_from: string;
  dashboard_schema_version: number;

  tables: {
    // Tier 0 — no dependencies
    config: ConfigExportSingleton;
    anomalyThresholds: AnomalyThreshold[];
    narrativeConfig: NarrativeConfigExport;
    skillCategories: SkillCategory[];

    // Tier 1 — depend on Tier 0
    teamMembers: TeamMember[];
    projects: Project[];

    // Tier 2 — depend on Tier 1
    milestones: ProjectMilestone[];
    skills: Omit<SkillRating, 'id'>[];
    projectSkillRequirements: Omit<ProjectSkillRequirement, 'id'>[];
    plannedProjectMonths: Omit<PlannedProjectMonth, 'id'>[];
    weeklyUpdates: Omit<WeeklyUpdate, 'id'>[];
    planningScenarios: PlanningScenarioExport[];

    // Tier 3 — depend on Tier 1+2
    plannedAllocations: Omit<PlannedAllocation, 'id'>[];
  };

  metadata: {
    table_counts: Record<string, number>;
    config_completeness: Record<string, 'configured' | 'unconfigured' | 'partial'>;
  };
}

/**
 * Config singleton with ephemeral view state stripped out.
 */
export interface ConfigExportSingleton {
  team_name: string;
  std_monthly_capacity_hours: number;
  over_utilization_threshold_pct: number;
  kpi_cards: KPICardKey[];
  pdf_export_sections: PerViewExportSections | PDFExportSections;
}

/**
 * Narrative config singleton with id stripped.
 */
export type NarrativeConfigExport = Omit<NarrativeConfig, 'id'>;

/**
 * Scenario with its allocations bundled together.
 * Avoids the ID remapping problem — allocations are nested inside their parent.
 */
export interface PlanningScenarioExport {
  name: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
  base_month_start: string;
  base_month_end: string;
  source_template_project?: string;
  estimated_total_hours?: number;
  allocations: Omit<ScenarioAllocation, 'id' | 'scenario_id'>[];
}

/** Config import log stored after each successful config import. */
export interface ConfigImportLog {
  id?: number;
  imported_at: string;
  source_filename: string;
  source_team: string;
  strategy: 'merge' | 'replace';
  tables_imported: string[];
  rows_imported: Record<string, number>;
  rows_updated: Record<string, number>;
  warnings: string[];
}

/** Current export file format version */
export const CONFIG_FORMAT_VERSION = 1 as const;

/** Current Dexie schema version */
export const DASHBOARD_SCHEMA_VERSION = 13;
