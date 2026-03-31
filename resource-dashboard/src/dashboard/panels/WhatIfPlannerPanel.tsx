import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useScenarios } from '../../hooks/useScenarios';
import {
  rankCandidatesForScenario,
  projectCompletion,
  monthRange,
} from '../../aggregation/scenarioSkillFit';
import type { CandidateRanking } from '../../aggregation/scenarioSkillFit';
import { computeCapacityForecast } from '../../aggregation/capacityForecast';
import { getEngineerCapacity } from '../../utils/capacity';
import { formatMonth } from '../../utils/format';
import { ChartLoader } from '../../charts/ChartLoader';
import { MonthRangePicker, addMonths as mrpAddMonths } from '../MonthRangePicker';
import type { PlanningScenario, ScenarioAllocation, PlannedAllocation } from '../../types';

// ─────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PlanningScenario['status'] }) {
  const cls =
    status === 'draft'
      ? 'bg-yellow-100 text-yellow-700'
      : status === 'active'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'danger-ghost';
function Btn({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: BtnVariant;
}) {
  const cls =
    variant === 'primary'
      ? 'bg-[var(--accent)] text-white hover:opacity-90'
      : variant === 'secondary'
      ? 'text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-row-hover)]'
      : variant === 'danger'
      ? 'bg-red-500 text-white hover:bg-red-600'
      : 'text-red-500 border border-red-200 hover:bg-red-50';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${cls} disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  children,
  allowOverflow = false,
}: {
  title: string;
  children: React.ReactNode;
  allowOverflow?: boolean;
}) {
  return (
    <div className={`border border-[var(--border-default)] rounded-lg ${allowOverflow ? '' : 'overflow-hidden'}`}>
      <div className="px-4 py-2.5 bg-[var(--bg-table-header)] border-b border-[var(--border-default)] rounded-t-lg">
        <h3 className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const inputCls =
  'w-full px-2.5 py-1.5 text-[12px] border border-[var(--border-default)] rounded bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';

// ─────────────────────────────────────────────────────────────
// Skill Tag Selector
// ─────────────────────────────────────────────────────────────

function SkillTagSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const skillCategories = useLiveQuery(() => db.skillCategories.toArray(), []) ?? [];

  // Group by category
  const grouped = new Map<string, string[]>();
  for (const s of skillCategories) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category)!.push(s.name);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(skill: string) {
    if (selected.includes(skill)) {
      onChange(selected.filter(s => s !== skill));
    } else {
      onChange([...selected, skill]);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`${inputCls} text-left flex items-center justify-between`}
      >
        <span className={selected.length === 0 ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}>
          {selected.length === 0 ? 'Select required skills…' : `${selected.length} skill${selected.length !== 1 ? 's' : ''} selected`}
        </span>
        <span className="text-[var(--text-muted)]">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 left-0 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-[var(--border-default)] rounded-lg shadow-lg">
          {[...grouped.entries()].map(([cat, skills]) => (
            <div key={cat}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide bg-[var(--bg-table-header)] border-b border-[var(--border-subtle)]">
                {cat}
              </div>
              {skills.map(skill => (
                <label
                  key={skill}
                  className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--bg-row-hover)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(skill)}
                    onChange={() => toggle(skill)}
                    className="rounded"
                  />
                  <span className="text-[12px] text-[var(--text-primary)]">{skill}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-full"
            >
              {tag}
              <button
                onClick={() => toggle(tag)}
                className="text-[var(--accent)] hover:text-red-500 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skill Fit color
// ─────────────────────────────────────────────────────────────

function fitColor(pct: number): string {
  if (pct >= 70) return 'text-green-600';
  if (pct >= 40) return 'text-amber-500';
  return 'text-red-500';
}

// ─────────────────────────────────────────────────────────────
// Scenario List
// ─────────────────────────────────────────────────────────────

interface ListProps {
  scenarios: PlanningScenario[];
  onCreate: () => void;
  onSelect: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
}

function ScenarioList({ scenarios, onCreate, onSelect, onDuplicate, onDelete }: ListProps) {
  const active = scenarios.filter(s => s.status !== 'archived');
  const archived = scenarios.filter(s => s.status === 'archived');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--text-muted)]">
          {active.length === 0
            ? 'No scenarios yet.'
            : `${active.length} scenario${active.length !== 1 ? 's' : ''}`}
        </p>
        <Btn onClick={onCreate}>+ New Scenario</Btn>
      </div>

      {active.length === 0 && (
        <div className="text-center py-10 border border-dashed border-[var(--border-default)] rounded-lg">
          <p className="text-[13px] text-[var(--text-muted)]">
            Model hypothetical projects against current team capacity.
          </p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            Create a scenario to see skill fit, projected timeline, and capacity impact.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {active.map(s => {
          const completion = s.target_hours > 0 ? null : null; // computed in editor
          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id!)}
              className="flex items-start gap-3 p-3 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg cursor-pointer hover:border-[var(--accent)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {s.name}
                  </span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {s.start_month ? `Starting ${formatMonth(s.start_month)}` : 'No start month'}
                  {(s.target_hours ?? 0) > 0 ? ` · ${s.target_hours}h target` : ''}
                </p>
                {(s.skill_tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(s.skill_tags ?? []).slice(0, 4).map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {(s.skill_tags ?? []).length > 4 && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        +{(s.skill_tags ?? []).length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div
                className="flex gap-1.5 flex-shrink-0 mt-0.5"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => onDuplicate(s.id!)}
                  className="px-2 py-1 text-[11px] text-[var(--text-muted)] border border-[var(--border-default)] rounded hover:bg-[var(--bg-row-hover)] transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => onDelete(s.id!)}
                  className="px-2 py-1 text-[11px] text-red-400 border border-red-100 rounded hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          );
          void completion; // suppress unused warning
        })}
      </div>

      {archived.length > 0 && (
        <details className="mt-1">
          <summary className="text-[11px] text-[var(--text-muted)] cursor-pointer select-none hover:text-[var(--text-primary)]">
            {archived.length} archived
          </summary>
          <div className="mt-2 pl-3 border-l border-[var(--border-subtle)] space-y-1">
            {archived.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                <span>{s.name}</span>
                <button
                  onClick={() => onSelect(s.id!)}
                  className="underline hover:text-[var(--text-primary)]"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Swim Lane Timeline  (mirrors NPDMilestonesPanel exactly)
// ─────────────────────────────────────────────────────────────

// ── Layout constants — identical to NPDMilestonesPanel ───────
const SL_LABEL_COL = 180;
const SL_DOT_D     = 11;
const SL_DOT_R     = SL_DOT_D / 2;
const SL_ROW_H     = 62;
const SL_HEADER_H  = 44;

// ── Milestone types ──────────────────────────────────────────
type SLMilestoneKey    = 'dr1' | 'dr2' | 'dr3' | 'launch';
type SLMilestoneStatus = 'complete' | 'on_track' | 'at_risk' | 'overdue' | 'upcoming';

const SL_GATE_ORDER: SLMilestoneKey[] = ['dr1', 'dr2', 'dr3', 'launch'];
const SL_GATE_LABEL: Record<SLMilestoneKey, string> = { dr1: 'DR1', dr2: 'DR2', dr3: 'DR3', launch: 'Launch' };
const SL_STATUS_COLOR: Record<SLMilestoneStatus, string> = {
  complete: '#3b82f6', on_track: '#22c55e', at_risk: '#f59e0b', overdue: '#ef4444', upcoming: '#9ca3af',
};
const SL_STATUS_LABEL: Record<SLMilestoneStatus, string> = {
  complete: 'Complete', on_track: 'On track', at_risk: 'At risk', overdue: 'Overdue', upcoming: 'Upcoming',
};

// ── Date helpers — identical to NPDMilestonesPanel ───────────
function slStartOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function slAddMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function slMonthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}
function slDateToPct(date: Date, tStart: Date, nMonths: number): number {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const mOff = slMonthsBetween(tStart, date);
  return ((mOff + (date.getDate() - 1) / daysInMonth) / nMonths) * 100;
}
function slFmtDate(s: string): string {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Milestone status classification — identical to NPDMilestonesPanel ──
function slClassify(rec: Record<SLMilestoneKey, string | null>, today: Date): Record<SLMilestoneKey, SLMilestoneStatus> {
  const t = today.getTime();
  if (!SL_GATE_ORDER.some(k => rec[k] !== null)) {
    return { dr1: 'upcoming', dr2: 'upcoming', dr3: 'upcoming', launch: 'upcoming' };
  }
  if (rec.launch) {
    if (new Date(rec.launch + 'T00:00:00').getTime() <= t) {
      return { dr1: 'complete', dr2: 'complete', dr3: 'complete', launch: 'complete' };
    }
  }
  let current = -1;
  for (let i = 0; i < SL_GATE_ORDER.length; i++) {
    const s = rec[SL_GATE_ORDER[i]];
    if (s && new Date(s + 'T00:00:00').getTime() <= t) current = i;
  }
  const next = current + 1;
  const out: Record<SLMilestoneKey, SLMilestoneStatus> = { dr1: 'upcoming', dr2: 'upcoming', dr3: 'upcoming', launch: 'upcoming' };
  for (let i = 0; i < SL_GATE_ORDER.length; i++) {
    const key = SL_GATE_ORDER[i];
    if (i <= current) {
      out[key] = 'complete';
    } else if (i === next) {
      const s = rec[key];
      if (!s) { out[key] = 'upcoming'; continue; }
      const days = Math.ceil((new Date(s + 'T00:00:00').getTime() - t) / 86400000);
      out[key] = days < 0 ? 'overdue' : days <= 30 ? 'at_risk' : 'on_track';
    }
  }
  return out;
}

interface SwimLaneProps {
  startMonth: string;       // YYYY-MM
  completionMonth: string;  // YYYY-MM
  scenarioName: string;
  status: PlanningScenario['status'];
}

interface SLTooltip { clientX: number; clientY: number; gateLabel: string; date: string; status: SLMilestoneStatus; }

function SwimLane({ startMonth, completionMonth, scenarioName, status }: SwimLaneProps) {
  const [tooltip, setTooltip] = useState<SLTooltip | null>(null);
  const today = new Date();

  const allMilestones = useLiveQuery(() => db.milestones.toArray(), []) ?? [];
  const npdProjects   = useLiveQuery(() => db.projects.where('type').equals('NPD').toArray(), []) ?? [];
  const projectMap    = new Map(npdProjects.map(p => [p.project_id, p.project_name]));

  // ── Build time window ────────────────────────────────────
  // Left edge: scenario start (past) or today (future scenario).
  // Right edge: projected completion + 1 month breathing room.
  const scenarioStartDate = new Date(startMonth + '-01T00:00:00');
  const winStart = scenarioStartDate <= today
    ? slStartOfMonth(new Date(startMonth + '-01'))
    : slStartOfMonth(today);
  const winStartYM = `${winStart.getFullYear()}-${String(winStart.getMonth() + 1).padStart(2, '0')}`;
  const winEnd   = slStartOfMonth(slAddMonths(new Date(completionMonth + '-01'), 1));
  const nMonths  = slMonthsBetween(winStart, winEnd) + 1;
  const months: Date[] = [];
  for (let i = 0; i < nMonths; i++) months.push(slAddMonths(winStart, i));

  const todayPct = slDateToPct(today, winStart, nMonths);

  // ── Quarter / year header data ───────────────────────────
  const quarterLabels = months
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.getMonth() % 3 === 0)
    .map(({ m, i }) => ({ i, text: `Q${Math.floor(m.getMonth() / 3) + 1}` }));

  const yearLabels: Array<{ year: number; i: number }> = [];
  quarterLabels.forEach(({ i }) => {
    const yr = months[i].getFullYear();
    if (yearLabels.length === 0 || yearLabels[yearLabels.length - 1].year !== yr) {
      yearLabels.push({ year: yr, i });
    }
  });

  const gridLines = months
    .map((m, i) => ({ pct: (i / nMonths) * 100, isQuarter: m.getMonth() % 3 === 0 }))
    .filter(g => g.isQuarter);

  // ── Scenario bar — scenario months use 1st-of-month dates ──
  const scenarioBarStartPct = slDateToPct(new Date(startMonth + '-01'), winStart, nMonths);
  const scenarioBarEndPct   = slDateToPct(new Date(completionMonth + '-01'), winStart, nMonths);
  const scenarioBarColor    = status === 'active' ? '#22c55e' : '#3b82f6';

  // ── NPD milestone rows overlapping [winStartYM, completionMonth] ──
  // inWindow = true for all real dots (they're all >= winStart after filtering).
  // Sentinel dots (inWindow: false) are injected at the left edge for projects
  // that have gate history before winStart — their bar becomes a headless tail
  // anchored at the graph's left edge (0%).

  type MilRow = {
    projectId: string;
    projectName: string;
    rec: Record<SLMilestoneKey, string | null>;
    statuses: Record<SLMilestoneKey, SLMilestoneStatus>;
    dots: Array<{ key: SLMilestoneKey; pct: number; status: SLMilestoneStatus; date: string; inWindow: boolean }>;
  };

  const milRows: MilRow[] = [];
  for (const m of allMilestones) {
    const rec: Record<SLMilestoneKey, string | null> = { dr1: m.dr1, dr2: m.dr2, dr3: m.dr3, launch: m.launch };
    // Include row if any gate falls within the visible graph window
    const hasOverlap = SL_GATE_ORDER.some(k => {
      if (!rec[k]) return false;
      const ym = rec[k]!.slice(0, 7);
      return ym >= winStartYM && ym <= completionMonth;
    });
    if (!hasOverlap) continue;

    const statuses = slClassify(rec, today);
    const dots: MilRow['dots'] = [];
    for (const k of SL_GATE_ORDER) {
      if (!rec[k]) continue;
      const d = new Date(rec[k]! + 'T00:00:00');
      if (d < winStart) continue; // completely off the left edge of the display — skip
      dots.push({
        key: k,
        pct: slDateToPct(d, winStart, nMonths),
        status: statuses[k],
        date: rec[k]!,
        inWindow: true, // all real dots are >= winStart
      });
    }
    if (dots.length === 0) continue;

    // If the project has gate history before the graph left edge (winStart),
    // inject a virtual sentinel at pct=-1 so the connecting bar starts at 0%
    // (a headless tail from the graph edge to the first visible dot).
    const hasPreWindowDates = SL_GATE_ORDER.some(
      k => rec[k] && new Date(rec[k]! + 'T00:00:00') < winStart,
    );
    if (hasPreWindowDates && dots.length > 0) {
      dots.unshift({
        key: 'dr1' as SLMilestoneKey, // sentinel — never rendered as a visible dot
        pct: -1,
        status: 'complete',
        date: winStartYM + '-01',
        inWindow: false,
      });
    }
    milRows.push({
      projectId: m.project_id,
      projectName: projectMap.get(m.project_id) ?? m.project_id,
      rec, statuses, dots,
    });
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="select-none">
      {/* Legend — same as NPD panel */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 px-1">
        {(Object.keys(SL_STATUS_LABEL) as SLMilestoneStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="rounded-full flex-shrink-0" style={{ width: 9, height: 9, backgroundColor: SL_STATUS_COLOR[s] }} />
            <span className="text-[11px] text-[var(--text-muted)]">{SL_STATUS_LABEL[s]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="rounded flex-shrink-0" style={{ width: 18, height: 9, backgroundColor: scenarioBarColor, opacity: 0.8 }} />
          <span className="text-[11px] text-[var(--text-muted)]">Scenario window</span>
        </div>
      </div>

      {/* ── Header — year + quarter rows, identical to NPD panel ── */}
      <div className="flex" style={{ height: SL_HEADER_H }}>
        <div className="flex-shrink-0 border-b border-[var(--border-default)]" style={{ width: SL_LABEL_COL, minWidth: SL_LABEL_COL }} />
        <div className="relative border-b border-[var(--border-default)]" style={{ flex: 1, minWidth: 0 }}>
          {/* Year labels */}
          {yearLabels.map(({ year, i }) => (
            <div
              key={year}
              className="absolute text-[var(--text-muted)] font-semibold"
              style={{ top: 4, left: `${(i / nMonths) * 100}%`, width: `${(Math.min(3, nMonths - i) / nMonths) * 100}%`, fontSize: 10, textAlign: 'center', lineHeight: '14px' }}
            >
              {year}
            </div>
          ))}
          {/* Divider between year and quarter rows */}
          <div className="absolute pointer-events-none" style={{ top: 22, left: 0, right: 0, height: 1, background: 'var(--border-subtle, #e2e8f0)' }} />
          {/* Quarter labels */}
          {quarterLabels.map(({ i, text }) => (
            <div
              key={i}
              className="absolute text-[var(--text-muted)]"
              style={{ top: 26, left: `${(i / nMonths) * 100}%`, width: `${(Math.min(3, nMonths - i) / nMonths) * 100}%`, fontSize: 10, textAlign: 'center', lineHeight: '14px' }}
            >
              {text}
            </div>
          ))}
          {/* Today marker */}
          <div
            className="absolute z-10 whitespace-nowrap"
            style={{ top: 14, left: `${todayPct}%`, transform: 'translateX(-50%)', fontSize: 8, fontWeight: 700, color: '#ef4444', lineHeight: '10px' }}
          >
            ▼
          </div>
        </div>
      </div>

      {/* ── Scenario bar row ─────────────────────────────────── */}
      <div className="flex border-b border-[var(--border-subtle)]" style={{ height: SL_ROW_H }}>
        <div
          className="flex-shrink-0 flex flex-col justify-center px-2 border-r border-[var(--border-subtle)]"
          style={{ width: SL_LABEL_COL, minWidth: SL_LABEL_COL }}
        >
          <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{scenarioName}</div>
          <div className="text-[10px] text-[var(--text-muted)]">Scenario</div>
        </div>
        <div className="relative" style={{ flex: 1, minWidth: 0, height: SL_ROW_H }}>
          {/* Grid lines */}
          {gridLines.map(({ pct }, i) => (
            <div key={i} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pct}%`, width: 1, background: '#cbd5e1' }} />
          ))}
          {/* Today line */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${todayPct}%`, width: 1.5, background: 'rgba(239,68,68,0.35)', zIndex: 10 }} />
          {/* Scenario span bar */}
          <div
            className="absolute rounded"
            style={{
              left:   `${scenarioBarStartPct}%`,
              right:  `${100 - scenarioBarEndPct}%`,
              top:    SL_ROW_H / 2 - 10,
              height: 20,
              backgroundColor: scenarioBarColor,
              opacity: 0.85,
              zIndex: 3,
            }}
          />
          {/* Centered date range label "Jan '26 → Feb '27" */}
          <div
            className="absolute text-white font-medium pointer-events-none overflow-hidden text-center"
            style={{
              left: `${scenarioBarStartPct}%`,
              right: `${100 - scenarioBarEndPct}%`,
              top: SL_ROW_H / 2 - 7,
              fontSize: 9,
              zIndex: 4,
              lineHeight: '14px',
            }}
          >
            {formatMonth(startMonth)} → {formatMonth(completionMonth)}
          </div>
        </div>
      </div>

      {/* ── NPD milestone rows — identical rendering to NPD panel ── */}
      {milRows.length === 0 ? (
        <div className="flex" style={{ height: SL_ROW_H }}>
          <div className="flex-shrink-0 border-r border-[var(--border-subtle)]" style={{ width: SL_LABEL_COL, minWidth: SL_LABEL_COL }} />
          <div className="flex items-center px-4 text-[11px] text-[var(--text-muted)] italic">
            No NPD milestones overlap this scenario's timeline
          </div>
        </div>
      ) : (
        milRows.map(row => (
          <div
            key={row.projectId}
            className="flex border-b border-[var(--border-subtle)] hover:bg-[var(--bg-table-hover)] transition-colors"
            style={{ height: SL_ROW_H }}
          >
            <div
              className="flex-shrink-0 flex flex-col justify-center px-2 border-r border-[var(--border-subtle)]"
              style={{ width: SL_LABEL_COL, minWidth: SL_LABEL_COL }}
            >
              <div className="text-xs font-semibold text-[var(--text-primary)] truncate" title={row.projectId}>{row.projectId}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate" title={row.projectName}>{row.projectName}</div>
            </div>
            <div className="relative" style={{ flex: 1, minWidth: 0, height: SL_ROW_H }}>
              {/* Grid lines */}
              {gridLines.map(({ pct }, i) => (
                <div key={i} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${pct}%`, width: 1, background: '#cbd5e1' }} />
              ))}
              {/* Today line */}
              <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${todayPct}%`, width: 1.5, background: 'rgba(239,68,68,0.35)', zIndex: 10 }} />
              {/* Connecting bars — sentinel dots (inWindow:false) anchor a headless
                  tail from the graph left edge (0%) to the first visible dot. */}
              {row.dots.map((dot, di) => {
                if (di === 0) return null;
                const prev = row.dots[di - 1];
                const bothComplete = prev.status === 'complete' && dot.status === 'complete';
                const isActive = prev.status === 'complete' && (dot.status === 'on_track' || dot.status === 'at_risk' || dot.status === 'overdue');
                const barH     = isActive ? 3 : bothComplete ? 2 : 1;
                const barColor = isActive ? SL_STATUS_COLOR[dot.status] : bothComplete ? '#94a3b8' : '#cbd5e1';
                const isDashed = dot.status === 'upcoming' && prev.status === 'upcoming';
                // Sentinel (inWindow:false) → bar starts at 0% (left edge) with no dot offset
                const barLeftPct = prev.inWindow ? prev.pct : 0;
                const barLeftOffset = prev.inWindow ? `${SL_DOT_R}px` : '0px';
                return (
                  <div
                    key={`bar-${di}`}
                    style={{
                      position: 'absolute',
                      top:   SL_ROW_H / 2 - barH / 2,
                      left:  `calc(${barLeftPct}% + ${barLeftOffset})`,
                      right: `calc(${100 - dot.pct}% + ${SL_DOT_R}px)`,
                      height: barH,
                      backgroundColor: isDashed ? undefined : barColor,
                      borderTop: isDashed ? `1px dashed ${barColor}` : undefined,
                      opacity: isDashed ? 0.5 : 1,
                    }}
                  />
                );
              })}
              {/* Dots + labels — only rendered for dots within the scenario window */}
              {row.dots.map((dot, di) => {
                if (!dot.inWindow) return null;
                const prev = di > 0 ? row.dots[di - 1] : null;
                const next = di < row.dots.length - 1 ? row.dots[di + 1] : null;
                const gapPrev = prev ? dot.pct - prev.pct : Infinity;
                const gapNext = next ? next.pct - dot.pct : Infinity;
                const isImportant = dot.status === 'overdue' || dot.status === 'at_risk' || dot.status === 'on_track';
                const showLabel  = isImportant || (gapPrev > 4 && gapNext > 4);
                return (
                  <div key={dot.key}>
                    <div
                      className="absolute rounded-full cursor-pointer"
                      style={{
                        left:   `calc(${dot.pct}% - ${SL_DOT_R}px)`,
                        top:    SL_ROW_H / 2 - SL_DOT_R,
                        width:  SL_DOT_D,
                        height: SL_DOT_D,
                        backgroundColor: SL_STATUS_COLOR[dot.status],
                        zIndex: 5,
                        boxShadow: isImportant ? `0 0 0 2px ${SL_STATUS_COLOR[dot.status]}33` : undefined,
                      }}
                      onMouseEnter={e => setTooltip({ clientX: e.clientX, clientY: e.clientY, gateLabel: SL_GATE_LABEL[dot.key], date: dot.date, status: dot.status })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {showLabel && (
                      <div
                        className="absolute whitespace-nowrap text-[var(--text-muted)] pointer-events-none"
                        style={{ left: `${dot.pct}%`, top: SL_ROW_H / 2 + SL_DOT_R + 2, fontSize: 9, transform: 'translateX(-50%)', zIndex: 4 }}
                      >
                        {SL_GATE_LABEL[dot.key]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Tooltip — identical to NPD panel */}
      {tooltip && (
        <div
          className="pointer-events-none rounded shadow-lg border border-[var(--border-default)] bg-[var(--bg-panel)]"
          style={{ position: 'fixed', left: tooltip.clientX + 14, top: tooltip.clientY - 10, zIndex: 9999, padding: '6px 10px', minWidth: 140 }}
        >
          <div className="font-semibold text-[var(--text-primary)]" style={{ fontSize: 12 }}>{tooltip.gateLabel}</div>
          <div className="text-[var(--text-secondary)]" style={{ fontSize: 11, marginTop: 1 }}>{slFmtDate(tooltip.date)}</div>
          <div className="flex items-center gap-1.5" style={{ marginTop: 4 }}>
            <div className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: SL_STATUS_COLOR[tooltip.status] }} />
            <span style={{ fontSize: 11, color: SL_STATUS_COLOR[tooltip.status] }}>{SL_STATUS_LABEL[tooltip.status]}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Capacity Impact View
// ─────────────────────────────────────────────────────────────

interface CapacityImpactProps {
  scenario: PlanningScenario;
  allocations: ScenarioAllocation[];
  scenarioMonths: string[];
}

function CapacityImpact({ scenario, allocations, scenarioMonths }: CapacityImpactProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    engineer: string;
    before_pct: number;
    after_pct: number;
    delta_pct: number;
  }[] | null>(null);

  const compute = useCallback(async () => {
    if (!allocations.length || !scenarioMonths.length) return;
    setLoading(true);
    try {
      const [baseline, config] = await Promise.all([
        computeCapacityForecast(scenarioMonths),
        db.config.get(1),
      ]);

      // Build overlay: one PlannedAllocation per engineer per month
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

      const withScenario = await computeCapacityForecast(scenarioMonths, undefined, overlay);

      const stdCapacity = config?.std_monthly_capacity_hours ?? 140;
      const assignedEngineers = new Set(allocations.map(a => a.engineer));

      const rows = [...assignedEngineers].map(engineer => {
        const beforeEntries = baseline.entries.filter(e => e.engineer === engineer);
        const afterEntries = withScenario.entries.filter(e => e.engineer === engineer);

        const avgBefore = beforeEntries.length
          ? beforeEntries.reduce((s, e) => s + e.utilization_pct, 0) / beforeEntries.length
          : 0;
        const avgAfter = afterEntries.length
          ? afterEntries.reduce((s, e) => s + e.utilization_pct, 0) / afterEntries.length
          : 0;

        void stdCapacity;

        return {
          engineer,
          before_pct: avgBefore,
          after_pct: avgAfter,
          delta_pct: avgAfter - avgBefore,
        };
      });

      setData(rows.sort((a, b) => b.after_pct - a.after_pct));
    } finally {
      setLoading(false);
    }
  }, [allocations, scenarioMonths, scenario.id]);

  const overCapacityCount = data?.filter(r => r.after_pct > 1.0).length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Btn variant="secondary" onClick={compute} disabled={loading || allocations.length === 0}>
          {loading ? 'Computing…' : 'Compute Impact'}
        </Btn>
        {allocations.length === 0 && (
          <span className="text-[11px] text-[var(--text-muted)]">Assign engineers first.</span>
        )}
      </div>

      {data && (
        <>
          <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--border-default)]">
              <thead className="bg-[var(--bg-table-header)]">
                <tr>
                  {['Engineer', 'Before', 'After', 'Delta', 'Status'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {data.map(row => {
                  const statusIcon =
                    row.after_pct > 1.2
                      ? { icon: '🔴', label: 'Over capacity', cls: 'text-red-500' }
                      : row.after_pct > 1.0
                      ? { icon: '⚠️', label: 'Tight', cls: 'text-amber-500' }
                      : { icon: '✅', label: 'OK', cls: 'text-green-600' };
                  return (
                    <tr key={row.engineer} className="hover:bg-[var(--bg-row-hover)]">
                      <td className="px-4 py-2 text-[12px] font-medium text-[var(--text-primary)]">
                        {row.engineer}
                      </td>
                      <td className="px-4 py-2 text-[12px] text-[var(--text-secondary)]">
                        {Math.round(row.before_pct * 100)}%
                      </td>
                      <td className="px-4 py-2 text-[12px] font-semibold text-[var(--text-primary)]">
                        {Math.round(row.after_pct * 100)}%
                      </td>
                      <td className="px-4 py-2 text-[12px] text-[var(--text-secondary)]">
                        +{Math.round(row.delta_pct * 100)}%
                      </td>
                      <td className={`px-4 py-2 text-[11px] font-medium ${statusIcon.cls}`}>
                        {statusIcon.icon} {statusIcon.label}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 flex-wrap">
            <div className="rounded-lg border border-[var(--border-default)] px-3 py-2">
              <p className="text-[10px] text-[var(--text-muted)]">Total additional hours</p>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                {allocations.reduce((s, a) => s + a.planned_hours, 0).toFixed(0)}h/mo ×{' '}
                {scenarioMonths.length}mo
              </p>
            </div>
            <div className={`rounded-lg border px-3 py-2 ${overCapacityCount > 0 ? 'border-red-200' : 'border-green-200'}`}>
              <p className="text-[10px] text-[var(--text-muted)]">Engineers over capacity</p>
              <p className={`text-[14px] font-semibold ${overCapacityCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                {overCapacityCount > 0 ? overCapacityCount : 'None — fits'}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] px-3 py-2">
              <p className="text-[10px] text-[var(--text-muted)]">Feasibility</p>
              <p className="text-[14px] font-semibold">
                {overCapacityCount === 0 ? '🟢 Fits' : overCapacityCount <= data.length / 2 ? '🟡 Tight' : '🔴 Conflict'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Scenario Editor
// ─────────────────────────────────────────────────────────────

interface EditorProps {
  scenario: PlanningScenario;
  onBack: () => void;
  onDelete: (id: number) => void;
}

function ScenarioEditor({ scenario, onBack, onDelete }: EditorProps) {
  const { updateScenario, saveScenario, saveAllocations } = useScenarios();

  // Section 1 — Project Definition form state
  const [name, setName] = useState(scenario.name);
  const [skillTags, setSkillTags] = useState<string[]>(scenario.skill_tags ?? []);  // ?? [] guards against old DB rows that predate the skill_tags field
  const [startMonth, setStartMonth] = useState(scenario.start_month ?? '');
  const [targetHours, setTargetHours] = useState((scenario.target_hours ?? 0) > 0 ? String(scenario.target_hours) : '');

  // Section 2 — Candidate ranking
  const [candidates, setCandidates] = useState<CandidateRanking[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [tooltipEngineer, setTooltipEngineer] = useState<string | null>(null);

  // Section 3 — Assigned engineers (local state for editing, saved on blur/change)
  // allocationDraft: engineer → { pct: string, hours: string, mode: 'percentage' | 'hours' }
  const [allocationDraft, setAllocationDraft] = useState<
    Map<string, { pct: string; hours: string; mode: 'percentage' | 'hours' }>
  >(new Map());

  // Section 5 — save state
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // DB data
  const teamMembers = useLiveQuery(() => db.teamMembers.toArray(), []) ?? [];
  const config = useLiveQuery(() => db.config.get(1), []);
  const stdCapacity = config?.std_monthly_capacity_hours ?? 140;

  const allocations = useLiveQuery<ScenarioAllocation[]>(
    () =>
      scenario.id
        ? db.scenarioAllocations.where('scenario_id').equals(scenario.id).toArray()
        : Promise.resolve([]),
    [scenario.id],
  ) ?? [];

  // Initialise allocationDraft when allocations load
  useEffect(() => {
    const draft = new Map<string, { pct: string; hours: string; mode: 'percentage' | 'hours' }>();
    for (const a of allocations) {
      draft.set(a.engineer, {
        pct: Math.round(a.allocation_pct * 100).toString(),
        hours: a.planned_hours.toFixed(1),
        mode: a.allocation_mode,
      });
    }
    setAllocationDraft(draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocations.length]); // only reinit when engineer list changes

  const assignedEngineers = new Set(allocations.map(a => a.engineer));

  // Derived: projected completion
  const completion = (() => {
    const hours = parseFloat(targetHours);
    if (!startMonth || isNaN(hours) || hours <= 0) return null;
    return projectCompletion(startMonth, hours, allocations);
  })();

  const scenarioMonths = completion
    ? monthRange(startMonth, completion.durationMonths)
    : startMonth
    ? [startMonth]
    : [];

  // Debounced auto-save scenario fields
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleScenarioSave(updates: Partial<PlanningScenario>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateScenario(scenario.id!, updates);
    }, 600);
  }

  // Auto-rank when skill tags or start month change
  useEffect(() => {
    if (!startMonth) return;
    let cancelled = false;
    setRankLoading(true);
    rankCandidatesForScenario(skillTags, startMonth)
      .then(r => {
        if (!cancelled) setCandidates(r);
      })
      .finally(() => {
        if (!cancelled) setRankLoading(false);
      });
    return () => { cancelled = true; };
  }, [skillTags, startMonth]);

  // Generate 24 months from today for the single-month picker
  const singleMonthOptions = (() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return Array.from({ length: 24 }, (_, i) => mrpAddMonths(ym, i));
  })();

  // Helpers to get engineer capacity
  function getCapacity(engineerName: string): number {
    const m = teamMembers.find(t => t.full_name === engineerName);
    return m ? getEngineerCapacity(m, stdCapacity) : stdCapacity;
  }

  // Add engineer to assigned list
  async function handleAddEngineer(engineer: string) {
    if (!scenario.id) return;
    const cap = getCapacity(engineer);
    const defaultHours = Math.round(cap * 0.5 * 10) / 10; // default 50%
    const newAlloc: Omit<ScenarioAllocation, 'id' | 'scenario_id'> = {
      engineer,
      allocation_pct: 0.5,
      planned_hours: defaultHours,
      allocation_mode: 'percentage',
    };
    await db.scenarioAllocations.add({ ...newAlloc, scenario_id: scenario.id } as ScenarioAllocation);
    setAllocationDraft(prev => {
      const next = new Map(prev);
      next.set(engineer, { pct: '50', hours: defaultHours.toFixed(1), mode: 'percentage' });
      return next;
    });
  }

  // Remove engineer
  async function handleRemoveEngineer(engineer: string) {
    if (!scenario.id) return;
    await db.scenarioAllocations
      .where('scenario_id').equals(scenario.id)
      .and(a => a.engineer === engineer)
      .delete();
    setAllocationDraft(prev => {
      const next = new Map(prev);
      next.delete(engineer);
      return next;
    });
  }

  // Update pct field → auto-fill hours
  function handlePctChange(engineer: string, pctStr: string) {
    const cap = getCapacity(engineer);
    const pct = parseFloat(pctStr);
    const hours = isNaN(pct) ? '' : ((pct / 100) * cap).toFixed(1);
    setAllocationDraft(prev => {
      const next = new Map(prev);
      next.set(engineer, { pct: pctStr, hours, mode: 'percentage' });
      return next;
    });
  }

  // Update hours field → auto-fill pct
  function handleHoursChange(engineer: string, hoursStr: string) {
    const cap = getCapacity(engineer);
    const hours = parseFloat(hoursStr);
    const pct = isNaN(hours) || cap === 0 ? '' : Math.round((hours / cap) * 100).toString();
    setAllocationDraft(prev => {
      const next = new Map(prev);
      next.set(engineer, { pct, hours: hoursStr, mode: 'hours' });
      return next;
    });
  }

  // Persist draft to DB
  async function flushAllocations() {
    if (!scenario.id) return;
    const rows: Omit<ScenarioAllocation, 'id' | 'scenario_id'>[] = [];
    for (const [engineer, draft] of allocationDraft) {
      const pct = parseFloat(draft.pct) / 100;
      const hours = parseFloat(draft.hours);
      if (isNaN(pct) || isNaN(hours)) continue;
      rows.push({
        engineer,
        allocation_pct: Math.min(Math.max(pct, 0), 2),
        planned_hours: Math.max(hours, 0),
        allocation_mode: draft.mode,
      });
    }
    await saveAllocations(scenario.id, rows);
  }

  // Save scenario
  async function handleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await updateScenario(scenario.id!, {
      name,
      skill_tags: skillTags,
      start_month: startMonth,
      target_hours: parseFloat(targetHours) || 0,
    });
    await flushAllocations();
    await saveScenario(scenario.id!);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    onDelete(scenario.id!);
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onBack}
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          ← All Scenarios
        </button>
        <span className="text-[var(--border-default)]">/</span>
        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{scenario.name}</span>
        <StatusBadge status={scenario.status} />
      </div>

      {/* ── Section 1: Project Definition ── */}
      <SectionCard title="Project Definition" allowOverflow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1">Scenario Name *</p>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                scheduleScenarioSave({ name: e.target.value });
              }}
              placeholder="e.g., K5.6 Residential Sprinkler"
              className={inputCls}
            />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1">Target Hours *</p>
            <input
              type="number"
              value={targetHours}
              onChange={e => {
                setTargetHours(e.target.value);
                scheduleScenarioSave({ target_hours: parseFloat(e.target.value) || 0 });
              }}
              placeholder="e.g., 600"
              min={0}
              step={50}
              className={inputCls}
            />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1">Start Month *</p>
            <MonthRangePicker
              singleMonth
              from={startMonth || null}
              to={startMonth || null}
              onChange={(from) => {
                if (!from) return;
                setStartMonth(from);
                scheduleScenarioSave({ start_month: from });
              }}
              availableMonths={singleMonthOptions}
              mode="forward"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1">Required Skills</p>
            <SkillTagSelector
              selected={skillTags}
              onChange={tags => {
                setSkillTags(tags);
                scheduleScenarioSave({ skill_tags: tags });
              }}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Candidate Ranking ── */}
      <SectionCard title={`Candidate Ranking${rankLoading ? ' — loading…' : ''}`}>
        {!startMonth ? (
          <p className="text-[12px] text-[var(--text-muted)]">Set a start month to rank candidates.</p>
        ) : candidates.length === 0 && !rankLoading ? (
          <p className="text-[12px] text-[var(--text-muted)]">No eligible engineers found.</p>
        ) : (
          <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--border-default)]">
              <thead className="bg-[var(--bg-table-header)]">
                <tr>
                  {['#', 'Engineer', 'Skill Fit', 'Avail hrs/mo', 'Util %', 'Score', ''].map(h => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {candidates.map((c, i) => {
                  const isAssigned = assignedEngineers.has(c.engineer);
                  return (
                    <tr key={c.engineer} className={`hover:bg-[var(--bg-row-hover)] ${isAssigned ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-1.5 text-[11px] text-[var(--text-muted)]">{i + 1}</td>
                      <td className="px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)]">
                        {c.engineer}
                      </td>
                      <td className="px-3 py-1.5 relative">
                        {skillTags.length === 0 ? (
                          <span className="text-[11px] text-[var(--text-muted)]">—</span>
                        ) : (
                          <span
                            className={`text-[12px] font-semibold cursor-help ${fitColor(c.skill_fit_pct)}`}
                            onMouseEnter={() => setTooltipEngineer(c.engineer)}
                            onMouseLeave={() => setTooltipEngineer(null)}
                          >
                            {Math.round(c.skill_fit_pct)}%
                            {tooltipEngineer === c.engineer && c.skill_breakdown.length > 0 && (
                              <div className="absolute z-50 left-0 mt-1 bg-white border border-[var(--border-default)] rounded-lg shadow-lg p-2 min-w-48">
                                {c.skill_breakdown.map(b => (
                                  <div key={b.skill} className="flex justify-between gap-4 text-[10px] py-0.5">
                                    <span className="text-[var(--text-secondary)] truncate">{b.skill}</span>
                                    <span className={`font-semibold flex-shrink-0 ${fitColor((b.rating / b.max_rating) * 100)}`}>
                                      {b.rating}/{b.max_rating}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
                        {Math.round(c.available_hours)}h
                      </td>
                      <td className="px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
                        {Math.round(c.availability_pct * 100)}%
                      </td>
                      <td className="px-3 py-1.5 text-[11px] text-[var(--text-muted)]">
                        {Math.round(c.composite_score)}
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          disabled={isAssigned}
                          onClick={() => handleAddEngineer(c.engineer)}
                          className="px-2 py-0.5 text-[11px] font-medium text-white bg-[var(--accent)] rounded hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {isAssigned ? '✓' : '+'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Section 3: Assigned Engineers ── */}
      <SectionCard title={`Assigned Engineers${assignedEngineers.size > 0 ? ` · ${assignedEngineers.size} assigned` : ''}`}>
        {allocations.length === 0 ? (
          <p className="text-[12px] text-[var(--text-muted)]">
            Add engineers from the candidate table above.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
              <table className="min-w-full divide-y divide-[var(--border-default)]">
                <thead className="bg-[var(--bg-table-header)]">
                  <tr>
                    {['Engineer', 'Skill Fit', '% of Capacity', 'Hours/Month', 'Mode', ''].map(h => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {allocations.map(alloc => {
                    const draft = allocationDraft.get(alloc.engineer) ?? {
                      pct: Math.round(alloc.allocation_pct * 100).toString(),
                      hours: alloc.planned_hours.toFixed(1),
                      mode: alloc.allocation_mode,
                    };
                    const candidateData = candidates.find(c => c.engineer === alloc.engineer);
                    return (
                      <tr key={alloc.engineer} className="hover:bg-[var(--bg-row-hover)]">
                        <td className="px-3 py-2 text-[12px] font-medium text-[var(--text-primary)]">
                          {alloc.engineer}
                        </td>
                        <td className="px-3 py-2 text-[12px]">
                          {candidateData && skillTags.length > 0 ? (
                            <span className={fitColor(candidateData.skill_fit_pct)}>
                              {Math.round(candidateData.skill_fit_pct)}%
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={draft.pct}
                            min={0}
                            max={200}
                            step={5}
                            onChange={e => handlePctChange(alloc.engineer, e.target.value)}
                            onBlur={flushAllocations}
                            className="w-20 px-2 py-1 text-[12px] border border-[var(--border-default)] rounded bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          />
                          <span className="ml-1 text-[11px] text-[var(--text-muted)]">%</span>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={draft.hours}
                            min={0}
                            step={5}
                            onChange={e => handleHoursChange(alloc.engineer, e.target.value)}
                            onBlur={flushAllocations}
                            className="w-20 px-2 py-1 text-[12px] border border-[var(--border-default)] rounded bg-white text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                          />
                          <span className="ml-1 text-[11px] text-[var(--text-muted)]">hrs</span>
                        </td>
                        <td className="px-3 py-2 text-[10px] text-[var(--text-muted)]">
                          {draft.mode === 'percentage' ? '%' : 'hrs'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleRemoveEngineer(alloc.engineer)}
                            className="text-[11px] text-red-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary row */}
            <div className="rounded-lg bg-[var(--bg-table-header)] border border-[var(--border-default)] px-4 py-2.5 text-[12px] text-[var(--text-secondary)]">
              {completion ? (
                <>
                  <span className="font-medium text-[var(--text-primary)]">
                    {completion.totalMonthlyHours.toFixed(0)}h/month total
                  </span>
                  {' · '}
                  Estimated completion:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatMonth(completion.completionMonth)}
                  </span>
                  {' '}
                  <span className="text-[var(--text-muted)]">
                    ({completion.durationMonths} month{completion.durationMonths !== 1 ? 's' : ''})
                  </span>
                </>
              ) : targetHours && parseFloat(targetHours) > 0 ? (
                <span className="text-[var(--text-muted)]">Set allocation to project completion</span>
              ) : (
                <span className="text-[var(--text-muted)]">Set target hours to project completion</span>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Section 4: Timeline ── */}
      <SectionCard title="Scenario Timeline">
        {completion && startMonth ? (
          <SwimLane
            startMonth={startMonth}
            completionMonth={completion.completionMonth}
            scenarioName={name || scenario.name}
            status={scenario.status}
          />
        ) : (
          <p className="text-[12px] text-[var(--text-muted)]">
            {!startMonth
              ? 'Set a start month to see the timeline.'
              : 'Assign engineers and set target hours to project the timeline.'}
          </p>
        )}
      </SectionCard>

      {/* ── Section 5: Capacity Impact ── */}
      <SectionCard title="Capacity Impact">
        <CapacityImpact
          scenario={scenario}
          allocations={allocations}
          scenarioMonths={scenarioMonths}
        />
      </SectionCard>

      {/* ── Actions ── */}
      <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-default)] flex-wrap">
        <Btn onClick={handleSave}>
          {saved ? '✓ Saved' : scenario.status === 'active' ? 'Re-save' : 'Save Scenario'}
        </Btn>
        <div className="flex-1" />
        {deleteConfirm ? (
          <>
            <span className="text-[11px] text-red-500">Permanently delete?</span>
            <Btn variant="danger" onClick={handleDelete}>Yes, Delete</Btn>
            <Btn variant="secondary" onClick={() => setDeleteConfirm(false)}>Cancel</Btn>
          </>
        ) : (
          <Btn variant="danger-ghost" onClick={() => setDeleteConfirm(true)}>Delete</Btn>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Top-level export
// ─────────────────────────────────────────────────────────────

export function WhatIfPlannerPanel() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { scenarios, loading, createScenario, deleteScenario, duplicateScenario } = useScenarios();

  useEffect(() => {
    if (selectedId !== null && !scenarios.some(s => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [scenarios, selectedId]);

  if (loading) return <ChartLoader height="h-48" />;

  async function handleCreate() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const ym = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    const id = await createScenario({
      name: 'New Scenario',
      skill_tags: [],
      start_month: ym,
      target_hours: 0,
    });
    setSelectedId(id);
  }

  if (selectedId !== null) {
    const scenario = scenarios.find(s => s.id === selectedId);
    if (!scenario) return null;
    return (
      <ScenarioEditor
        key={selectedId}
        scenario={scenario}
        onBack={() => setSelectedId(null)}
        onDelete={async id => {
          await deleteScenario(id);
          setSelectedId(null);
        }}
      />
    );
  }

  return (
    <ScenarioList
      scenarios={scenarios}
      onCreate={handleCreate}
      onSelect={setSelectedId}
      onDuplicate={id => duplicateScenario(id).then(() => {})}
      onDelete={id => deleteScenario(id).then(() => {})}
    />
  );
}
