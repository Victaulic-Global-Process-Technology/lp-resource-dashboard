import { db } from '../db/database';
import { ProjectType } from '../types';
import type { MonthlyCategoryTotals, NPDProjectComparison, ProjectTimeline } from '../types';
import { computeActualHours } from './actualHours';
import { computeLabTechHours } from './labTechHours';
import { getProjectParent } from './projectUtils';
import type { MonthFilter } from '../utils/monthRange';
import { resolveMonths } from '../utils/monthRange';

// Re-export for backward compatibility (engine.ts exports from here)
export { getProjectParent };

/**
 * Compute monthly category totals for planned vs actual comparison.
 *
 * @param projectFilter - Optional: limit to a specific project (parent R# code).
 */
export async function computeMonthlyCategoryTotals(
  projectFilter?: string
): Promise<MonthlyCategoryTotals[]> {
  const plannedProjectMonths = await db.plannedProjectMonths.toArray();
  const projects = await db.projects.toArray();
  const actualHours = await computeActualHours(undefined, projectFilter);
  const labTechHours = await computeLabTechHours(undefined, projectFilter);

  const projectMap = new Map(projects.map(p => [p.project_id, p]));

  // Optionally filter planned data by project
  const filteredPlanned = projectFilter
    ? plannedProjectMonths.filter(p =>
        getProjectParent(p.project_id) === projectFilter || p.project_id === projectFilter
      )
    : plannedProjectMonths;

  // Get all unique months
  const allMonths = new Set([
    ...filteredPlanned.map(p => p.month),
    ...actualHours.map(a => a.month),
  ]);

  const result: MonthlyCategoryTotals[] = [];

  for (const month of allMonths) {
    const monthPlanned = filteredPlanned.filter(p => p.month === month);
    const monthActual = actualHours.filter(a => a.month === month);
    const monthLabTech = labTechHours.filter(l => l.month === month);

    // Planned totals by type
    const planned_npd = monthPlanned
      .filter(p => projectMap.get(p.project_id)?.type === ProjectType.NPD)
      .reduce((sum, p) => sum + p.total_planned_hours, 0);

    const planned_sustaining = monthPlanned
      .filter(p => projectMap.get(p.project_id)?.type === ProjectType.Sustaining)
      .reduce((sum, p) => sum + p.total_planned_hours, 0);

    const planned_sprint = monthPlanned
      .filter(p => projectMap.get(p.project_id)?.type === ProjectType.Sprint)
      .reduce((sum, p) => sum + p.total_planned_hours, 0);

    // Actual totals by type
    const actual_npd = monthActual
      .filter(a => a.project_type === ProjectType.NPD)
      .reduce((sum, a) => sum + a.actual_hours, 0);

    const actual_sustaining = monthActual
      .filter(a => a.project_type === ProjectType.Sustaining)
      .reduce((sum, a) => sum + a.actual_hours, 0);

    const actual_sprint = monthActual
      .filter(a => a.project_type === ProjectType.Sprint)
      .reduce((sum, a) => sum + a.actual_hours, 0);

    // Firefighting is a subset of sustaining
    const actual_firefighting = monthActual
      .filter(a => a.work_class === 'Unplanned/Firefighting')
      .reduce((sum, a) => sum + a.actual_hours, 0);

    // Lab tech total
    const lab_tech_total = monthLabTech.reduce((sum, l) => sum + l.lab_tech_hours, 0);

    result.push({
      month,
      planned_npd,
      planned_sustaining,
      planned_sprint,
      actual_npd,
      actual_sustaining,
      actual_sprint,
      actual_firefighting,
      lab_tech_total,
    });
  }

  return result.sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Compute NPD project planned vs actual comparison for a specific month.
 * Groups sub-projects under parent codes.
 */
export async function computeNPDProjectComparison(
  month: MonthFilter
): Promise<NPDProjectComparison[]> {
  const months = resolveMonths(month);
  const projects = await db.projects.where('type').equals(ProjectType.NPD).toArray();
  const plannedProjectMonths = await db.plannedProjectMonths
    .where('month')
    .anyOf(months)
    .toArray();
  const actualHours = await computeActualHours(month);

  // Group by parent project ID
  const groups = new Map<string, NPDProjectComparison>();

  for (const project of projects) {
    const parent = getProjectParent(project.project_id);

    if (!groups.has(parent)) {
      // Find the display name - prefer the parent code's name if it exists
      const parentProject = projects.find(p => p.project_id === parent);
      const name = parentProject?.project_name ?? project.project_name;

      groups.set(parent, {
        project_id: parent,
        project_name: name,
        planned_hours: 0,
        actual_hours: 0,
        delta: 0,
        delta_pct: 0,
      });
    }

    // Find planned hours for this project (or its children)
    const planned = plannedProjectMonths.find(p => p.project_id === project.project_id);
    if (planned) {
      groups.get(parent)!.planned_hours += planned.total_planned_hours;
    }

    // Find actual hours for this project
    const actual = actualHours
      .filter(a => a.project_id === project.project_id)
      .reduce((sum, a) => sum + a.actual_hours, 0);
    groups.get(parent)!.actual_hours += actual;
  }

  // Compute deltas
  const result = [...groups.values()].map(g => ({
    ...g,
    delta: g.actual_hours - g.planned_hours,
    delta_pct: g.planned_hours > 0 ? (g.actual_hours - g.planned_hours) / g.planned_hours : 0,
  }));

  return result.sort((a, b) => a.project_id.localeCompare(b.project_id));
}

/**
 * Compute project timeline (planned vs actual over time) for a specific project.
 */
export async function computeProjectTimeline(
  projectId: string
): Promise<ProjectTimeline[]> {
  const project = await db.projects.get(projectId);
  if (!project) return [];

  const plannedProjectMonths = await db.plannedProjectMonths
    .where('project_id')
    .equals(projectId)
    .toArray();
  const actualHours = await computeActualHours();

  // Get all months where this project has data
  const months = new Set([
    ...plannedProjectMonths.map(p => p.month),
    ...actualHours.filter(a => a.project_id === projectId).map(a => a.month),
  ]);

  const result: ProjectTimeline[] = [];

  for (const month of months) {
    const planned = plannedProjectMonths.find(p => p.month === month);
    const actual = actualHours
      .filter(a => a.month === month && a.project_id === projectId)
      .reduce((sum, a) => sum + a.actual_hours, 0);

    result.push({
      month,
      planned_hours: planned?.total_planned_hours ?? 0,
      actual_hours: actual,
    });
  }

  return result.sort((a, b) => a.month.localeCompare(b.month));
}
