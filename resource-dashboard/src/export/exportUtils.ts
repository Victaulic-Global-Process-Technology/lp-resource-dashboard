import type { MonthFilter } from '../utils/monthRange';
import { resolveMonths } from '../utils/monthRange';

/**
 * Format a date for display in exports.
 */
export function formatExportDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format a month string (YYYY-MM) for display.
 */
export function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Format a MonthFilter into a display label for export headers.
 * Single month: "January 2026"
 * Range: uses the provided rangeLabel if available, else "Dec 2025 – Feb 2026"
 */
export function formatMonthFilterLabel(
  monthFilter: MonthFilter,
  rangeLabel?: string
): string {
  const months = resolveMonths(monthFilter);
  if (months.length === 1) return formatMonthLabel(months[0]);
  if (rangeLabel) return rangeLabel;
  // Abbreviate: "Dec 2025 – Feb 2026"
  const shortFirst = new Date(parseInt(months[0].split('-')[0]), parseInt(months[0].split('-')[1]) - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const shortLast = new Date(parseInt(months[months.length - 1].split('-')[0]), parseInt(months[months.length - 1].split('-')[1]) - 1, 1)
    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${shortFirst} – ${shortLast}`;
}

/**
 * Generate a filename-safe string for a MonthFilter.
 * Single month: "202601"
 * Range: "202512-202602"
 * All Time: "AllTime"
 */
export function formatMonthFilterFilename(
  monthFilter: MonthFilter,
  rangeLabel?: string
): string {
  if (rangeLabel === 'All Time') return 'AllTime';
  const months = resolveMonths(monthFilter);
  if (months.length === 1) return months[0].replace('-', '');
  const first = months[0].replace('-', '');
  const last = months[months.length - 1].replace('-', '');
  return `${first}-${last}`;
}
