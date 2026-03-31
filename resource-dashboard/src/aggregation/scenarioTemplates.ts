import { db } from '../db/database';
import { computeActualHours } from './actualHours';
import type { ScenarioAllocation, PlannedAllocation } from '../types';
import { monthRange } from './scenarioSkillFit';

/**
 * Month-by-month and engineer-by-engineer shape of a historical project.
 * Used as a template for scenario planning: apply to a new time window and
 * scale to a target total, then overlay on the capacity forecast.
 */
export interface ProjectTemplate {
  source_project_id: string;
  total_actual_hours: number;
  duration_months: number;
  /** Ordered 0-based index → fraction of total hours that fell in that month */
  monthly_distribution: Array<{ relative_month: number; fraction: number }>;
  /** Sorted descending by hours — engineer → fraction of total hours */
  engineer_distribution: Array<{ engineer: string; fraction: number }>;
}

/**
 * Build a ProjectTemplate from a project's historical actuals.
 * Returns null if the project has no recorded hours.
 */
export async function extractProjectTemplate(projectId: string): Promise<ProjectTemplate | null> {
  const actuals = await computeActualHours(undefined, projectId);
  if (actuals.length === 0) return null;

  const totalActualHours = actuals.reduce((sum, a) => sum + a.actual_hours, 0);
  if (totalActualHours === 0) return null;

  const monthTotals = new Map<string, number>();
  const engineerTotals = new Map<string, number>();

  for (const a of actuals) {
    monthTotals.set(a.month, (monthTotals.get(a.month) ?? 0) + a.actual_hours);
    engineerTotals.set(a.engineer, (engineerTotals.get(a.engineer) ?? 0) + a.actual_hours);
  }

  const sortedMonths = [...monthTotals.keys()].sort();
  const monthly_distribution = sortedMonths.map((month, i) => ({
    relative_month: i,
    fraction: monthTotals.get(month)! / totalActualHours,
  }));

  const engineer_distribution = [...engineerTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([engineer, hours]) => ({
      engineer,
      fraction: hours / totalActualHours,
    }));

  return {
    source_project_id: projectId,
    total_actual_hours: totalActualHours,
    duration_months: sortedMonths.length,
    monthly_distribution,
    engineer_distribution,
  };
}

/**
 * Generate monthly-rate ScenarioAllocations from a template and write them to Dexie.
 *
 * The new ScenarioAllocation model stores a flat monthly rate per engineer,
 * not per-month rows. We collapse the historical distribution into average
 * hours/month per engineer across the template duration.
 *
 * @param scenarioId  - Target scenario
 * @param template    - Distribution shape from extractProjectTemplate
 * @param targetHours - Desired total hours; if omitted uses template total
 */
export async function applyTemplateToScenario(
  scenarioId: number,
  template: ProjectTemplate,
  _startMonth: string,
  targetHours?: number,
): Promise<void> {
  const totalHours = targetHours ?? template.total_actual_hours;

  await db.scenarioAllocations.where('scenario_id').equals(scenarioId).delete();

  const rows: Omit<ScenarioAllocation, 'id'>[] = [];
  const durationMonths = Math.max(template.duration_months, 1);

  for (const { engineer, fraction } of template.engineer_distribution) {
    const totalEngineerHours = totalHours * fraction;
    const hoursPerMonth = totalEngineerHours / durationMonths;
    if (hoursPerMonth < 0.5) continue; // skip negligible

    rows.push({
      scenario_id: scenarioId,
      engineer,
      allocation_pct: Math.min(hoursPerMonth / 140, 1),
      planned_hours: Math.round(hoursPerMonth * 10) / 10,
      allocation_mode: 'hours',
    });
  }

  await db.scenarioAllocations.bulkAdd(rows as ScenarioAllocation[]);
}

/**
 * Convert ScenarioAllocations to the PlannedAllocation shape expected by
 * computeCapacityForecast's overlayAllocations parameter.
 *
 * Each monthly-rate allocation is expanded into one row per month in the window.
 */
export function scenarioAllocationsToOverlay(
  allocations: ScenarioAllocation[],
  startMonth: string,
  durationMonths: number,
  scenarioId: number,
): PlannedAllocation[] {
  const months = monthRange(startMonth, durationMonths);
  const overlay: PlannedAllocation[] = [];

  for (const alloc of allocations) {
    for (const month of months) {
      overlay.push({
        month,
        project_id: `SCENARIO-${scenarioId}`,
        engineer: alloc.engineer,
        allocation_pct: alloc.allocation_pct,
        planned_hours: alloc.planned_hours,
      });
    }
  }

  return overlay;
}
