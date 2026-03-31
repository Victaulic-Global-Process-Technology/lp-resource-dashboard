import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useScenarios } from '../../hooks/useScenarios';
import {
  rankCandidatesForScenario,
  projectCompletion,
  addMonths,
  monthRange,
} from '../../aggregation/scenarioSkillFit';
import type { CandidateRanking } from '../../aggregation/scenarioSkillFit';
import { computeCapacityForecast } from '../../aggregation/capacityForecast';
import { getEngineerCapacity } from '../../utils/capacity';
import { formatMonth } from '../../utils/format';
import { ChartLoader } from '../../charts/ChartLoader';
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--border-default)] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[var(--bg-table-header)] border-b border-[var(--border-default)]">
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
                  {s.target_hours > 0 ? ` · ${s.target_hours}h target` : ''}
                </p>
                {s.skill_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {s.skill_tags.slice(0, 4).map(tag => (
                      <span
                        key={tag}
                        className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                    {s.skill_tags.length > 4 && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        +{s.skill_tags.length - 4} more
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
// Swim Lane Timeline
// ─────────────────────────────────────────────────────────────

interface SwimLaneProps {
  startMonth: string;
  completionMonth: string;
  scenarioName: string;
  status: PlanningScenario['status'];
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LABEL_COL = 160;
const DOT_D = 10;
const ROW_H = 56;

function SwimLane({ startMonth, completionMonth, scenarioName, status }: SwimLaneProps) {
  // Expand window by 1 month on each side
  const displayStart = addMonths(startMonth, -1);
  const displayEnd = addMonths(completionMonth, 1);

  const months: string[] = [];
  let cur = displayStart;
  while (cur <= displayEnd) {
    months.push(cur);
    cur = addMonths(cur, 1);
  }

  const todayYM = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const milestones = useLiveQuery(() => db.milestones.toArray(), []) ?? [];
  const projects = useLiveQuery(() => db.projects.where('type').equals('NPD').toArray(), []) ?? [];
  const projectMap = new Map(projects.map(p => [p.project_id, p.project_name]));

  // Find NPD projects with any milestone in the scenario window
  type MilestoneRow = {
    project_id: string;
    project_name: string;
    dots: { month: string; label: string; color: string }[];
  };

  const milestoneRows: MilestoneRow[] = [];
  const MILESTONE_COLORS: Record<string, string> = {
    dr1: '#3b82f6',
    dr2: '#f59e0b',
    dr3: '#f97316',
    launch: '#22c55e',
  };

  for (const m of milestones) {
    const keys = ['dr1', 'dr2', 'dr3', 'launch'] as const;
    const dots: MilestoneRow['dots'] = [];
    for (const key of keys) {
      const date = m[key];
      if (!date) continue;
      const ym = date.slice(0, 7);
      if (ym >= startMonth && ym <= completionMonth) {
        dots.push({ month: ym, label: key.toUpperCase(), color: MILESTONE_COLORS[key] });
      }
    }
    if (dots.length > 0) {
      milestoneRows.push({
        project_id: m.project_id,
        project_name: projectMap.get(m.project_id) ?? m.project_id,
        dots,
      });
    }
  }

  const colW = 72;
  const totalW = months.length * colW;

  function monthToX(ym: string): number {
    const idx = months.indexOf(ym);
    return idx >= 0 ? idx * colW + colW / 2 : -1;
  }

  const scenarioStartX = monthToX(startMonth);
  const scenarioEndX = monthToX(completionMonth);
  const scenarioBarColor = status === 'active' ? '#22c55e' : '#3b82f6';

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: LABEL_COL + totalW }}>
        {/* Header row */}
        <div className="flex" style={{ height: 32 }}>
          <div style={{ width: LABEL_COL, flexShrink: 0 }} />
          <div className="flex" style={{ width: totalW, position: 'relative' }}>
            {months.map((m, i) => {
              const [, mm] = m.split('-').map(Number);
              return (
                <div
                  key={m}
                  style={{ width: colW, textAlign: 'center' }}
                  className={`text-[10px] font-medium flex items-center justify-center border-l border-[var(--border-subtle)] ${
                    m === todayYM ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {i === 0 || mm === 1 ? MONTH_ABBR[mm - 1] + ' ' + m.slice(0, 4) : MONTH_ABBR[mm - 1]}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scenario bar row */}
        <div className="flex border-t border-[var(--border-subtle)]" style={{ height: ROW_H }}>
          <div
            style={{ width: LABEL_COL, flexShrink: 0 }}
            className="flex items-center px-2 text-[11px] font-semibold text-[var(--text-primary)] border-r border-[var(--border-subtle)]"
          >
            <span className="truncate">{scenarioName}</span>
          </div>
          <div className="relative" style={{ width: totalW, height: ROW_H }}>
            {/* Gridlines */}
            {months.map((m, i) => (
              <div
                key={m}
                className="absolute top-0 bottom-0 border-l border-[var(--border-subtle)]"
                style={{ left: i * colW }}
              />
            ))}
            {/* Today marker */}
            {months.includes(todayYM) && (
              <div
                className="absolute top-0 bottom-0 border-l-2 border-[var(--accent)] opacity-40"
                style={{ left: months.indexOf(todayYM) * colW + colW / 2 }}
              />
            )}
            {/* Scenario bar */}
            {scenarioStartX >= 0 && scenarioEndX >= 0 && (
              <div
                className="absolute rounded flex items-center justify-center text-[11px] font-medium text-white"
                style={{
                  left: scenarioStartX - colW / 3,
                  width: scenarioEndX - scenarioStartX + (colW * 2) / 3,
                  top: ROW_H / 2 - 10,
                  height: 20,
                  backgroundColor: scenarioBarColor,
                }}
              >
                {formatMonth(startMonth)} → {formatMonth(completionMonth)}
              </div>
            )}
          </div>
        </div>

        {/* Milestone rows */}
        {milestoneRows.length === 0 ? (
          <div className="flex border-t border-[var(--border-subtle)]" style={{ height: ROW_H }}>
            <div style={{ width: LABEL_COL, flexShrink: 0 }} className="border-r border-[var(--border-subtle)]" />
            <div className="flex items-center px-4 text-[11px] text-[var(--text-muted)] italic">
              No NPD milestones overlap this scenario's timeline
            </div>
          </div>
        ) : (
          milestoneRows.map(row => (
            <div key={row.project_id} className="flex border-t border-[var(--border-subtle)]" style={{ height: ROW_H }}>
              <div
                style={{ width: LABEL_COL, flexShrink: 0 }}
                className="flex items-center px-2 text-[10px] text-[var(--text-secondary)] border-r border-[var(--border-subtle)]"
              >
                <span className="truncate" title={row.project_name}>
                  {row.project_id} {row.project_name}
                </span>
              </div>
              <div className="relative" style={{ width: totalW, height: ROW_H }}>
                {months.map((m, i) => (
                  <div
                    key={m}
                    className="absolute top-0 bottom-0 border-l border-[var(--border-subtle)]"
                    style={{ left: i * colW }}
                  />
                ))}
                {/* Connecting line between first and last dot */}
                {row.dots.length > 1 && (() => {
                  const xs = row.dots.map(d => monthToX(d.month)).filter(x => x >= 0);
                  if (xs.length < 2) return null;
                  const x1 = Math.min(...xs);
                  const x2 = Math.max(...xs);
                  return (
                    <div
                      className="absolute"
                      style={{
                        left: x1,
                        width: x2 - x1,
                        top: ROW_H / 2 - 1,
                        height: 2,
                        backgroundColor: '#cbd5e1',
                      }}
                    />
                  );
                })()}
                {/* Dots */}
                {row.dots.map(dot => {
                  const x = monthToX(dot.month);
                  if (x < 0) return null;
                  return (
                    <div
                      key={dot.label}
                      title={`${dot.label}: ${dot.month}`}
                      className="absolute rounded-full"
                      style={{
                        left: x - DOT_D / 2,
                        top: ROW_H / 2 - DOT_D / 2,
                        width: DOT_D,
                        height: DOT_D,
                        backgroundColor: dot.color,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
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
  const [skillTags, setSkillTags] = useState<string[]>(scenario.skill_tags ?? []);
  const [startMonth, setStartMonth] = useState(scenario.start_month);
  const [targetHours, setTargetHours] = useState(scenario.target_hours > 0 ? String(scenario.target_hours) : '');

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
      <SectionCard title="Project Definition">
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
            <input
              type="month"
              value={startMonth}
              onChange={e => {
                setStartMonth(e.target.value);
                scheduleScenarioSave({ start_month: e.target.value });
              }}
              className={inputCls}
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
