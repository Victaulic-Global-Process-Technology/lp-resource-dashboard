import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getDashboardStats } from '../db/operations';

interface DashboardStats {
  lastImportDate: string | null;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  totalEntries: number;
  totalHours: number;
  peopleCount: number;
  engineerCount: number;
  techCount: number;
  unclassifiedCount: number;
  missingDateGaps: { from: string; to: string }[];
}

export function ImportStatus() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();

    const handleImport = () => {
      loadStats();
    };

    window.addEventListener('data-imported', handleImport);
    return () => window.removeEventListener('data-imported', handleImport);
  }, []);

  if (loading) {
    return (
      <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-table-header)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Data Status
          </h3>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-[var(--border-subtle)] rounded w-1/2"></div>
            <div className="h-3 bg-[var(--border-subtle)] rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats || stats.totalEntries === 0) {
    return (
      <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-table-header)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Data Status
          </h3>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--status-warn)]" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <p className="font-medium text-[13px] text-[var(--status-warn)]">
                No data imported yet
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                Import a CSV file to get started
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy \'at\' h:mm a');
    } catch {
      return dateStr;
    }
  };

  // Format "YYYY/MM" to "Mon YYYY"
  const formatMonthKey = (monthKey: string) => {
    try {
      const [y, m] = monthKey.split('/').map(Number);
      return format(new Date(y, m - 1, 1), 'MMM yyyy');
    } catch {
      return monthKey;
    }
  };

  const formatGap = (gap: { from: string; to: string }) => {
    if (gap.from === gap.to) {
      return formatMonthKey(gap.from);
    }
    return `${formatMonthKey(gap.from)} – ${formatMonthKey(gap.to)}`;
  };

  return (
    <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-table-header)] flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Data Status
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--status-good-bg)] text-[var(--status-good)]">
          <span className="w-1.5 h-1.5 rounded-full mr-1 bg-[var(--status-good)]"></span>
          Active
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
        <div>
          <p className="text-[var(--text-muted)]">Last Import</p>
          <p className="font-medium mt-0.5 text-[var(--text-primary)]">
            {stats.lastImportDate ? formatDateTime(stats.lastImportDate) : 'Never'}
          </p>
        </div>

        <div>
          <p className="text-[var(--text-muted)]">Data Range</p>
          <p className="font-medium mt-0.5 text-[var(--text-primary)]">
            {stats.dateRangeStart && stats.dateRangeEnd
              ? `${formatDate(stats.dateRangeStart)} – ${formatDate(stats.dateRangeEnd)}`
              : 'No data'}
          </p>
          {stats.missingDateGaps.length > 0 && (
            <div className="mt-1.5 flex items-start gap-1.5">
              <svg className="w-3.5 h-3.5 text-[var(--status-warn)] flex-shrink-0 mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
              <div>
                <p className="font-medium text-[var(--status-warn)]">
                  Missing data detected
                </p>
                {stats.missingDateGaps.map((gap, i) => (
                  <p key={i} className="text-[var(--text-muted)]">
                    {formatGap(gap)}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-[var(--text-muted)]">Total Hours</p>
          <p className="font-medium mt-0.5 tabular-nums text-[var(--text-primary)]">
            {stats.totalHours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="font-normal text-[var(--text-muted)]">
              across {stats.totalEntries.toLocaleString()} entries
            </span>
          </p>
        </div>

        <div>
          <p className="text-[var(--text-muted)]">Team Members</p>
          <p className="font-medium mt-0.5 text-[var(--text-primary)]">
            {stats.peopleCount} total{' '}
            <span className="font-normal text-[var(--text-muted)]">
              ({stats.engineerCount} eng, {stats.techCount} lab
              {stats.unclassifiedCount > 0 && `, ${stats.unclassifiedCount} other`})
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
