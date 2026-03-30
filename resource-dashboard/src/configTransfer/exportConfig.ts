import { db } from '../db/database';
import { computeConfigCompleteness } from './configCompleteness';
import type {
  ConfigExportFile,
  PlanningScenarioExport,
} from './configFileFormat';
import { CONFIG_FORMAT_VERSION, DASHBOARD_SCHEMA_VERSION } from './configFileFormat';

/**
 * Reads all config tables from Dexie and assembles a ConfigExportFile.
 * Excludes timesheet data, derived tables, and import logs.
 */
export async function exportAllConfig(): Promise<ConfigExportFile> {
  // ── Tier 0 ──

  const configRow = await db.config.get(1);
  const config = configRow
    ? {
        team_name: configRow.team_name,
        std_monthly_capacity_hours: configRow.std_monthly_capacity_hours,
        over_utilization_threshold_pct: configRow.over_utilization_threshold_pct,
        kpi_cards: configRow.kpi_cards,
        pdf_export_sections: configRow.pdf_export_sections,
      }
    : {
        team_name: '',
        std_monthly_capacity_hours: 140,
        over_utilization_threshold_pct: 1.0,
        kpi_cards: [],
        pdf_export_sections: {
          overview: { includeKPISummary: true, includeNarrative: true, includeAlerts: false, chartPanels: [] },
          team: { includeKPISummary: true, includeNarrative: true, includeAlerts: false, chartPanels: [] },
          planning: { includeKPISummary: true, includeNarrative: true, includeAlerts: false, chartPanels: [] },
          engineer: { includeKPISummary: true, includeNarrative: true, includeAlerts: true, chartPanels: [] },
        },
      };

  const anomalyThresholds = await db.anomalyThresholds.toArray();
  const narrativeConfigRow = await db.narrativeConfig.get(1);
  const narrativeConfig = narrativeConfigRow
    ? {
        observations: narrativeConfigRow.observations,
        observationPriority: narrativeConfigRow.observationPriority,
        nameIndividuals: narrativeConfigRow.nameIndividuals,
        includeSpecificNumbers: narrativeConfigRow.includeSpecificNumbers,
        includeTrendComparisons: narrativeConfigRow.includeTrendComparisons,
        maxObservations: narrativeConfigRow.maxObservations,
        customOpening: narrativeConfigRow.customOpening,
        customClosing: narrativeConfigRow.customClosing,
      }
    : {
        observations: {} as any,
        observationPriority: [],
        nameIndividuals: true,
        includeSpecificNumbers: true,
        includeTrendComparisons: true,
        maxObservations: 2,
        customOpening: '',
        customClosing: '',
      };

  const skillCategories = await db.skillCategories.toArray();

  // ── Tier 1 ──

  const teamMembers = await db.teamMembers.toArray();
  const projects = await db.projects.toArray();

  // ── Tier 2 ──

  const milestones = await db.milestones.toArray();

  const skillsRaw = await db.skills.toArray();
  const skills = skillsRaw.map(({ id: _id, ...rest }) => rest);

  const psrRaw = await db.projectSkillRequirements.toArray();
  const projectSkillRequirements = psrRaw.map(({ id: _id, ...rest }) => rest);

  const ppmRaw = await db.plannedProjectMonths.toArray();
  const plannedProjectMonths = ppmRaw.map(({ id: _id, ...rest }) => rest);

  const wuRaw = await db.weeklyUpdates.toArray();
  const weeklyUpdates = wuRaw.map(({ id: _id, ...rest }) => rest);

  // Scenarios — bundle allocations inside each scenario
  const scenariosRaw = await db.planningScenarios.toArray();
  const planningScenarios: PlanningScenarioExport[] = [];
  for (const s of scenariosRaw) {
    const allocs = await db.scenarioAllocations
      .where('scenario_id')
      .equals(s.id!)
      .toArray();
    planningScenarios.push({
      name: s.name,
      description: s.description,
      status: s.status,
      created_at: s.created_at,
      updated_at: s.updated_at,
      base_month_start: s.base_month_start,
      base_month_end: s.base_month_end,
      source_template_project: s.source_template_project,
      estimated_total_hours: s.estimated_total_hours,
      allocations: allocs.map(({ id: _id, scenario_id: _sid, ...rest }) => rest),
    });
  }

  // ── Tier 3 ──

  const paRaw = await db.plannedAllocations.toArray();
  const plannedAllocations = paRaw.map(({ id: _id, ...rest }) => rest);

  // ── Metadata ──

  const tables = {
    config,
    anomalyThresholds,
    narrativeConfig,
    skillCategories,
    teamMembers,
    projects,
    milestones,
    skills,
    projectSkillRequirements,
    plannedProjectMonths,
    weeklyUpdates,
    planningScenarios,
    plannedAllocations,
  };

  const table_counts: Record<string, number> = {
    config: 1,
    anomalyThresholds: anomalyThresholds.length,
    narrativeConfig: 1,
    skillCategories: skillCategories.length,
    teamMembers: teamMembers.length,
    projects: projects.length,
    milestones: milestones.length,
    skills: skills.length,
    projectSkillRequirements: projectSkillRequirements.length,
    plannedProjectMonths: plannedProjectMonths.length,
    weeklyUpdates: weeklyUpdates.length,
    planningScenarios: planningScenarios.length,
    plannedAllocations: plannedAllocations.length,
  };

  const completeness = await computeConfigCompleteness();
  const config_completeness = completeness.status as Record<string, 'configured' | 'unconfigured' | 'partial'>;

  return {
    __rd_config_export: true,
    version: CONFIG_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    exported_from: config.team_name || 'Unknown',
    dashboard_schema_version: DASHBOARD_SCHEMA_VERSION,
    tables,
    metadata: {
      table_counts,
      config_completeness,
    },
  };
}

/**
 * Triggers browser download of the config export as a JSON file.
 */
export function downloadConfigFile(data: ConfigExportFile): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const teamSlug = (data.exported_from || 'Dashboard')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filename = `RD_Config_${teamSlug}_${dateSlug}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
