import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { ProjectType } from '../../types';
import type { ProjectMilestone } from '../../types';
import { getProjectParent } from '../../aggregation/projectUtils';
import { useFilters } from '../../context/ViewFilterContext';
import { ChartLoader } from '../../charts/ChartLoader';

// ─── Types ───────────────────────────────────────────────────────────────────

type MilestoneKey = 'dr1' | 'dr2' | 'dr3' | 'launch';
type MilestoneStatus = 'complete' | 'on_track' | 'at_risk' | 'overdue' | 'upcoming';

const GATE_ORDER: MilestoneKey[] = ['dr1', 'dr2', 'dr3', 'launch'];
const GATE_LABEL: Record<MilestoneKey, string> = { dr1: 'DR1', dr2: 'DR2', dr3: 'DR3', launch: 'Launch' };

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  complete: '#3b82f6',
  on_track: '#22c55e',
  at_risk:  '#f59e0b',
  overdue:  '#ef4444',
  upcoming: '#9ca3af',
};

const STATUS_LABEL: Record<MilestoneStatus, string> = {
  complete: 'Complete',
  on_track: 'On track',
  at_risk:  'At risk',
  overdue:  'Overdue',
  upcoming: 'Upcoming',
};

// ─── Layout constants ────────────────────────────────────────────────────────

const LABEL_COL = 180;  // px — project name column
const DOT_D     = 11;   // dot diameter px
const DOT_R     = DOT_D / 2;
const ROW_H     = 62;   // row height px
const HEADER_H  = 44;   // header height px (year row + quarter row)

// ─── Milestone classification ─────────────────────────────────────────────────

