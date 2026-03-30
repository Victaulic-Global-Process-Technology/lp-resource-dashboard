import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ProjectType } from '../types';
import { seedAnomalyDefaults } from '../aggregation/anomalyRules';
import { DEFAULT_NARRATIVE_CONFIG } from '../aggregation/narrativeObservations';

export type CompletenessStatus = 'configured' | 'unconfigured' | 'partial';

export interface ConfigCompletenessResult {
  status: Record<string, CompletenessStatus>;
  details: Record<string, string>;
}

/**
 * Computes the current configuration completeness by querying Dexie live.
 * Used by: Export summary, Import page config status, Sidebar indicator.
 */
export async function computeConfigCompleteness(): Promise<ConfigCompletenessResult> {
  const status: Record<string, CompletenessStatus> = {};
  const details: Record<string, string> = {};

  // config singleton
  const config = await db.config.get(1);
  if (config?.team_name) {
    status.config = 'configured';
    details.config = config.team_name;
  } else {
    status.config = 'unconfigured';
    details.config = 'Team name not set';
  }

  // teamMembers
  const members = await db.teamMembers.toArray();
  const engineers = members.filter(m => m.role === 'Engineer');
  const techs = members.filter(m => m.role === 'Lab Technician');
  if (members.length > 0) {
    status.teamMembers = 'configured';
    details.teamMembers = `${engineers.length} engineer${engineers.length !== 1 ? 's' : ''}, ${techs.length} lab tech${techs.length !== 1 ? 's' : ''}`;
  } else {
    status.teamMembers = 'unconfigured';
    details.teamMembers = 'No team members';
  }

  // projects
  const projects = await db.projects.toArray();
  if (projects.length > 0) {
    status.projects = 'configured';
    details.projects = `${projects.length} project${projects.length !== 1 ? 's' : ''} configured`;
  } else {
    status.projects = 'unconfigured';
    details.projects = 'No projects';
  }

  // skills
  const skills = await db.skills.toArray();
  const ratedSkills = skills.filter(s => s.rating > 0);
  if (ratedSkills.length > 0) {
    status.skills = 'configured';
    details.skills = `${ratedSkills.length} rating${ratedSkills.length !== 1 ? 's' : ''} entered`;
  } else if (skills.length > 0) {
    status.skills = 'partial';
    details.skills = 'Ratings exist but all are 0';
  } else {
    status.skills = 'unconfigured';
    details.skills = 'No skill ratings';
  }

  // skillCategories
  const skillCats = await db.skillCategories.count();
  if (skillCats > 0) {
    status.skillCategories = 'configured';
    details.skillCategories = `${skillCats} skill${skillCats !== 1 ? 's' : ''} defined`;
  } else {
    status.skillCategories = 'unconfigured';
    details.skillCategories = 'No skill categories';
  }

  // milestones
  const npdProjects = await db.projects.where('type').equals(ProjectType.NPD).toArray();
  const milestones = await db.milestones.toArray();
  const milestonesWithDates = milestones.filter(m => m.dr1 || m.dr2 || m.dr3 || m.launch);
  if (npdProjects.length === 0) {
    status.milestones = 'configured';
    details.milestones = 'No NPD projects';
  } else if (milestonesWithDates.length === npdProjects.length) {
    status.milestones = 'configured';
    details.milestones = `All ${npdProjects.length} NPD project${npdProjects.length !== 1 ? 's' : ''} have dates`;
  } else if (milestonesWithDates.length > 0) {
    status.milestones = 'partial';
    details.milestones = `${milestonesWithDates.length} of ${npdProjects.length} NPD project${npdProjects.length !== 1 ? 's' : ''} have dates`;
  } else {
    status.milestones = 'unconfigured';
    details.milestones = 'No milestone dates set';
  }

  // plannedAllocations
  const allocCount = await db.plannedAllocations.count();
  if (allocCount > 0) {
    status.plannedAllocations = 'configured';
    details.plannedAllocations = `${allocCount} entr${allocCount !== 1 ? 'ies' : 'y'}`;
  } else {
    status.plannedAllocations = 'unconfigured';
    details.plannedAllocations = 'No allocations';
  }

  // plannedProjectMonths
  const ppmCount = await db.plannedProjectMonths.count();
  if (ppmCount > 0) {
    status.plannedProjectMonths = 'configured';
    details.plannedProjectMonths = `${ppmCount} entr${ppmCount !== 1 ? 'ies' : 'y'}`;
  } else {
    status.plannedProjectMonths = 'unconfigured';
    details.plannedProjectMonths = 'No planned hours';
  }

  // anomalyThresholds — defaults are valid, check for customizations
  const thresholds = await db.anomalyThresholds.toArray();
  const defaults = seedAnomalyDefaults();
  let customizedCount = 0;
  for (const t of thresholds) {
    const def = defaults.find(d => d.ruleId === t.ruleId);
    if (!def) { customizedCount++; continue; }
    if (t.enabled !== def.enabled || t.severity !== def.severity) { customizedCount++; continue; }
    const defThresholds = def.thresholds;
    if (JSON.stringify(t.thresholds) !== JSON.stringify(defThresholds)) { customizedCount++; }
  }
  status.anomalyThresholds = 'configured';
  details.anomalyThresholds = customizedCount > 0
    ? `${customizedCount} rule${customizedCount !== 1 ? 's' : ''} customized`
    : 'All defaults';

  // narrativeConfig — defaults are valid
  const nc = await db.narrativeConfig.get(1);
  status.narrativeConfig = 'configured';
  if (nc) {
    const diffs: string[] = [];
    if (nc.customOpening) diffs.push('custom opening');
    if (nc.customClosing) diffs.push('custom closing');
    if (nc.maxObservations !== DEFAULT_NARRATIVE_CONFIG.maxObservations) diffs.push('max observations');
    if (!nc.nameIndividuals) diffs.push('names hidden');
    details.narrativeConfig = diffs.length > 0
      ? diffs.join(', ').replace(/^./, c => c.toUpperCase())
      : 'Default settings';
  } else {
    details.narrativeConfig = 'Default settings';
  }

  // weeklyUpdates
  const updatesCount = await db.weeklyUpdates.count();
  if (updatesCount > 0) {
    status.weeklyUpdates = 'configured';
    details.weeklyUpdates = `${updatesCount} update${updatesCount !== 1 ? 's' : ''}`;
  } else {
    status.weeklyUpdates = 'unconfigured';
    details.weeklyUpdates = 'No weekly updates';
  }

  // planningScenarios
  const scenarioCount = await db.planningScenarios.count();
  if (scenarioCount > 0) {
    status.planningScenarios = 'configured';
    details.planningScenarios = `${scenarioCount} scenario${scenarioCount !== 1 ? 's' : ''}`;
  } else {
    status.planningScenarios = 'unconfigured';
    details.planningScenarios = 'No scenarios';
  }

  return { status, details };
}

/**
 * React hook wrapping computeConfigCompleteness with live reactivity.
 */
export function useConfigCompleteness(): ConfigCompletenessResult | undefined {
  return useLiveQuery(() => computeConfigCompleteness());
}
