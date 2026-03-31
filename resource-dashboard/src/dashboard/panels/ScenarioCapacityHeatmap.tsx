import { useState, useEffect, useCallback, Fragment } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { computeCapacityForecast } from '../../aggregation/capacityForecast';
import { formatMonth } from '../../utils/format';
import { PersonRole } from '../../types';
import type {
  PlanningScenario,
  ScenarioAllocation,
  PlannedAllocation,
  CapacityForecastEntry,
} from '../../types';

// ── Color scale — matches CapacityForecastPanel forecastColor ─────────────────

function cellColor(pct: number): string {
  if (pct === 0)      return '#f8fafc';
  if (pct < 0.5)      return '#e2e8f0';
  if (pct < 0.7)      return '#93c5fd';
  if (pct <= 1.0)     return '#86efac';
  if (pct <= 1.2)     return '#fbbf24';
  return '#ef4444';
}

function cellTextColor(bg: string): string {
  // White text only on the red danger cell
  return bg === '#ef4444' ? '#ffffff' : '#1e293b';
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ── Drill-down sub-components ────────────────────────────────────────────────

const BASELINE_BAR_COLOR = '#94a3b8'; // slate-400 — muted, not competing with heatmap colors
const SCENARIO_BAR_COLOR = '#3b82f6'; // blue-500 — matches scenario window in the timeline

function ProjectBar({
  label,
  hours,
  pctOfCapacity,
  capacityHours,
  color,
}: {
  label: string;
  hours: number;
  pctOfCapacity: number;
  capacityHours: number;
  color: string;
}) {
  const barWidthPct = capacityHours > 0
    ? Math.min((hours / capacityHours) * 100, 100)
    : 0;
  return (
    <div className="flex items-center gap-2.5">
      {/* Bar track */}
      <div className="flex-shrink-0 rounded-sm overflow-hidden" style={{ width: 192, height: 14, backgroundColor: '#f1f5f9' }}>
        <div
          className="h-full rounded-sm"
          style={{ width: `${barWidthPct}%`, backgroundColor: color }}
        />
      </div>
      {/* Label */}
      <span className="text-[11px] text-[var(--text-secondary)] truncate flex-1">{label}</span>
      {/* Hours + pct */}
      <span className="text-[11px] font-medium text-[var(--text-primary)] flex-shrink-0 tabular-nums">
        {Math.round(hours)}h ({Math.round(pctOfCapacity * 100)}%)
      </span>
    </div>
  );
}

function CellDrillDown({
  engineer,
  month,
  baselineEntry,
  overlayEntry,
  scenarioHours,
  scenarioName,
  isAssigned,
}: {
  engineer: string;
  month: string;
  baselineEntry: CapacityForecastEntry | undefined;
  overlayEntry: CapacityForecastEntry | undefined;
  scenarioHours: number;
  scenarioName: string;
  isAssigned: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  const capacity = baselineEntry?.capacity_hours ?? overlayEntry?.capacity_hours ?? 140;

  // Exclude SCENARIO- entries from baseline (defensive — shouldn't be there)
  const baselineProjects = (baselineEntry?.project_allocations ?? [])
    .filter(p => !p.project_id.startsWith('SCENARIO-'));

  const MAX_SHOWN = 5;
  const shownProjects = showAll ? baselineProjects : baselineProjects.slice(0, MAX_SHOWN);
  const hiddenCount = baselineProjects.length - MAX_SHOWN;

  const baselineTotal = baselineEntry?.allocated_hours ?? 0;
  const overlayTotal  = overlayEntry?.allocated_hours  ?? 0;
  const baselinePct   = capacity > 0 ? baselineTotal / capacity : 0;
  const overlayPct    = capacity > 0 ? overlayTotal  / capacity : 0;
  const scenarioPct   = capacity > 0 ? scenarioHours / capacity : 0;

  return (
    <div className="px-4 py-3 bg-[var(--bg-table-header)] border-t border-b border-[var(--border-default)]">
      <div style={{ maxWidth: 680 }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {engineer} · {formatMonth(month)}
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">{capacity}h capacity</span>
      </div>

      {/* ── Baseline project bars ── */}
      {shownProjects.length === 0 ? (
        <p className="text-[11px] text-[var(--text-muted)] italic mb-2">No existing allocations</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {shownProjects.map(proj => (
            <ProjectBar
              key={proj.project_id}
              label={`${proj.project_id} — ${proj.project_name}`}
              hours={proj.allocated_hours}
              pctOfCapacity={proj.allocation_pct}
              capacityHours={capacity}
              color={BASELINE_BAR_COLOR}
            />
          ))}
          {!showAll && hiddenCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setShowAll(true); }}
              className="text-[11px] text-[var(--accent)] hover:underline"
            >
              +{hiddenCount} more…
            </button>
          )}
        </div>
      )}

      {/* ── Scenario section — assigned engineers only ── */}
      {isAssigned && (
        <>
          {/* Dashed divider */}
          <div className="my-2 border-t border-dashed border-[var(--border-default)]" />
          <ProjectBar
            label={`+ ${scenarioName}`}
            hours={scenarioHours}
            pctOfCapacity={scenarioPct}
            capacityHours={capacity}
            color={SCENARIO_BAR_COLOR}
          />
        </>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--border-subtle)] flex-wrap">
        <span className="text-[11px] text-[var(--text-muted)]">
          Baseline: {Math.round(baselineTotal)}h / {capacity}h ({Math.round(baselinePct * 100)}%)
        </span>
        {isAssigned && (
          <>
            <span className="text-[var(--text-muted)]">→</span>
            <span className="text-[11px] font-medium text-[var(--text-primary)]">
              With scenario: {Math.round(overlayTotal)}h ({Math.round(overlayPct * 100)}%)
            </span>
            <span className="ml-auto text-[11px] text-[var(--accent)] font-medium">
              +{Math.round(scenarioHours)}h from scenario
            </span>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

type ForecastPair = {
  baseline:     { entries: CapacityForecastEntry[] };
  withScenario: { entries: CapacityForecastEntry[] };
};

interface ScenarioCapacityHeatmapProps {
  scenario: PlanningScenario;
  allocations: ScenarioAllocation[];
  scenarioMonths: string[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScenarioCapacityHeatmap({
  scenario,
  allocations,
  scenarioMonths,
}: ScenarioCapacityHeatmapProps) {
  const [viewMode, setViewMode]       = useState<'assigned' | 'full'>('assigned');
  const [computing, setComputing]     = useState(false);
  const [forecasts, setForecasts]     = useState<ForecastPair | null>(null);
  const [expandedCell, setExpandedCell] = useState<{ engineer: string; month: string } | null>(null);

  const teamMembers = useLiveQuery(() => db.teamMembers.toArray(), []) ?? [];

  // ── Compute both forecast layers ──────────────────────────────────────────

  const compute = useCallback(async () => {
    if (!allocations.length || !scenarioMonths.length) {
      setForecasts(null);
      return;
    }
    setComputing(true);
    try {
      const overlay: PlannedAllocation[] = [];
      for (const alloc of allocations) {
        for (const month of scenarioMonths) {
          overlay.push({
            month,
            project_id: `SCENARIO-${scenario.id}`,
            engineer: alloc.engineer,
            allocation_pct: alloc.allocation_pct,
            planned_hours: alloc.planned_hours,
          });
        }
      }
      const [baseline, withScenario] = await Promise.all([
        computeCapacityForecast(scenarioMonths),
        computeCapacityForecast(scenarioMonths, undefined, overlay),
      ]);
      setForecasts({ baseline, withScenario });
    } finally {
      setComputing(false);
    }
  }, [allocations, scenarioMonths, scenario.id]);

  // Auto-compute, debounced 500 ms
  useEffect(() => {
    if (!allocations.length || !scenarioMonths.length) {
      setForecasts(null);
      return;
    }
    const t = setTimeout(compute, 500);
    return () => clearTimeout(t);
  }, [compute]);

  // Close drill-down when engineer list or months change
  useEffect(() => {
    setExpandedCell(null);
  }, [allocations, scenarioMonths]);

  // ── Empty / loading states ────────────────────────────────────────────────

  if (allocations.length === 0) {
    return <p className="text-[12px] text-[var(--text-muted)]">Assign engineers to see capacity impact.</p>;
  }
  if (!scenarioMonths.length) {
    return <p className="text-[12px] text-[var(--text-muted)]">Set allocation hours to see capacity impact.</p>;
  }

  // ── Build lookup maps from fetched data ───────────────────────────────────

  const assignedSet = new Set(allocations.map(a => a.engineer));

  const baselineEntryMap  = new Map<string, CapacityForecastEntry>();
  const overlayEntryMap   = new Map<string, CapacityForecastEntry>();

  if (forecasts) {
    for (const e of forecasts.baseline.entries)     baselineEntryMap.set(`${e.engineer}|${e.month}`, e);
    for (const e of forecasts.withScenario.entries) overlayEntryMap.set(`${e.engineer}|${e.month}`, e);
  }

  // ── Engineers to display ──────────────────────────────────────────────────

  const fullTeam = teamMembers
    .filter(m => m.role === PersonRole.Engineer && !m.exclude_from_capacity)
    .map(m => m.full_name)
    .sort();

  const displayEngineers = viewMode === 'assigned'
    ? allocations.map(a => a.engineer).sort()
    : fullTeam;

  // ── Feasibility + over-capacity ───────────────────────────────────────────

  let maxOverlayUtil = 0;
  const overCapacitySet = new Set<string>();

  if (forecasts) {
    for (const eng of assignedSet) {
      for (const month of scenarioMonths) {
        const e = overlayEntryMap.get(`${eng}|${month}`);
        if (e) {
          if (e.utilization_pct > maxOverlayUtil) maxOverlayUtil = e.utilization_pct;
          if (e.utilization_pct > 1.0) overCapacitySet.add(eng);
        }
      }
    }
  }

  const feasibility      = maxOverlayUtil > 1.2 ? 'Conflict' : maxOverlayUtil > 1.0 ? 'Tight' : 'Fits';
  const feasibilityColor = maxOverlayUtil > 1.2 ? 'text-red-600' : maxOverlayUtil > 1.0 ? 'text-amber-600' : 'text-emerald-600';
  const totalHoursPerMonth = allocations.reduce((s, a) => s + a.planned_hours, 0);

  // Total columns for drill-down colSpan
  const totalCols = scenarioMonths.length + 1;

  // ── Cell toggle ───────────────────────────────────────────────────────────

  function toggleCell(engineer: string, month: string) {
    setExpandedCell(prev =>
      prev?.engineer === engineer && prev?.month === month
        ? null
        : { engineer, month }
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ── Toggle ── */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-[var(--border-default)] overflow-hidden text-[11px]">
          {(['assigned', 'full'] as const).map((mode, i) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-row-hover)]'
              } ${i > 0 ? 'border-l border-[var(--border-default)]' : ''}`}
            >
              {mode === 'assigned' ? 'Assigned only' : 'Full team'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading pulse bar ── */}
      {computing && (
        <div className="h-0.5 rounded-full overflow-hidden bg-[var(--accent-light)]">
          <div className="h-full bg-[var(--accent)] w-3/5 animate-pulse" />
        </div>
      )}

      {/* ── Main content (fades during recompute) ── */}
      <div style={{ opacity: computing ? 0.5 : 1, transition: 'opacity 0.2s' }}>

        {/* Heatmap grid */}
        {forecasts ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-[var(--bg-table-header)]">
                  <th
                    className="sticky left-0 z-10 bg-[var(--bg-table-header)] px-3 py-2 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide border-b border-r border-[var(--border-default)]"
                    style={{ minWidth: 148 }}
                  >
                    Engineer
                  </th>
                  {scenarioMonths.map(month => (
                    <th
                      key={month}
                      className="px-1 py-2 text-center text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide border-b border-[var(--border-default)] whitespace-nowrap"
                      style={{ minWidth: 96 }}
                    >
                      {formatMonth(month)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayEngineers.map((eng, i) => {
                  const isAssigned   = assignedSet.has(eng);
                  const isExpanded   = expandedCell?.engineer === eng;
                  const rowBg        = i % 2 === 1 ? 'var(--bg-table-alt, #fafafa)' : undefined;
                  const stickyBg     = i % 2 === 1 ? 'var(--bg-table-alt, #fafafa)' : 'var(--bg-panel, #ffffff)';

                  // Scenario hours for this engineer (from allocations prop)
                  const scenarioHours = allocations.find(a => a.engineer === eng)?.planned_hours ?? 0;

                  return (
                    <Fragment key={eng}>
                      {/* Engineer row */}
                      <tr
                        className="border-b border-[var(--border-subtle)]"
                        style={{ backgroundColor: rowBg }}
                      >
                        {/* Engineer name cell */}
                        <td
                          className="sticky left-0 z-10 px-3 py-1.5 border-r border-[var(--border-subtle)] font-medium text-[var(--text-primary)] whitespace-nowrap"
                          style={{ fontSize: 12, backgroundColor: stickyBg }}
                        >
                          {eng}
                          {isAssigned && (
                            <span
                              className="ml-1.5 inline-block rounded-full bg-[var(--accent)] align-middle"
                              style={{ width: 6, height: 6 }}
                            />
                          )}
                        </td>

                        {/* Month cells — clickable */}
                        {scenarioMonths.map(month => {
                          const base      = baselineEntryMap.get(`${eng}|${month}`);
                          const overlay   = overlayEntryMap.get(`${eng}|${month}`);
                          const baseUtil  = base?.utilization_pct ?? 0;
                          const overlayUtil = overlay?.utilization_pct ?? 0;
                          const displayPct  = isAssigned ? overlayUtil : baseUtil;
                          const bg = cellColor(displayPct);
                          const fg = cellTextColor(bg);
                          const isActive = expandedCell?.engineer === eng && expandedCell?.month === month;

                          return (
                            <td
                              key={month}
                              className="p-0.5 text-center border-[var(--border-subtle)] cursor-pointer"
                              onClick={() => toggleCell(eng, month)}
                            >
                              <span
                                className={`inline-flex items-center justify-center rounded w-full px-1 transition-all ${
                                  isActive
                                    ? 'ring-2 ring-inset ring-[var(--accent)]'
                                    : 'hover:brightness-90'
                                }`}
                                style={{ backgroundColor: bg, color: fg, fontSize: 11, height: 24 }}
                              >
                                {isAssigned ? (
                                  <>
                                    <span style={{ opacity: 0.65, fontWeight: 400 }}>{pct(baseUtil)}</span>
                                    <span style={{ opacity: 0.45, margin: '0 2px' }}>→</span>
                                    <span style={{ fontWeight: 700 }}>{pct(overlayUtil)}</span>
                                  </>
                                ) : (
                                  <span style={{ fontWeight: 500 }}>{pct(baseUtil)}</span>
                                )}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Drill-down detail row — only for the expanded cell of this engineer */}
                      {isExpanded && expandedCell && (
                        <tr>
                          <td colSpan={totalCols} className="p-0">
                            <CellDrillDown
                              engineer={eng}
                              month={expandedCell.month}
                              baselineEntry={baselineEntryMap.get(`${eng}|${expandedCell.month}`)}
                              overlayEntry={overlayEntryMap.get(`${eng}|${expandedCell.month}`)}
                              scenarioHours={scenarioHours}
                              scenarioName={scenario.name}
                              isAssigned={isAssigned}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Initial loading skeleton */
          <div className="rounded-lg border border-[var(--border-default)] px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">
            {computing ? 'Computing…' : 'Calculating…'}
          </div>
        )}
      </div>

      {/* ── Summary stat cards ── */}
      {forecasts && (
        <div className="flex gap-3 flex-wrap">
          <div className="rounded-lg border border-[var(--border-default)] px-3 py-2 min-w-[140px]">
            <p className="text-[10px] text-[var(--text-muted)]">Additional hours</p>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
              {totalHoursPerMonth.toFixed(0)}h/mo × {scenarioMonths.length}mo
            </p>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 min-w-[140px] ${
              overCapacitySet.size > 0 ? 'border-red-200' : 'border-[var(--border-default)]'
            }`}
          >
            <p className="text-[10px] text-[var(--text-muted)]">Over capacity</p>
            <p className={`text-[13px] font-semibold ${overCapacitySet.size > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {overCapacitySet.size > 0
                ? `${overCapacitySet.size} engineer${overCapacitySet.size > 1 ? 's' : ''}`
                : 'None'}
            </p>
            {overCapacitySet.size > 0 && (
              <p className="text-[10px] text-red-400 mt-0.5 truncate">
                {[...overCapacitySet].map(e => e.split(' ')[0]).join(', ')}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-[var(--border-default)] px-3 py-2 min-w-[100px]">
            <p className="text-[10px] text-[var(--text-muted)]">Feasibility</p>
            <p className={`text-[13px] font-semibold ${feasibilityColor}`}>{feasibility}</p>
          </div>
        </div>
      )}
    </div>
  );
}
