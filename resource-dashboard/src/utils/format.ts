/**
 * Shared formatting utilities.
 */

/**
 * Format hours with appropriate decimal places.
 * Whole numbers show no decimal, fractions show 1 decimal place.
 */
export function formatHours(h: number): string {
  return h % 1 === 0 ? h.toString() : h.toFixed(1);
}

/**
 * Format percentage (0-1 range to "XX%").
 */
export function formatPercent(pct: number): string {
  return `${Math.round(pct * 100)}%`;
}

/**
 * Format month from YYYY-MM to "MMM 'YY".
 */
export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[parseInt(monthNum) - 1];
  const shortYear = year.slice(2);
  return `${monthName} '${shortYear}`;
}

/**
 * Format date from YYYY-MM-DD to "MMM D, YYYY".
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
