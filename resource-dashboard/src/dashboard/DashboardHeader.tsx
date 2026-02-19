import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { useConfig } from '../hooks/useConfig';
import { formatMonth } from '../utils/format';
import { fromDbMonth } from '../utils/monthRange';
import type { DateRange } from '../types';

interface DashboardHeaderProps {
  onTogglePanels: () => void;
  onExport?: () => void;
}

/**
 * Encode a DateRange into a single string for the <select> value.
 * Format: "type:months-csv"  e.g. "single:2026-01" or "quarter:2026-01,2026-02,2026-03"
 */
function encodeRangeKey(range: DateRange): string {
  return `${range.type}:${range.months.join(',')}`;
}

/**
 * Build hierarchical date range options from available months.
 */
function buildDateRangeOptions(availableMonths: string[]) {
  if (availableMonths.length === 0) return { years: [] as string[], byYear: new Map<string, { yearRange: DateRange; quarters: DateRange[]; months: DateRange[] }>() };

  const sorted = [...availableMonths].sort();
  const years = [...new Set(sorted.map(m => m.slice(0, 4)))].sort().reverse();

  const byYear = new Map<string, { yearRange: DateRange; quarters: DateRange[]; months: DateRange[] }>();

  for (const year of years) {
    const yearMonths = sorted.filter(m => m.startsWith(year));

    // Individual months
    const monthOptions: DateRange[] = yearMonths.map(m => ({
      type: 'single' as const,
      months: [m],
      label: formatMonth(m),
    }));

    // Quarters
    const quarterOptions: DateRange[] = [];
    for (let q = 1; q <= 4; q++) {
      const qMonths = yearMonths.filter(m => {
        const mon = parseInt(m.slice(5));
        return mon >= (q - 1) * 3 + 1 && mon <= q * 3;
      });
      if (qMonths.length > 1) {
        quarterOptions.push({
          type: 'quarter' as const,
          months: qMonths,
          label: `Q${q} ${year}`,
        });
      }
    }

    // Full year (only if more than 1 month)
    const yearRange: DateRange = {
      type: 'year' as const,
      months: yearMonths,
      label: `${year} (all months)`,
    };

    byYear.set(year, { yearRange, quarters: quarterOptions, months: monthOptions });
  }

  return { years, byYear };
}

export function DashboardHeader({ onTogglePanels, onExport }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { config, updateConfig } = useConfig();
  const projects = useLiveQuery(() => db.projects.toArray()) ?? [];

  const months = useLiveQuery(async () => {
    const [sheets, allocations] = await Promise.all([
      db.timesheets.toArray(),
      db.plannedAllocations.toArray(),
    ]);
    const monthSet = new Set<string>();
    for (const s of sheets) monthSet.add(fromDbMonth(s.month));
    for (const a of allocations) monthSet.add(a.month);
    return [...monthSet].sort().reverse();
  }) ?? [];

  const { years, byYear } = buildDateRangeOptions(months);

  // Compute current select value from config
  const currentRange = config?.selected_date_range;
  const currentKey = currentRange
    ? encodeRangeKey(currentRange)
    : config?.selected_month
      ? `single:${config.selected_month}`
      : '';

  const handleRangeChange = (value: string) => {
    if (!value) {
      // "All Time" with no months = clear filter
      updateConfig({
        selected_month: '',
        selected_date_range: undefined,
      });
      return;
    }

    const colonIdx = value.indexOf(':');
    const type = value.slice(0, colonIdx) as DateRange['type'];
    const monthsCsv = value.slice(colonIdx + 1);
    const rangeMonths = monthsCsv.split(',');

    if (type === 'single') {
      // Single month: set selected_month for backward compat, clear range
      updateConfig({
        selected_month: rangeMonths[0],
        selected_date_range: undefined,
      });
    } else {
      // Multi-month range: set both
      const labelMap: Record<string, string> = {};
      // Build labels
      for (const [, data] of byYear) {
        if (data.yearRange) labelMap[encodeRangeKey(data.yearRange)] = data.yearRange.label;
        for (const q of data.quarters) labelMap[encodeRangeKey(q)] = q.label;
      }

      const range: DateRange = {
        type,
        months: rangeMonths,
        label: labelMap[value] || `${rangeMonths.length} months`,
      };

      updateConfig({
        selected_month: rangeMonths[rangeMonths.length - 1], // Use last month as primary
        selected_date_range: range,
      });
    }
  };

  const handleProjectChange = (projectId: string) => {
    updateConfig({ selected_project: projectId });
  };

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Left: title + filters */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">
          Dashboard
        </h1>
        <div className="h-5 w-px bg-[var(--border-default)]" />

        <select
          value={currentKey}
          onChange={(e) => handleRangeChange(e.target.value)}
          className="text-[13px] font-medium bg-white border border-[var(--border-input)] rounded-md px-3 py-1.5 text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:border-[var(--border-focus)]"
        >
          <option value="">All Time</option>
          {years.map(year => {
            const data = byYear.get(year);
            if (!data) return null;
            return (
              <optgroup key={year} label={year}>
                {/* Year-level option (only if multiple months) */}
                {data.yearRange.months.length > 1 && (
                  <option value={encodeRangeKey(data.yearRange)}>
                    {data.yearRange.label}
                  </option>
                )}
                {/* Quarter options */}
                {data.quarters.map(q => (
                  <option key={q.label} value={encodeRangeKey(q)}>
                    {q.label}
                  </option>
                ))}
                {/* Individual months */}
                {data.months.map(m => (
                  <option key={m.months[0]} value={encodeRangeKey(m)}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>

        <select
          value={config?.selected_project || ''}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="text-[13px] font-medium bg-white border border-[var(--border-input)] rounded-md px-3 py-1.5 text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:border-[var(--border-focus)]"
        >
          <option value="">All Projects</option>
          <optgroup label="NPD">
            {projects.filter(p => p.type === 'NPD').map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_id} - {p.project_name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Sustaining">
            {projects.filter(p => p.type === 'Sustaining').map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_id} - {p.project_name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 dashboard-header">
        <button
          onClick={() => navigate('/config?tab=kpi-cards')}
          className="text-[12px] font-medium px-2.5 py-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-table-header)] transition-colors"
          title="Configure which KPI cards appear"
        >
          KPI Cards
        </button>
        <button
          onClick={onTogglePanels}
          className="text-[13px] font-medium px-3 py-1.5 rounded-md border border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)] transition-colors"
        >
          Customize
        </button>
        {onExport && (
          <button
            onClick={onExport}
            className="text-[13px] font-medium px-3 py-1.5 rounded-md text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors"
          >
            Export
          </button>
        )}
      </div>
    </div>
  );
}
