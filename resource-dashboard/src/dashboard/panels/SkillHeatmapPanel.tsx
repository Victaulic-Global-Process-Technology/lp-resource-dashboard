import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { skillColor } from '../../charts/ChartTheme';
import { PersonRole, ProjectType } from '../../types';
import type { SkillCategory } from '../../types';
import { getProjectParent } from '../../aggregation/projectUtils';
import { computeCompatibilityScores } from '../../aggregation/skillMatching';
import { useFilters } from '../../context/ViewFilterContext';
import { resolveMonths, toDbMonths } from '../../utils/monthRange';

const SCORE_DEFINITIONS: Record<number, string> = {
  1: 'Basic awareness',
  2: 'Working knowledge',
  3: 'Advanced',
  4: 'Expert',
  5: 'Authority',
};

export function SkillHeatmapPanel() {
  const { monthFilter, selectedProject: dashboardProject, selectedEngineer } = useFilters();

  const teamMembers = useLiveQuery(() => db.teamMembers.toArray());
  const skills = useLiveQuery(() => db.skills.toArray());
  const skillCategories = useLiveQuery(() => db.skillCategories.toArray());
  const projects = useLiveQuery(() => db.projects.toArray());
  const allRequirements = useLiveQuery(() => db.projectSkillRequirements.toArray());

  // Find contributors to the dashboard-selected project
  const projectContributors = useLiveQuery(async () => {
    if (!dashboardProject || !monthFilter) return null;
    const csvMonths = toDbMonths(resolveMonths(monthFilter));
    const timesheets = await db.timesheets.where('month').anyOf(csvMonths).toArray();
    const contributors = new Set(
      timesheets
        .filter(t => getProjectParent(t.r_number) === dashboardProject || t.r_number === dashboardProject)
        .map(t => t.full_name)
    );
    return contributors;
  }, [dashboardProject, monthFilter]);

  const [selectedProjectId, setSelectedProjectId] = useState('');

  if (!teamMembers || !skills || !skillCategories) {
    return <div className="animate-pulse h-64 bg-[var(--border-default)] rounded-lg" />;
  }

  // Engineers with at least one skill rated > 0
  const engineersWithSkills = new Set(
    skills.filter(s => s.rating > 0).map(s => s.engineer)
  );

  let engineers = teamMembers.filter(m => m.role === PersonRole.Engineer);
  if (selectedEngineer) {
    engineers = engineers.filter(e => e.full_name === selectedEngineer);
  } else if (dashboardProject && projectContributors) {
    engineers = engineers.filter(e => projectContributors.has(e.full_name));
  } else {
    engineers = engineers.filter(e => engineersWithSkills.has(e.full_name));
  }

  const sortedCategories = [...skillCategories].sort((a, b) => a.sort_order - b.sort_order);
  const groupedSkills = groupByCategory(sortedCategories);

  if (engineers.length === 0 || sortedCategories.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)]">
        {dashboardProject
          ? 'No engineers contributed to the selected project this month.'
          : 'Skill ratings not configured. Visit Settings → Skills Matrix to rate your team.'}
      </div>
    );
  }

  // Build data map
  const dataMap = new Map<string, number>();
  skills.forEach(s => {
    dataMap.set(`${s.engineer}|${s.skill}`, s.rating);
  });

  // Project ranking
  const selectedRequirements = selectedProjectId && allRequirements
    ? allRequirements.filter(r => r.project_id === selectedProjectId)
    : [];

  const scores = selectedRequirements.length > 0
    ? computeCompatibilityScores(selectedRequirements, skills, teamMembers)
    : null;

  const orderedEngineers = scores
    ? scores
        .map(s => engineers.find(e => e.full_name === s.engineer))
        .filter(Boolean)
        .map(e => e!)
    : [...engineers].sort((a, b) => a.full_name.localeCompare(b.full_name));

  const highlightedRows = scores
    ? new Set(scores.slice(0, 3).map(s => s.engineer))
    : undefined;

  const rowAnnotations = scores
    ? new Map(scores.map(s => [s.engineer, `${s.score}%`]))
    : undefined;

  const highlightedColumns = selectedRequirements.length > 0
    ? new Set(selectedRequirements.map(r => r.skill))
    : undefined;

  const projectsWithSkills = projects && allRequirements
    ? projects.filter(p =>
        (p.type === ProjectType.NPD || p.type === ProjectType.Sustaining) &&
        allRequirements.some(r => r.project_id === p.project_id)
      )
    : [];

  const getTextColor = (bgColor: string): string => {
    const darkColors = ['#16a34a', '#2563eb', '#1d4ed8', '#dc2626', '#7c3aed', '#0d9488'];
    return darkColors.some(dark => bgColor.toLowerCase() === dark.toLowerCase()) ? '#FFFFFF' : '#000000';
  };

  return (
    <div>
      {/* Scoring legend */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px]">
        {[1, 2, 3, 4, 5].map(score => (
          <span key={score} className="inline-flex items-center gap-1">
            <span
              className="w-5 h-4 rounded flex items-center justify-center text-[9px] font-bold"
              style={{ backgroundColor: skillColor(score), color: getTextColor(skillColor(score)) }}
            >
              {score}
            </span>
            <span className="text-[var(--text-muted)]">{SCORE_DEFINITIONS[score]}</span>
          </span>
        ))}
      </div>

      {/* Project selector for ranking */}
      <div className="flex items-center gap-3 mb-3">
        <label className="text-[12px] font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">
          Rank by project
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="text-[13px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)] max-w-xs"
        >
          <option value="">None (alphabetical)</option>
          {projectsWithSkills.map(p => (
            <option key={p.project_id} value={p.project_id}>
              {p.project_id} — {p.project_name || 'Untitled'}
            </option>
          ))}
        </select>
        {selectedProjectId && projectsWithSkills.length > 0 && (
          <span className="text-[11px] text-[var(--text-muted)]">
            {selectedRequirements.length} skill{selectedRequirements.length !== 1 ? 's' : ''} required
          </span>
        )}
      </div>

      {/* Heatmap with category groupings */}
      <div className="overflow-x-auto">
        <table className="heatmap-table">
          <thead>
            {/* Category group header row */}
            <tr>
              <th className="heatmap-category-corner">{/* corner */}</th>
              {groupedSkills.map(group => (
                <th
                  key={group.category}
                  colSpan={group.skills.length}
                  className="heatmap-category-header"
                >
                  {group.category}
                </th>
              ))}
            </tr>
            {/* Individual skill names */}
            <tr>
              <th>{/* corner */}</th>
              {groupedSkills.flatMap(group =>
                group.skills.map(cat => (
                  <th
                    key={cat.name}
                    className={highlightedColumns?.has(cat.name) ? 'heatmap-col-required' : ''}
                  >
                    {cat.name}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {orderedEngineers.map(eng => {
              const isHighlighted = highlightedRows?.has(eng.full_name);
              const annotation = rowAnnotations?.get(eng.full_name);

              return (
                <tr key={eng.full_name} className={isHighlighted ? 'heatmap-row-highlighted' : ''}>
                  <td>
                    {eng.full_name}
                    {annotation && (
                      <span className={`heatmap-score-badge ${isHighlighted ? 'heatmap-score-badge--top' : 'heatmap-score-badge--normal'}`}>
                        {annotation}
                      </span>
                    )}
                  </td>
                  {groupedSkills.flatMap(group =>
                    group.skills.map(cat => {
                      const value = dataMap.get(`${eng.full_name}|${cat.name}`) ?? 0;
                      const bgColor = skillColor(value);
                      const textColor = getTextColor(bgColor);

                      return (
                        <td key={cat.name} title={`${eng.full_name} × ${cat.name}: ${value}`}>
                          <span
                            className="heatmap-cell"
                            style={{ backgroundColor: bgColor, color: textColor }}
                          >
                            {value === 0 ? '—' : value.toString()}
                          </span>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function groupByCategory(sortedCategories: SkillCategory[]): { category: string; skills: SkillCategory[] }[] {
  const groups: { category: string; skills: SkillCategory[] }[] = [];
  const seen = new Map<string, { category: string; skills: SkillCategory[] }>();

  for (const cat of sortedCategories) {
    const key = cat.category || 'Uncategorized';
    let group = seen.get(key);
    if (!group) {
      group = { category: key, skills: [] };
      seen.set(key, group);
      groups.push(group);
    }
    group.skills.push(cat);
  }

  return groups;
}
