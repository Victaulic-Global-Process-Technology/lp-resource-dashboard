import { db, SKILL_CATEGORIES } from '../db/database';
import { refreshKPIHistory } from '../aggregation/kpiHistory';
import type { ConfigExportFile, ConfigImportLog } from './configFileFormat';
import type { TeamMember, Project } from '../types';
import { DASHBOARD_SCHEMA_VERSION } from './configFileFormat';

/** Build a lookup from skill name → default category from SKILL_CATEGORIES. */
const DEFAULT_CATEGORY_MAP = new Map<string, string>();
for (const group of SKILL_CATEGORIES) {
  for (const skill of group.skills) {
    DEFAULT_CATEGORY_MAP.set(skill.toLowerCase(), group.category);
  }
}

export interface ConfigImportOptions {
  file: ConfigExportFile;
  selectedTables: Set<string>;
  strategy: 'merge' | 'replace';
}

export interface ConfigImportResult {
  success: boolean;
  imported_tables: string[];
  skipped_tables: string[];
  rows_imported: Record<string, number>;
  rows_updated: Record<string, number>;
  warnings: string[];
  errors: string[];
}

export interface ImportConflict {
  severity: 'info' | 'warning';
  message: string;
}

/**
 * Detect potential conflicts before importing.
 */
export function detectConflicts(
  importData: ConfigExportFile,
  currentTeamMembers: TeamMember[],
  currentProjects: Project[],
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const t = importData.tables;

  // Schema version mismatch
  if (importData.dashboard_schema_version !== DASHBOARD_SCHEMA_VERSION) {
    conflicts.push({
      severity: 'warning',
      message: `Config was exported from schema version ${importData.dashboard_schema_version} (current: ${DASHBOARD_SCHEMA_VERSION}). Some tables may have changed structure.`,
    });
  }

  // Engineers in import not in current data
  const importMemberNames = new Set(t.teamMembers.map(m => m.full_name));
  const currentMemberNames = new Set(currentTeamMembers.map(m => m.full_name));
  const newMembers = t.teamMembers.filter(m => !currentMemberNames.has(m.full_name));
  if (newMembers.length > 0) {
    conflicts.push({
      severity: 'info',
      message: `${newMembers.length} team member${newMembers.length !== 1 ? 's' : ''} in import not in current data (will be added).`,
    });
  }

  // Projects in import not in current data
  const importProjectIds = new Set(t.projects.map(p => p.project_id));
  const currentProjectIds = new Set(currentProjects.map(p => p.project_id));
  const newProjects = t.projects.filter(p => !currentProjectIds.has(p.project_id));
  if (newProjects.length > 0) {
    conflicts.push({
      severity: 'info',
      message: `${newProjects.length} project${newProjects.length !== 1 ? 's' : ''} in import not in current data (will be added).`,
    });
  }

  // Broken internal references — allocations referencing engineers not in the import's own teamMembers
  const allocEngineers = new Set(t.plannedAllocations.map(a => a.engineer));
  const orphanEngineers = [...allocEngineers].filter(e => !importMemberNames.has(e));
  if (orphanEngineers.length > 0) {
    conflicts.push({
      severity: 'warning',
      message: `${orphanEngineers.length} engineer${orphanEngineers.length !== 1 ? 's' : ''} referenced in allocations not found in import's team members.`,
    });
  }

  // Broken internal references — allocations/milestones referencing projects not in the import's own projects
  const allocProjectIds = new Set([
    ...t.plannedAllocations.map(a => a.project_id),
    ...t.milestones.map(m => m.project_id),
    ...t.plannedProjectMonths.map(p => p.project_id),
  ]);
  const orphanProjects = [...allocProjectIds].filter(id => !importProjectIds.has(id));
  if (orphanProjects.length > 0) {
    conflicts.push({
      severity: 'warning',
      message: `${orphanProjects.length} project ID${orphanProjects.length !== 1 ? 's' : ''} referenced in allocations/milestones not found in import's projects.`,
    });
  }

  // Skills with empty categories
  const emptyCategories = t.skillCategories.filter(s => !s.category);
  if (emptyCategories.length > 0) {
    const fixable = emptyCategories.filter(s => DEFAULT_CATEGORY_MAP.has(s.name.toLowerCase()));
    conflicts.push({
      severity: 'info',
      message: `${emptyCategories.length} skill${emptyCategories.length !== 1 ? 's' : ''} missing category labels${fixable.length > 0 ? ` (${fixable.length} will be auto-corrected on import)` : ''}.`,
    });
  }

  return conflicts;
}

