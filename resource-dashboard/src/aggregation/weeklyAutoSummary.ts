import { db } from '../db/database';
import { PersonRole } from '../types';
import type { WeeklyAutoSummary, TaskSummary } from '../types';
import { getProjectParent } from './projectUtils';
import { getWeekRange } from '../utils/weekDates';

/**
 * Compute auto-generated weekly summary for a project.
 * Groups timesheet entries by task_id, capturing task name, hours,
 * completion status, activity type, and contributing people.
 * Splits hours into engineer vs lab tech using team member roles.
 */
export async function computeWeeklyAutoSummary(
  projectId: string,
  weekEnding: string
): Promise<WeeklyAutoSummary> {
  const parentId = getProjectParent(projectId);
  const { start, end } = getWeekRange(weekEnding);

  // Load timesheets in the date range
  const entries = await db.timesheets
    .where('date')
    .between(start, end, true, true)
    .toArray();

  // Filter to matching project (including sub-projects)
  const projectEntries = entries.filter(entry => {
    return entry.r_number === projectId
      || getProjectParent(entry.r_number) === parentId;
  });

  // Load team members for role classification
  const teamMembers = await db.teamMembers.toArray();
  const roleMap = new Map(teamMembers.map(m => [m.full_name, m.role]));

  // Group by task_id
  const taskMap = new Map<number, {
    task_name: string;
    task_id: number;
    hours: number;
    is_done: boolean;
    activity: string;
    contributors: Set<string>;
  }>();

  let engineerHours = 0;
  let labHours = 0;
  const allContributors = new Set<string>();
  const activitySet = new Set<string>();

  for (const entry of projectEntries) {
    const role = roleMap.get(entry.full_name);
    if (role === PersonRole.Engineer) {
      engineerHours += entry.hours;
    } else {
      labHours += entry.hours;
    }

    allContributors.add(entry.full_name);
    activitySet.add(entry.activity);

    const existing = taskMap.get(entry.task_id);
    if (existing) {
      existing.hours += entry.hours;
      existing.contributors.add(entry.full_name);
      // Task is done if any entry marks it done
      if (entry.is_done) existing.is_done = true;
    } else {
      taskMap.set(entry.task_id, {
        task_name: entry.task || `Task ${entry.task_id}`,
        task_id: entry.task_id,
        hours: entry.hours,
        is_done: entry.is_done,
        activity: entry.activity,
        contributors: new Set([entry.full_name]),
      });
    }
  }

  const tasks: TaskSummary[] = [...taskMap.values()]
    .map(t => ({
      task_name: t.task_name,
      task_id: t.task_id,
      hours: Math.round(t.hours * 10) / 10,
      is_done: t.is_done,
      activity: t.activity,
      contributors: [...t.contributors].sort(),
    }))
    .sort((a, b) => b.hours - a.hours); // Highest hours first

  const totalHours = Math.round((engineerHours + labHours) * 10) / 10;

  return {
    total_hours: totalHours,
    engineer_hours: Math.round(engineerHours * 10) / 10,
    lab_hours: Math.round(labHours * 10) / 10,
    contributors: [...allContributors].sort(),
    tasks,
    tasks_completed: tasks.filter(t => t.is_done).map(t => t.task_name),
    activities: [...activitySet].sort(),
  };
}

/**
 * Format auto-summary as a task checklist string.
 * e.g.:
 *   ✓ Clean 3D Print Samples (1h)
 *   ○ K11 Parts Test Preparation (26h)
 */
export function formatAutoSummary(summary: WeeklyAutoSummary): string {
  if (summary.tasks.length === 0) return 'No activity recorded';
  return summary.tasks
    .map(t => `${t.is_done ? '✓' : '○'} ${t.task_name} (${t.hours}h)`)
    .join('\n');
}
