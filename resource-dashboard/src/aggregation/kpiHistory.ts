import { db } from '../db/database';
import { computeAllKPIsBatch } from './kpiEngine';
import { fromDbMonth } from '../utils/monthRange';

/**
 * Refresh the KPI history table for all months that have timesheet data.
 * Upserts snapshots for each [month, project_filter] pair and cleans up stale entries.
 * Idempotent — running twice produces the same results.
 */
export async function refreshKPIHistory(projectFilter?: string): Promise<void> {
  const filter = projectFilter ?? '';

  // Get all distinct months from timesheets
  const sheets = await db.timesheets.toArray();
  const monthSet = new Set(sheets.map(s => fromDbMonth(s.month)));
  const months = [...monthSet].sort();

  if (months.length === 0) return;

  // Batch-compute KPIs for all months in a single pass
  const batchResults = await computeAllKPIsBatch(months, projectFilter);

  // Get existing snapshots for this project filter
  const existing = await db.kpiHistory
    .where('project_filter')
    .equals(filter)
    .toArray();

  const existingByMonth = new Map(existing.map(s => [s.month, s]));
  const now = new Date().toISOString();

  // Upsert each month
  const toAdd: { month: string; project_filter: string; computed_at: string; results: typeof batchResults extends Map<string, infer V> ? V : never }[] = [];
  const toUpdate: { id: number; changes: { computed_at: string; results: typeof batchResults extends Map<string, infer V> ? V : never } }[] = [];

  for (const [month, results] of batchResults) {
    const snapshot = existingByMonth.get(month);
    if (snapshot && snapshot.id != null) {
      toUpdate.push({ id: snapshot.id, changes: { computed_at: now, results } });
    } else {
      toAdd.push({ month, project_filter: filter, computed_at: now, results });
    }
  }

  // Delete snapshots for months no longer in timesheets
  const validMonths = new Set(months);
  const toDelete = existing
    .filter(s => !validMonths.has(s.month))
    .map(s => s.id!)
    .filter(id => id != null);

  // Execute all writes
  await db.transaction('rw', db.kpiHistory, async () => {
    if (toAdd.length > 0) {
      await db.kpiHistory.bulkAdd(toAdd);
    }
    for (const { id, changes } of toUpdate) {
      await db.kpiHistory.update(id, changes);
    }
    if (toDelete.length > 0) {
      await db.kpiHistory.bulkDelete(toDelete);
    }
  });
}
