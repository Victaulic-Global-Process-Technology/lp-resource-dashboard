import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { MonthFilter } from '../utils/monthRange';

/**
 * Resolves the current month filter from dashboard config.
 * When a date range is set, returns the months array.
 * Otherwise falls back to selected_month as a single string.
 *
 * Returns undefined when no month is selected (All Time).
 */
export function useMonthFilter(): {
  monthFilter: MonthFilter | undefined;
  selectedMonth: string | undefined;
  selectedProject: string | undefined;
  isRange: boolean;
} {
  const config = useLiveQuery(() => db.config.get(1));

  const dateRange = config?.selected_date_range;
  const selectedMonth = config?.selected_month || undefined;
  const selectedProject = config?.selected_project || undefined;

  let monthFilter: MonthFilter | undefined;
  let isRange = false;

  if (dateRange && dateRange.months.length > 0) {
    if (dateRange.months.length === 1) {
      monthFilter = dateRange.months[0];
    } else {
      monthFilter = dateRange.months;
      isRange = true;
    }
  } else if (selectedMonth) {
    monthFilter = selectedMonth;
  }

  return { monthFilter, selectedMonth, selectedProject, isRange };
}
