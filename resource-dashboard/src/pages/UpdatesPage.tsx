import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ProjectType } from '../types';
import type { WeeklyAutoSummary, WeeklyUpdate } from '../types';
import { getAvailableWeeks, getWeekRange } from '../utils/weekDates';
import { computeWeeklyAutoSummary } from '../aggregation/weeklyAutoSummary';
import { getProjectParent } from '../aggregation/projectUtils';
import { useWeeklyUpdates } from '../hooks/useWeeklyUpdates';
import { UpdatesHeader } from '../updates/UpdatesHeader';
import { ProjectUpdateCard } from '../updates/ProjectUpdateCard';
import { UpdateForm } from '../updates/UpdateForm';
import { MeetingPrepView } from '../updates/MeetingPrepView';

// Type display order
const TYPE_ORDER: string[] = [ProjectType.NPD, ProjectType.Sustaining, ProjectType.Sprint];

interface ProjectWithHours {
  project_id: string;
  project_name: string;
  type: string;
  totalHours: number;
}

export function UpdatesPage() {
  const [selectedWeek, setSelectedWeek] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [showMeetingPrep, setShowMeetingPrep] = useState(false);
  const [autoSummaries, setAutoSummaries] = useState<Map<string, WeeklyAutoSummary>>(new Map());

  // Derive available weeks from timesheet dates
  const availableWeeks = useLiveQuery(async () => {
    const entries = await db.timesheets
      .orderBy('date')
      .uniqueKeys();
    return getAvailableWeeks(
      (entries as string[]).map(date => ({ date }))
    );
  }) ?? [];

  // Set default week when available
  useEffect(() => {
    if (availableWeeks.length > 0 && !selectedWeek) {
      setSelectedWeek(availableWeeks[0]);
    }
  }, [availableWeeks, selectedWeek]);

  // Get projects with hours this week
  const weekProjects = useLiveQuery(async () => {
    if (!selectedWeek) return [];
    const { start, end } = getWeekRange(selectedWeek);

    const entries = await db.timesheets
      .where('date')
      .between(start, end, true, true)
      .toArray();

    // Load all projects for name/type lookup
    const allProjects = await db.projects.toArray();
    const projectMap = new Map(allProjects.map(p => [p.project_id, p]));

    // Aggregate by parent project
    const hoursByProject = new Map<string, { hours: number; rNumbers: Set<string> }>();
    for (const entry of entries) {
      const parent = getProjectParent(entry.r_number);
      const existing = hoursByProject.get(parent) ?? { hours: 0, rNumbers: new Set() };
      existing.hours += entry.hours;
      existing.rNumbers.add(entry.r_number);
      hoursByProject.set(parent, existing);
    }

    const result: ProjectWithHours[] = [];
    for (const [parentId, data] of hoursByProject) {
      // Find the project record — try parent first, then any matching r_number
      const project = projectMap.get(parentId)
        ?? [...data.rNumbers].map(r => projectMap.get(r)).find(Boolean);

      result.push({
        project_id: parentId,
        project_name: project?.project_name ?? parentId,
        type: project?.type ?? ProjectType.Admin,
        totalHours: Math.round(data.hours * 10) / 10,
      });
    }

    return result.sort((a, b) => b.totalHours - a.totalHours);
  }, [selectedWeek]) ?? [];

  // Get existing updates for this week
  const { updates } = useWeeklyUpdates(selectedWeek);
  const updateMap = useMemo(() => {
    const map = new Map<string, WeeklyUpdate>();
    for (const u of updates) map.set(u.project_id, u);
    return map;
  }, [updates]);

  // Compute auto-summaries for all active projects
  useEffect(() => {
    if (!selectedWeek || weekProjects.length === 0) {
      setAutoSummaries(new Map());
      return;
    }

    let cancelled = false;
    async function computeAll() {
      const results = new Map<string, WeeklyAutoSummary>();
      for (const p of weekProjects) {
        if (cancelled) return;
        const summary = await computeWeeklyAutoSummary(p.project_id, selectedWeek);
        results.set(p.project_id, summary);
      }
      if (!cancelled) setAutoSummaries(results);
    }

    computeAll();
    return () => { cancelled = true; };
  }, [selectedWeek, weekProjects]);

  // Group projects by type
  const grouped = useMemo(() => {
    const groups = new Map<string, ProjectWithHours[]>();
    for (const type of TYPE_ORDER) groups.set(type, []);

    // Also collect projects with updates but no hours this week
    const projectIds = new Set(weekProjects.map(p => p.project_id));
    const allProjectsInGroup = [...weekProjects];

    for (const u of updates) {
      if (!projectIds.has(u.project_id)) {
        // Project has an update but no hours — still show it
        allProjectsInGroup.push({
          project_id: u.project_id,
          project_name: u.project_id,
          type: ProjectType.NPD, // Will be resolved below
          totalHours: 0,
        });
      }
    }

    for (const p of allProjectsInGroup) {
      const typeGroup = groups.get(p.type);
      if (typeGroup) {
        typeGroup.push(p);
      }
      // Admin/OOO projects go to a separate "no activity" bucket
    }

    return groups;
  }, [weekProjects, updates]);

  // Projects with no activity (Admin/OOO type or zero hours)
  const noActivityProjects = useMemo(() => {
    return weekProjects.filter(
      p => p.type === ProjectType.Admin || p.type === ProjectType.OutOfOffice
    );
  }, [weekProjects]);

  if (availableWeeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <svg className="w-12 h-12 text-[var(--text-muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-[14px] text-[var(--text-muted)]">
          No timesheet data available. Import data to start tracking weekly updates.
        </p>
      </div>
    );
  }

  return (
    <div>
      <UpdatesHeader
        availableWeeks={availableWeeks}
        selectedWeek={selectedWeek}
        onWeekChange={setSelectedWeek}
        onMeetingPrep={() => setShowMeetingPrep(true)}
      />

      <div className="space-y-6">
        {TYPE_ORDER.map(type => {
          const projects = grouped.get(type) ?? [];
          if (projects.length === 0) return null;

          return (
            <section key={type}>
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                {type} ({projects.length})
              </h2>
              <div className="space-y-1.5">
                {projects.map(p => (
                  <ProjectUpdateCard
                    key={p.project_id}
                    projectId={p.project_id}
                    projectName={p.project_name}
                    autoSummary={autoSummaries.get(p.project_id) ?? null}
                    update={updateMap.get(p.project_id)}
                    onClick={() => setEditingProjectId(p.project_id)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {/* No Activity Section */}
        {noActivityProjects.length > 0 && (
          <section>
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Admin / OOO ({noActivityProjects.length})
            </h2>
            <div className="space-y-1.5">
              {noActivityProjects.map(p => (
                <div
                  key={p.project_id}
                  className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] opacity-60"
                >
                  <span className="text-[13px] font-medium text-[var(--text-muted)]">
                    {p.project_id}
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)] ml-2">
                    {p.project_name} — {p.totalHours}h
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Update Form Modal */}
      {editingProjectId && (
        <UpdateForm
          projectId={editingProjectId}
          weekEnding={selectedWeek}
          onClose={() => setEditingProjectId(null)}
        />
      )}

      {/* Meeting Prep View */}
      {showMeetingPrep && (
        <MeetingPrepView
          weekEnding={selectedWeek}
          weekProjects={weekProjects}
          autoSummaries={autoSummaries}
          updates={updates}
          onClose={() => setShowMeetingPrep(false)}
        />
      )}
    </div>
  );
}
