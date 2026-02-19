import { startOfISOWeek, addDays, format, parseISO, getISOWeek } from 'date-fns';

/**
 * Get the Friday date for the ISO week containing the given date.
 * ISO weeks start Monday; Friday is day index 4.
 */
export function getWeekFriday(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const weekStart = startOfISOWeek(d); // Monday
  const friday = addDays(weekStart, 4);
  return format(friday, 'yyyy-MM-dd');
}

/**
 * Get Monday–Friday range for a given Friday date.
 */
export function getWeekRange(fridayDate: string): { start: string; end: string } {
  const friday = parseISO(fridayDate);
  const monday = addDays(friday, -4);
  return {
    start: format(monday, 'yyyy-MM-dd'),
    end: fridayDate,
  };
}

/**
 * Derive sorted unique Friday dates from timesheet date values.
 * Returns most-recent first.
 */
export function getAvailableWeeks(dates: { date: string }[]): string[] {
  const fridaySet = new Set<string>();
  for (const { date } of dates) {
    if (date) fridaySet.add(getWeekFriday(date));
  }
  return [...fridaySet].sort().reverse();
}

/**
 * Get the ISO week number for a Friday date string.
 */
export function getFridayWeekNumber(fridayDate: string): number {
  return getISOWeek(parseISO(fridayDate));
}

/**
 * Format a Friday date as a human-readable week label.
 * e.g., "Feb 10 – Feb 14, 2026"
 */
export function formatWeekLabel(fridayDate: string): string {
  const { start, end } = getWeekRange(fridayDate);
  const monday = parseISO(start);
  const friday = parseISO(end);
  const monLabel = format(monday, 'MMM d');
  const friLabel = format(friday, 'MMM d, yyyy');
  return `${monLabel} – ${friLabel}`;
}
