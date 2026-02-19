import { db } from './database';
import { PersonRole } from '../types';
import type { TimesheetEntry, TeamMember, Project, ImportLog } from '../types';
import {
  classifyProjectType,
  classifyWorkClass,
  classifyPersonRole,
  resolveProjectName,
} from '../utils/classification';

/**
 * Deduplicate entries against existing database by timesheet_entry_id.
 * Uses efficient bulk lookup.
 */
export async function deduplicateEntries(
  parsed: TimesheetEntry[]
): Promise<{ newEntries: TimesheetEntry[]; duplicateCount: number }> {
  // Get all existing IDs using bulkGet for efficiency
  const ids = parsed.map(e => e.timesheet_entry_id);
  const existing = await db.timesheets.bulkGet(ids);
  const existingIdSet = new Set(
    existing.filter(Boolean).map(e => e!.timesheet_entry_id)
  );

  const newEntries = parsed.filter(e => !existingIdSet.has(e.timesheet_entry_id));

  return {
    newEntries,
    duplicateCount: parsed.length - newEntries.length,
  };
}

/**
 * Auto-discover and update team members from new entries.
 */
export async function updateTeamMembers(entries: TimesheetEntry[]): Promise<string[]> {
  const newPeople: string[] = [];
  const existingMembers = await db.teamMembers.toArray();
  const existingIds = new Set(existingMembers.map(m => m.person_id));

  // Group entries by person
  const peopleMap = new Map<number, TimesheetEntry[]>();
  for (const entry of entries) {
    if (!peopleMap.has(entry.person_id)) {
      peopleMap.set(entry.person_id, []);
    }
    peopleMap.get(entry.person_id)!.push(entry);
  }

  // Get ALL entries for each person for role classification (not just new imports)
  for (const [personId, personEntries] of peopleMap) {
    if (!existingIds.has(personId)) {
      // New person discovered
      const allPersonEntries = await db.timesheets
        .where('person_id')
        .equals(personId)
        .toArray();

      // Add new entries for role classification
      const combinedEntries = [...allPersonEntries, ...personEntries];
      const role = classifyPersonRole(combinedEntries);

      const member: TeamMember = {
        person_id: personId,
        person: personEntries[0].person,
        full_name: personEntries[0].full_name,
        role,
        capacity_override_hours: 0, // Use default
      };

      await db.teamMembers.add(member);
      newPeople.push(member.full_name);
    } else {
      // Existing person - re-evaluate role based on all data
      const allPersonEntries = await db.timesheets
        .where('person_id')
        .equals(personId)
        .toArray();

      const combinedEntries = [...allPersonEntries, ...personEntries];
      const newRole = classifyPersonRole(combinedEntries);

      // Update role if changed
      await db.teamMembers.update(personId, { role: newRole });
    }
  }

  return newPeople;
}

/**
 * Auto-discover and update projects from new entries.
 */
export async function updateProjects(entries: TimesheetEntry[]): Promise<string[]> {
  const newProjects: string[] = [];
  const existingProjects = await db.projects.toArray();
  const existingIds = new Set(existingProjects.map(p => p.project_id));

  // Group entries by R# code
  const projectMap = new Map<string, TimesheetEntry[]>();
  for (const entry of entries) {
    if (!entry.r_number) continue;

    if (!projectMap.has(entry.r_number)) {
      projectMap.set(entry.r_number, []);
    }
    projectMap.get(entry.r_number)!.push(entry);
  }

  // Get ALL entries for each project for name resolution (not just new imports)
  for (const [rNumber, projectEntries] of projectMap) {
    if (!existingIds.has(rNumber)) {
      // New project discovered
      const allProjectEntries = await db.timesheets
        .where('r_number')
        .equals(rNumber)
        .toArray();

      const combinedEntries = [...allProjectEntries, ...projectEntries];

      const project: Project = {
        project_id: rNumber,
        project_name: resolveProjectName(rNumber, combinedEntries),
        type: classifyProjectType(rNumber, projectEntries[0].inherited_tags),
        work_class: classifyWorkClass(rNumber),
      };

      await db.projects.add(project);
      newProjects.push(rNumber);
    }
  }

  return newProjects;
}

