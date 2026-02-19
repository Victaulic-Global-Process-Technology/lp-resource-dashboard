import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { KPISnapshot } from '../types';

/**
 * Reactive hook for KPI history snapshots.
 * Returns all snapshots for a given project filter, sorted by month.
 */
export function useKPIHistory(projectFilter?: string): KPISnapshot[] | undefined {
  return useLiveQuery(async () => {
    const filter = projectFilter ?? '';
    return await db.kpiHistory
      .where('project_filter')
      .equals(filter)
      .sortBy('month');
  }, [projectFilter]);
}
