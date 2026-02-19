import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { WeeklyUpdate } from '../types';

export function useWeeklyUpdates(weekEnding?: string) {
  const updates = useLiveQuery(
    async (): Promise<WeeklyUpdate[]> =>
      weekEnding
        ? db.weeklyUpdates.where('week_ending').equals(weekEnding).toArray()
        : [],
    [weekEnding]
  );

  const saveUpdate = async (
    update: Omit<WeeklyUpdate, 'id' | 'updated_at'>
  ) => {
    const now = new Date().toISOString();

    const existing = await db.weeklyUpdates
      .where('[project_id+week_ending]')
      .equals([update.project_id, update.week_ending])
      .first();

    if (existing) {
      await db.weeklyUpdates.update(existing.id!, {
        ...update,
        updated_at: now,
      });
    } else {
      await db.weeklyUpdates.add({
        ...update,
        updated_at: now,
      });
    }
  };

  const getPreviousWeekUpdate = async (
    projectId: string,
    currentWeekEnding: string
  ): Promise<WeeklyUpdate | undefined> => {
    const allForProject = await db.weeklyUpdates
      .where('project_id')
      .equals(projectId)
      .toArray();

    return allForProject
      .filter(u => u.week_ending < currentWeekEnding)
      .sort((a, b) => b.week_ending.localeCompare(a.week_ending))[0];
  };

  const getUpdate = async (
    projectId: string,
    weekEnding: string
  ): Promise<WeeklyUpdate | undefined> => {
    return db.weeklyUpdates
      .where('[project_id+week_ending]')
      .equals([projectId, weekEnding])
      .first();
  };

  return {
    updates: updates ?? [],
    saveUpdate,
    getPreviousWeekUpdate,
    getUpdate,
    loading: updates === undefined,
  };
}
