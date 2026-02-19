import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { DashboardConfig } from '../types';

/**
 * Hook to read and write dashboard config (singleton).
 */
export function useConfig() {
  const config = useLiveQuery(() => db.config.get(1));

  const updateConfig = async (updates: Partial<DashboardConfig>) => {
    await db.config.update(1, updates);
  };

  return {
    config,
    updateConfig,
    loading: config === undefined,
  };
}