/**
 * Store new timesheet entries in bulk.
 */
export async function storeEntries(entries: TimesheetEntry[]): Promise<void> {
  await db.timesheets.bulkAdd(entries);
}

/**
 * Log an import operation.
 */
export async function logImport(log: Omit<ImportLog, 'id'>): Promise<void> {
  await db.importLogs.add(log);
}

/**
 * Get the most recent import log.
 */
export async function getLastImport(): Promise<ImportLog | undefined> {
  const logs = await db.importLogs.orderBy('imported_at').reverse().limit(1).toArray();
  return logs[0];
}

/**
 * Get summary statistics for the ImportStatus component.
 */
export async function getDashboardStats(): Promise<{
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
}> {
  const lastImport = await getLastImport();
  const allEntries = await db.timesheets.toArray();
  const allMembers = await db.teamMembers.toArray();

  let dateRangeStart: string | null = null;
  let dateRangeEnd: string | null = null;
  let missingDateGaps: { from: string; to: string }[] = [];

  if (allEntries.length > 0) {
    const dates = allEntries.map(e => e.date).sort();
    dateRangeStart = dates[0];
    dateRangeEnd = dates[dates.length - 1];

    // Detect gaps: find months with data, identify missing months in range
    const monthsWithData = new Set(allEntries.map(e => e.month));
    missingDateGaps = findMonthGaps(monthsWithData);
  }

  const totalHours = allEntries.reduce((sum, e) => sum + e.hours, 0);

  const engineerCount = allMembers.filter(m => m.role === PersonRole.Engineer).length;
  const techCount = allMembers.filter(m => m.role === PersonRole.LabTechnician).length;
  const unclassifiedCount = allMembers.length - engineerCount - techCount;

  return {
    lastImportDate: lastImport?.imported_at || null,
    dateRangeStart,
    dateRangeEnd,
    totalEntries: allEntries.length,
    totalHours,
    peopleCount: allMembers.length,
    engineerCount,
    techCount,
    unclassifiedCount,
    missingDateGaps,
  };
}

/**
 * Find gaps in monthly data coverage.
 * Accepts a set of month strings in "YYYY/MM" format.
 * Returns an array of { from, to } date ranges for each contiguous gap.
 */
function findMonthGaps(monthsWithData: Set<string>): { from: string; to: string }[] {
  if (monthsWithData.size < 2) return [];

  // Parse and sort all months present
  const sorted = [...monthsWithData]
    .map(m => {
      const [y, mo] = m.split('/').map(Number);
      return { year: y, month: mo, key: m };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);

  const gaps: { from: string; to: string }[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];

    // Walk from curr+1 month to next-1 month, collecting missing
    let y = curr.year;
    let m = curr.month + 1;
    if (m > 12) { m = 1; y++; }

    let gapStart: string | null = null;
    let gapEnd: string | null = null;

    while (y < next.year || (y === next.year && m < next.month)) {
      const key = `${y}/${String(m).padStart(2, '0')}`;
      if (!gapStart) gapStart = key;
      gapEnd = key;

      m++;
      if (m > 12) { m = 1; y++; }
    }

    if (gapStart && gapEnd) {
      gaps.push({ from: gapStart, to: gapEnd });
    }
  }

  return gaps;
}

/**
 * Update dashboard config with latest import metadata.
 */
export async function updateConfigFromImport(
  teamName: string,
  month: string,
  firstNPDProject: string
): Promise<void> {
  const config = await db.config.get(1);

  if (config) {
    const updates: Partial<typeof config> = {};

    if (!config.team_name && teamName) {
      updates.team_name = teamName;
    }

    if (!config.selected_month && month) {
      updates.selected_month = month;
    }

    if (!config.selected_project && firstNPDProject) {
      updates.selected_project = firstNPDProject;
    }

    if (Object.keys(updates).length > 0) {
      await db.config.update(1, updates);
    }
  }
}