function classifyMilestones(m: ProjectMilestone, today: Date): Record<MilestoneKey, MilestoneStatus> {
  const t = today.getTime();

  if (!GATE_ORDER.some(k => m[k] !== null)) {
    return { dr1: 'upcoming', dr2: 'upcoming', dr3: 'upcoming', launch: 'upcoming' };
  }
  if (m.launch) {
    const d = new Date(m.launch + 'T00:00:00');
    if (d.getTime() <= t) {
      return { dr1: 'complete', dr2: 'complete', dr3: 'complete', launch: 'complete' };
    }
  }

  let current = -1;
  for (let i = 0; i < GATE_ORDER.length; i++) {
    const s = m[GATE_ORDER[i]];
    if (s && new Date(s + 'T00:00:00').getTime() <= t) current = i;
  }

  const next = current + 1;
  const out: Record<MilestoneKey, MilestoneStatus> = {
    dr1: 'upcoming', dr2: 'upcoming', dr3: 'upcoming', launch: 'upcoming',
  };
  for (let i = 0; i < GATE_ORDER.length; i++) {
    const key = GATE_ORDER[i];
    if (i <= current) {
      out[key] = 'complete';
    } else if (i === next) {
      const s = m[key];
      if (!s) { out[key] = 'upcoming'; continue; }
      const days = Math.ceil((new Date(s + 'T00:00:00').getTime() - t) / 86400000);
      out[key] = days < 0 ? 'overdue' : days <= 30 ? 'at_risk' : 'on_track';
    }
  }
  return out;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

// Returns 0–100 percentage position within the full timeline span.
// This is purely mathematical — no pixel measurements needed.
function dateToPct(date: Date, tStart: Date, nMonths: number): number {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const mOff = monthsBetween(tStart, date);
  return ((mOff + (date.getDate() - 1) / daysInMonth) / nMonths) * 100;
}

function fmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TooltipState {
  clientX: number;
  clientY: number;
  gateLabel: string;
  date: string;
  status: MilestoneStatus;
}

export function NPDMilestonesPanel() {
  const { selectedProject } = useFilters();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const today = useMemo(() => new Date(), []);

  const projects = useLiveQuery(() =>
    db.projects.where('type').equals(ProjectType.NPD).toArray()
  );

  const milestones = useLiveQuery(async () => {
    if (!projects || projects.length === 0) return null;
    let ids = projects.map(p => p.project_id);
    if (selectedProject) {
      ids = ids.filter(id => id === selectedProject || getProjectParent(id) === selectedProject);
    }
    if (ids.length === 0) return [];
    const all = await db.milestones.toArray();
    return all.filter(m => ids.includes(m.project_id));
  }, [projects, selectedProject]);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const derived = useMemo(() => {
    if (!projects || !milestones) return null;

    const visibleProjects = selectedProject
      ? projects.filter(p =>
          p.project_id === selectedProject ||
          getProjectParent(p.project_id) === selectedProject)
      : projects;

    const allDates: number[] = [];
    for (const m of milestones) {
      for (const k of GATE_ORDER) {
        if (m[k]) allDates.push(new Date(m[k]! + 'T00:00:00').getTime());
      }
    }

    const tEarliest = allDates.length > 0 ? new Date(Math.min(...allDates)) : today;
    const tLatest   = allDates.length > 0 ? new Date(Math.max(...allDates)) : today;
    const tStart = startOfMonth(addMonths(new Date(Math.min(tEarliest.getTime(), today.getTime())), -1));
    const tEnd   = addMonths(startOfMonth(new Date(Math.max(tLatest.getTime(),   today.getTime()))), 2);

    const nMonths = monthsBetween(tStart, tEnd) + 1;
    const months: Date[] = [];
    for (let i = 0; i < nMonths; i++) months.push(addMonths(tStart, i));

    const rows = visibleProjects
      .filter(proj => {
        const rec = milestones.find(m => m.project_id === proj.project_id);
        return rec && GATE_ORDER.some(k => rec[k] !== null);
      })
      .map(proj => {
        const rec = milestones.find(m => m.project_id === proj.project_id)!;
        const statuses = classifyMilestones(rec, today);
        const hasOverdue = (Object.values(statuses) as MilestoneStatus[]).includes('overdue');
        let nextActiveDate = Infinity;
        for (const k of GATE_ORDER) {
          const st = statuses[k];
          if ((st === 'on_track' || st === 'at_risk' || st === 'overdue') && rec[k]) {
            nextActiveDate = Math.min(nextActiveDate, new Date(rec[k]! + 'T00:00:00').getTime());
          }
        }
        return { projectId: proj.project_id, projectName: proj.project_name, rec, statuses, hasOverdue, nextActiveDate };
      });

    rows.sort((a, b) => {
      if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
      if (a.nextActiveDate !== b.nextActiveDate) return a.nextActiveDate - b.nextActiveDate;
      return a.projectId.localeCompare(b.projectId);
    });

    return { tStart, months, nMonths, rows };
  }, [projects, milestones, selectedProject, today]);

  // ─── Early returns ────────────────────────────────────────────────────────

  if (!projects || milestones === undefined || milestones === null) return <ChartLoader />;
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        No NPD projects found. Import timesheet data or add projects in Settings → Projects.
      </div>
    );
  }
  if (!derived) return <ChartLoader />;

  const { tStart, months, nMonths, rows } = derived;

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        {selectedProject
          ? 'No milestones defined for this project.'
          : 'No NPD milestones configured. Visit Settings → Milestones to add gate reviews.'}
      </div>
    );
  }

  // ─── Computed values (percentage-based, no pixel measurement) ────────────

  const todayPct = dateToPct(today, tStart, nMonths);

  // Pre-compute grid lines — three tiers of weight:
  //   year start (Jan)  → darkest
  //   quarter start     → medium
  //   month             → lightest
  const gridLines = months
    .map((m, i) => ({ pct: (i / nMonths) * 100, isQuarter: m.getMonth() % 3 === 0 }))
    .filter(g => g.isQuarter);

  // Quarter labels — plain "Q1/Q2/Q3/Q4", year never embedded here
  const quarterLabels = months
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.getMonth() % 3 === 0)
    .map(({ m, i }) => ({ i, text: `Q${Math.floor(m.getMonth() / 3) + 1}` }));

  // Year labels — one per year, anchored at the first visible quarter of that year.
  // If a year starts mid-stream (e.g. only Q4 is visible), it still gets a label
  // positioned above that first visible quarter — not centered over the full year.
  const yearLabels: Array<{ year: number; i: number }> = [];
  quarterLabels.forEach(({ i }) => {
    const yr = months[i].getFullYear();
    if (yearLabels.length === 0 || yearLabels[yearLabels.length - 1].year !== yr) {
      yearLabels.push({ year: yr, i });
    }
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="select-none">
      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 px-1">
        {(Object.keys(STATUS_LABEL) as MilestoneStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="rounded-full flex-shrink-0"
              style={{ width: 9, height: 9, backgroundColor: STATUS_COLOR[s] }} />
            <span className="text-[11px] text-[var(--text-muted)]">{STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex" style={{ height: HEADER_H }}>
        {/* Label column placeholder */}
        <div
          className="flex-shrink-0 border-b border-[var(--border-default)]"
          style={{ width: LABEL_COL, minWidth: LABEL_COL }}
        />
        {/* Timeline header — flex:1 always fills remaining panel width */}
        <div
          className="relative border-b border-[var(--border-default)]"
          style={{ flex: 1, minWidth: 0 }}
        >
          {/* Year labels — top half, aligned above first visible quarter of each year */}
          {yearLabels.map(({ year, i }) => (
            <div
              key={year}
              className="absolute text-[var(--text-muted)] font-semibold"
              style={{
                top:        4,
                left:       `${(i / nMonths) * 100}%`,
                width:      `${(Math.min(3, nMonths - i) / nMonths) * 100}%`,
                fontSize:   10,
                textAlign:  'center',
                lineHeight: '14px',
              }}
            >
              {year}
            </div>
          ))}

          {/* Divider between year row and quarter row */}
          <div
            className="absolute pointer-events-none"
            style={{ top: 22, left: 0, right: 0, height: 1, background: 'var(--border-subtle, #e2e8f0)' }}
          />

          {/* Quarter labels — bottom half, vertically centered in 23–44px zone */}
          {quarterLabels.map(({ i, text }) => (
            <div
              key={i}
              className="absolute text-[var(--text-muted)]"
              style={{
                top:       26,
                left:      `${(i / nMonths) * 100}%`,
                width:     `${(Math.min(3, nMonths - i) / nMonths) * 100}%`,
                fontSize:  10,
                textAlign: 'center',
                lineHeight: '14px',
              }}
            >
              {text}
            </div>
          ))}

          {/* "Today" marker — sits on the divider line between the two rows */}
          <div
            className="absolute z-10 whitespace-nowrap"
            style={{
              top:       14,
              left:      `${todayPct}%`,
              transform: 'translateX(-50%)',
              fontSize:  8,
              fontWeight: 700,
              color:     '#ef4444',
              lineHeight: '10px',
            }}
          >
            ▼
          </div>
        </div>
      </div>

      {/* ── Project rows ───────────────────────────────────────────────────── */}
      {rows.map(row => {
        // Build dot list as percentages — purely date arithmetic, no pixels
        const dots: Array<{
          key: MilestoneKey;
          pct: number;
          status: MilestoneStatus;
          date: string;
        }> = [];

        for (const k of GATE_ORDER) {
          if (row.rec[k]) {
            const d = new Date(row.rec[k]! + 'T00:00:00');
            dots.push({ key: k, pct: dateToPct(d, tStart, nMonths), status: row.statuses[k], date: row.rec[k]! });
          }
        }

        return (
          <div
            key={row.projectId}
            className="flex border-b border-[var(--border-subtle)] hover:bg-[var(--bg-table-hover)] transition-colors"
            style={{ height: ROW_H }}
          >
            {/* Project name */}
            <div
              className="flex-shrink-0 flex flex-col justify-center px-2 border-r border-[var(--border-subtle)]"
              style={{ width: LABEL_COL, minWidth: LABEL_COL }}
            >
              <div
                className="text-xs font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:underline"
                title={row.projectId}
              >
                {row.projectId}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] truncate" title={row.projectName}>
                {row.projectName}
              </div>
            </div>

            {/* Timeline lane — flex:1 fills remaining width */}
            <div
              className="relative"
              style={{ flex: 1, minWidth: 0, height: ROW_H }}
            >
              {/* Grid lines — three tiers: year start darkest, quarter medium, month lightest */}
              {gridLines.map(({ pct }, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{ left: `${pct}%`, width: 1, background: '#cbd5e1' }}
                />
              ))}

              {/* Today vertical line */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `${todayPct}%`, width: 1.5, background: 'rgba(239,68,68,0.35)', zIndex: 10 }}
              />

              {/* Connecting bars — use left+right CSS to avoid needing pixel widths */}
              {dots.map((dot, di) => {
                if (di === 0) return null;
                const prev = dots[di - 1];
                const bothComplete = prev.status === 'complete' && dot.status === 'complete';
                const isActive =
                  prev.status === 'complete' &&
                  (dot.status === 'on_track' || dot.status === 'at_risk' || dot.status === 'overdue');
                const barH     = isActive ? 3 : bothComplete ? 2 : 1;
                const barColor = isActive ? STATUS_COLOR[dot.status] : bothComplete ? '#94a3b8' : '#cbd5e1';
                const isDashed = dot.status === 'upcoming' && prev.status === 'upcoming';

                return (
                  <div
                    key={`bar-${di}`}
                    style={{
                      position:        'absolute',
                      top:             ROW_H / 2 - barH / 2,
                      left:            `calc(${prev.pct}% + ${DOT_R}px)`,
                      right:           `calc(${100 - dot.pct}% + ${DOT_R}px)`,
                      height:          barH,
                      backgroundColor: isDashed ? undefined : barColor,
                      borderTop:       isDashed ? `1px dashed ${barColor}` : undefined,
                      opacity:         isDashed ? 0.5 : 1,
                    }}
                  />
                );
              })}

              {/* Dots + labels */}
              {dots.map((dot, di) => {
                const prev = di > 0 ? dots[di - 1] : null;
                const next = di < dots.length - 1 ? dots[di + 1] : null;
                // Gap in percentage points — show label if dots are far enough apart
                const gapPrev = prev ? dot.pct - prev.pct : Infinity;
                const gapNext = next ? next.pct - dot.pct : Infinity;
                const isImportant = dot.status === 'overdue' || dot.status === 'at_risk' || dot.status === 'on_track';
                const hasSpace    = gapPrev > 4 && gapNext > 4;
                const showLabel   = isImportant || hasSpace;

                return (
                  <div key={dot.key}>
                    {/* Dot */}
                    <div
                      className="absolute rounded-full cursor-pointer"
                      style={{
                        left:            `calc(${dot.pct}% - ${DOT_R}px)`,
                        top:             ROW_H / 2 - DOT_R,
                        width:           DOT_D,
                        height:          DOT_D,
                        backgroundColor: STATUS_COLOR[dot.status],
                        zIndex:          5,
                        boxShadow:       isImportant ? `0 0 0 2px ${STATUS_COLOR[dot.status]}33` : undefined,
                      }}
                      onMouseEnter={e => setTooltip({ clientX: e.clientX, clientY: e.clientY, gateLabel: GATE_LABEL[dot.key], date: dot.date, status: dot.status })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {/* Label */}
                    {showLabel && (
                      <div
                        className="absolute whitespace-nowrap text-[var(--text-muted)] pointer-events-none"
                        style={{
                          left:      `${dot.pct}%`,
                          top:       ROW_H / 2 + DOT_R + 2,
                          fontSize:  9,
                          transform: 'translateX(-50%)',
                          zIndex:    4,
                        }}
                      >
                        {GATE_LABEL[dot.key]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none rounded shadow-lg border border-[var(--border-default)] bg-[var(--bg-panel)]"
          style={{ position: 'fixed', left: tooltip.clientX + 14, top: tooltip.clientY - 10, zIndex: 9999, padding: '6px 10px', minWidth: 140 }}
        >
          <div className="font-semibold text-[var(--text-primary)]" style={{ fontSize: 12 }}>
            {tooltip.gateLabel}
          </div>
          <div className="text-[var(--text-secondary)]" style={{ fontSize: 11, marginTop: 1 }}>
            {fmtDate(tooltip.date)}
          </div>
          <div className="flex items-center gap-1.5" style={{ marginTop: 4 }}>
            <div className="rounded-full flex-shrink-0"
              style={{ width: 8, height: 8, backgroundColor: STATUS_COLOR[tooltip.status] }} />
            <span style={{ fontSize: 11, color: STATUS_COLOR[tooltip.status] }}>
              {STATUS_LABEL[tooltip.status]}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