/**
 * Validates that a parsed JSON object is a valid ConfigExportFile.
 */
export function validateConfigFile(data: unknown): data is ConfigExportFile {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.__rd_config_export === true &&
    typeof obj.version === 'number' &&
    typeof obj.tables === 'object' &&
    obj.tables !== null
  );
}

/**
 * Import config tables into Dexie respecting the dependency graph.
 */
export async function importConfig(options: ConfigImportOptions): Promise<ConfigImportResult> {
  const { file, selectedTables, strategy } = options;
  const t = file.tables;

  const result: ConfigImportResult = {
    success: false,
    imported_tables: [],
    skipped_tables: [],
    rows_imported: {},
    rows_updated: {},
    warnings: [],
    errors: [],
  };

  const selected = (table: string) => selectedTables.has(table);
  const skip = (table: string) => {
    result.skipped_tables.push(table);
  };

  try {
    // ── Tier 0: No dependencies ──

    // config singleton
    if (selected('config')) {
      // Normalize old-format (flat) pdf_export_sections to per-view format
      let sections = t.config.pdf_export_sections;
      if (sections && typeof sections === 'object' && !('overview' in sections)) {
        const flat = sections as { includeKPISummary: boolean; includeNarrative: boolean; includeAlerts: boolean; chartPanels: string[] };
        sections = {
          overview: { ...flat },
          team: { ...flat },
          planning: { ...flat },
          engineer: { includeKPISummary: true, includeNarrative: true, includeAlerts: true, chartPanels: [] },
        };
      }

      await db.config.update(1, {
        team_name: t.config.team_name,
        std_monthly_capacity_hours: t.config.std_monthly_capacity_hours,
        over_utilization_threshold_pct: t.config.over_utilization_threshold_pct,
        kpi_cards: t.config.kpi_cards,
        pdf_export_sections: sections,
      });
      result.imported_tables.push('config');
      result.rows_imported.config = 1;
    } else {
      skip('config');
    }

    // anomalyThresholds
    if (selected('anomalyThresholds')) {
      if (strategy === 'replace') {
        await db.anomalyThresholds.clear();
        await db.anomalyThresholds.bulkPut(t.anomalyThresholds);
      } else {
        for (const row of t.anomalyThresholds) {
          await db.anomalyThresholds.put(row);
        }
      }
      result.imported_tables.push('anomalyThresholds');
      result.rows_imported.anomalyThresholds = t.anomalyThresholds.length;
    } else {
      skip('anomalyThresholds');
    }

    // narrativeConfig singleton
    if (selected('narrativeConfig')) {
      await db.narrativeConfig.put({ id: 1, ...t.narrativeConfig });
      result.imported_tables.push('narrativeConfig');
      result.rows_imported.narrativeConfig = 1;
    } else {
      skip('narrativeConfig');
    }

    // skillCategories — backfill empty category fields from defaults
    if (selected('skillCategories')) {
      let backfilled = 0;
      const patched = t.skillCategories.map(row => {
        if (!row.category) {
          const defaultCat = DEFAULT_CATEGORY_MAP.get(row.name.toLowerCase());
          if (defaultCat) {
            backfilled++;
            return { ...row, category: defaultCat };
          }
        }
        return row;
      });

      if (backfilled > 0) {
        result.warnings.push(
          `${backfilled} skill${backfilled !== 1 ? 's' : ''} had empty categories — backfilled from defaults.`
        );
      }

      if (strategy === 'replace') {
        await db.skillCategories.clear();
        await db.skillCategories.bulkPut(patched);
      } else {
        for (const row of patched) {
          await db.skillCategories.put(row);
        }
      }
      result.imported_tables.push('skillCategories');
      result.rows_imported.skillCategories = patched.length;
    } else {
      skip('skillCategories');
    }

    // ── Tier 1: Depend on Tier 0 ──

    // teamMembers
    if (selected('teamMembers')) {
      if (strategy === 'replace') {
        await db.teamMembers.clear();
        await db.teamMembers.bulkPut(t.teamMembers);
      } else {
        for (const row of t.teamMembers) {
          await db.teamMembers.put(row);
        }
      }
      result.imported_tables.push('teamMembers');
      result.rows_imported.teamMembers = t.teamMembers.length;
    } else {
      skip('teamMembers');
    }

    // projects
    if (selected('projects')) {
      if (strategy === 'replace') {
        await db.projects.clear();
        await db.projects.bulkPut(t.projects);
      } else {
        for (const row of t.projects) {
          await db.projects.put(row);
        }
      }
      result.imported_tables.push('projects');
      result.rows_imported.projects = t.projects.length;
    } else {
      skip('projects');
    }

    // ── Tier 2: Depend on Tier 1 ──

    // milestones
    if (selected('milestones')) {
      if (strategy === 'replace') {
        await db.milestones.clear();
        await db.milestones.bulkPut(t.milestones);
      } else {
        for (const row of t.milestones) {
          await db.milestones.put(row);
        }
      }
      result.imported_tables.push('milestones');
      result.rows_imported.milestones = t.milestones.length;
    } else {
      skip('milestones');
    }

    // skills (compound key: [engineer+skill])
    if (selected('skills')) {
      result.rows_updated.skills = 0;
      if (strategy === 'replace') {
        await db.skills.clear();
        await db.skills.bulkAdd(t.skills.map(s => ({ ...s, id: undefined })));
        result.rows_imported.skills = t.skills.length;
      } else {
        result.rows_imported.skills = 0;
        for (const row of t.skills) {
          const existing = await db.skills
            .where('[engineer+skill]')
            .equals([row.engineer, row.skill])
            .first();
          if (existing) {
            await db.skills.update(existing.id!, { rating: row.rating });
            result.rows_updated.skills++;
          } else {
            await db.skills.add({ ...row, id: undefined });
            result.rows_imported.skills++;
          }
        }
      }
      result.imported_tables.push('skills');
    } else {
      skip('skills');
    }

    // projectSkillRequirements (compound key: [project_id+skill])
    if (selected('projectSkillRequirements')) {
      result.rows_updated.projectSkillRequirements = 0;
      if (strategy === 'replace') {
        await db.projectSkillRequirements.clear();
        await db.projectSkillRequirements.bulkAdd(
          t.projectSkillRequirements.map(r => ({ ...r, id: undefined }))
        );
        result.rows_imported.projectSkillRequirements = t.projectSkillRequirements.length;
      } else {
        result.rows_imported.projectSkillRequirements = 0;
        for (const row of t.projectSkillRequirements) {
          const existing = await db.projectSkillRequirements
            .where('[project_id+skill]')
            .equals([row.project_id, row.skill])
            .first();
          if (existing) {
            await db.projectSkillRequirements.update(existing.id!, { weight: row.weight });
            result.rows_updated.projectSkillRequirements++;
          } else {
            await db.projectSkillRequirements.add({ ...row, id: undefined });
            result.rows_imported.projectSkillRequirements++;
          }
        }
      }
      result.imported_tables.push('projectSkillRequirements');
    } else {
      skip('projectSkillRequirements');
    }

    // plannedProjectMonths (compound key: [month+project_id])
    if (selected('plannedProjectMonths')) {
      result.rows_updated.plannedProjectMonths = 0;
      if (strategy === 'replace') {
        await db.plannedProjectMonths.clear();
        await db.plannedProjectMonths.bulkAdd(
          t.plannedProjectMonths.map(r => ({ ...r, id: undefined }))
        );
        result.rows_imported.plannedProjectMonths = t.plannedProjectMonths.length;
      } else {
        result.rows_imported.plannedProjectMonths = 0;
        for (const row of t.plannedProjectMonths) {
          const existing = await db.plannedProjectMonths
            .where('[month+project_id]')
            .equals([row.month, row.project_id])
            .first();
          if (existing) {
            await db.plannedProjectMonths.update(existing.id!, {
              total_planned_hours: row.total_planned_hours,
            });
            result.rows_updated.plannedProjectMonths++;
          } else {
            await db.plannedProjectMonths.add({ ...row, id: undefined });
            result.rows_imported.plannedProjectMonths++;
          }
        }
      }
      result.imported_tables.push('plannedProjectMonths');
    } else {
      skip('plannedProjectMonths');
    }

    // weeklyUpdates (unique compound: [project_id+week_ending])
    if (selected('weeklyUpdates')) {
      result.rows_updated.weeklyUpdates = 0;
      if (strategy === 'replace') {
        await db.weeklyUpdates.clear();
        await db.weeklyUpdates.bulkAdd(
          t.weeklyUpdates.map(r => ({ ...r, id: undefined }))
        );
        result.rows_imported.weeklyUpdates = t.weeklyUpdates.length;
      } else {
        result.rows_imported.weeklyUpdates = 0;
        for (const row of t.weeklyUpdates) {
          const existing = await db.weeklyUpdates
            .where('[project_id+week_ending]')
            .equals([row.project_id, row.week_ending])
            .first();
          if (existing) {
            await db.weeklyUpdates.update(existing.id!, {
              status: row.status,
              completed_summary: row.completed_summary,
              action_items: row.action_items,
              next_milestones: row.next_milestones,
              notes: row.notes,
              updated_at: row.updated_at,
              updated_by: row.updated_by,
            });
            result.rows_updated.weeklyUpdates++;
          } else {
            await db.weeklyUpdates.add({ ...row, id: undefined });
            result.rows_imported.weeklyUpdates++;
          }
        }
      }
      result.imported_tables.push('weeklyUpdates');
    } else {
      skip('weeklyUpdates');
    }

    // planningScenarios (with nested allocations — always insert new)
    if (selected('planningScenarios')) {
      if (strategy === 'replace') {
        await db.scenarioSnapshots.clear();
        await db.scenarioAllocations.clear();
        await db.planningScenarios.clear();
      }
      result.rows_imported.planningScenarios = 0;
      result.rows_imported.scenarioAllocations = 0;
      for (const scenario of t.planningScenarios) {
        const { allocations, ...scenarioData } = scenario;
        const newId = await db.planningScenarios.add({
          ...scenarioData,
          id: undefined,
        } as any);
        result.rows_imported.planningScenarios++;

        if (allocations.length > 0) {
          await db.scenarioAllocations.bulkAdd(
            allocations.map(a => ({
              ...a,
              id: undefined,
              scenario_id: newId as number,
            }))
          );
          result.rows_imported.scenarioAllocations =
            (result.rows_imported.scenarioAllocations || 0) + allocations.length;
        }
      }
      result.imported_tables.push('planningScenarios');
    } else {
      skip('planningScenarios');
    }

    // ── Tier 3: Depend on Tier 1+2 ──

    // plannedAllocations (compound key: [month+project_id+engineer])
    if (selected('plannedAllocations')) {
      result.rows_updated.plannedAllocations = 0;
      if (strategy === 'replace') {
        await db.plannedAllocations.clear();
        await db.plannedAllocations.bulkAdd(
          t.plannedAllocations.map(r => ({ ...r, id: undefined }))
        );
        result.rows_imported.plannedAllocations = t.plannedAllocations.length;
      } else {
        result.rows_imported.plannedAllocations = 0;
        for (const row of t.plannedAllocations) {
          const existing = await db.plannedAllocations
            .where('[month+project_id+engineer]')
            .equals([row.month, row.project_id, row.engineer])
            .first();
          if (existing) {
            await db.plannedAllocations.update(existing.id!, {
              allocation_pct: row.allocation_pct,
              planned_hours: row.planned_hours,
            });
            result.rows_updated.plannedAllocations++;
          } else {
            await db.plannedAllocations.add({ ...row, id: undefined });
            result.rows_imported.plannedAllocations++;
          }
        }
      }
      result.imported_tables.push('plannedAllocations');
    } else {
      skip('plannedAllocations');
    }

    // ── Post-import actions ──

    await refreshKPIHistory();

    // Log the import
    await db.table('configImportLogs').add({
      imported_at: new Date().toISOString(),
      source_filename: '',  // Caller sets this via patchLastConfigImportFilename
      source_team: file.exported_from,
      strategy,
      tables_imported: result.imported_tables,
      rows_imported: result.rows_imported,
      rows_updated: result.rows_updated,
      warnings: result.warnings,
    } as Omit<ConfigImportLog, 'id'>);

    result.success = true;
  } catch (error) {
    result.errors.push(
      `Import failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Update the source_filename on the most recent config import log.
 */
export async function patchLastConfigImportFilename(filename: string): Promise<void> {
  const last = await db.table('configImportLogs')
    .orderBy('imported_at')
    .reverse()
    .first();
  if (last?.id) {
    await db.table('configImportLogs').update(last.id, { source_filename: filename });
  }
}
