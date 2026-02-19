import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ProjectType } from '../types';

export interface PanelAvailability {
  panelId: string;
  available: boolean;
  reason?: string;
}

/**
 * Checks each panel's data prerequisites and returns availability status.
 * Uses fast .count() queries for efficiency.
 */
export function usePanelAvailability(
  selectedMonth: string | undefined,
  selectedProject: string | undefined
): PanelAvailability[] {
  const counts = useLiveQuery(async () => {
    const [
      timesheetCount,
      allocCount,
      milestoneCount,
      skillCount,
      categoryCount,
      teamMemberCount,
      kpiHistoryCount,
    ] = await Promise.all([
      db.timesheets.count(),
      db.plannedAllocations.count(),
      db.milestones.count(),
      db.skills.count(),
      db.skillCategories.count(),
      db.teamMembers.count(),
      db.kpiHistory.count(),
    ]);

    // Look up project type if a project is selected
    let projectType: string | undefined;
    if (selectedProject) {
      const project = await db.projects.get(selectedProject);
      projectType = project?.type;
    }

    return {
      timesheetCount,
      allocCount,
      milestoneCount,
      skillCount,
      categoryCount,
      teamMemberCount,
      kpiHistoryCount,
      projectType,
    };
  }, [selectedProject]);

  if (!counts) return [];

  const {
    timesheetCount,
    allocCount,
    milestoneCount,
    skillCount,
    categoryCount,
    teamMemberCount,
    kpiHistoryCount,
    projectType,
  } = counts;

  const hasMonth = !!selectedMonth;
  const hasData = timesheetCount > 0;

  const checks: Record<string, { available: boolean; reason?: string }> = {
    'kpi-summary': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data imported',
    },
    'kpi-trends': {
      available: kpiHistoryCount > 1,
      reason: 'Need at least 2 months of data for trends',
    },
    'narrative-summary': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data imported',
    },
    'anomaly-alerts': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data',
    },
    'allocation-compliance': {
      available: hasMonth && allocCount > 0,
      reason: allocCount === 0 ? 'No planned allocations configured' : 'Select a month',
    },
    'bus-factor': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data',
    },
    'capacity-forecast': {
      available: allocCount > 0 && teamMemberCount > 0,
      reason: allocCount === 0 ? 'No planned allocations configured' : 'No team members configured',
    },
    'engineer-breakdown': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data',
    },
    'focus-score': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data',
    },
    'lab-tech-hours': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data',
    },
    'meeting-tax': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data',
    },
    'milestone-timeline': {
      available: (!selectedProject || projectType === ProjectType.NPD) && milestoneCount > 0,
      reason: projectType && projectType !== ProjectType.NPD
        ? 'Not applicable for non-NPD projects'
        : 'No milestones configured',
    },
    'npd-project-comp': {
      available: hasMonth && (!selectedProject || projectType === ProjectType.NPD) && allocCount > 0,
      reason: projectType && projectType !== ProjectType.NPD
        ? 'Not applicable for non-NPD projects'
        : allocCount === 0
          ? 'No planned allocations'
          : 'Select a month',
    },
    'project-timeline': {
      available: !!selectedProject,
      reason: 'Select a specific project to view timeline',
    },
    'skill-heatmap': {
      available: skillCount > 0 && categoryCount > 0,
      reason: 'No skills configured',
    },
    'tech-affinity': {
      available: hasMonth && hasData,
      reason: !hasMonth ? 'Select a month' : 'No timesheet data',
    },
    'planned-vs-actual': {
      available: hasData,
      reason: 'No timesheet data imported',
    },
    'firefighting-trend': {
      available: hasData,
      reason: 'No timesheet data imported',
    },
    'utilization-heatmap': {
      available: allocCount > 0 && teamMemberCount > 0,
      reason: allocCount === 0 ? 'No planned allocations configured' : 'No team members',
    },
  };

  return Object.entries(checks).map(([panelId, check]) => ({
    panelId,
    ...check,
  }));
}
