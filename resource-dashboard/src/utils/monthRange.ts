/**
 * Utilities for handling single-month and multi-month filters
 * across the aggregation layer.
 */

/** A month filter can be a single YYYY-MM string or an array of them. */
export type MonthFilter = string | string[];

/** Normalize a MonthFilter to always return an array. */
export function resolveMonths(filter: MonthFilter): string[] {
  return Array.isArray(filter) ? filter : [filter];
}

/** Convert display format (YYYY-MM) months to DB format (YYYY/MM). */
export function toDbMonths(months: string[]): string[] {
  return months.map(m => m.replace('-', '/'));
}

/** Convert a single display month to DB format. */
export function toDbMonth(month: string): string {
  return month.replace('-', '/');
}

/** Convert DB format (YYYY/MM) to display format (YYYY-MM). */
export function fromDbMonth(month: string): string {
  return month.replace('/', '-');
}
