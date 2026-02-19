import { parseCSV, parseFilename } from './csvParser';
import { normalizeEntries } from './normalizer';
import {
  deduplicateEntries,
  updateTeamMembers,
  updateProjects,
  storeEntries,
  logImport,
  updateConfigFromImport,
} from '../db/operations';
import { db } from '../db/database';
import { ProjectType } from '../types';
import type { ImportResult } from '../types';
import { refreshKPIHistory } from '../aggregation/kpiHistory';
import { refreshAnomalyHistory } from '../aggregation/anomalyHistory';
import {
  detectCSVType,
  parseFeedbackCSV,
  type FeedbackImportResult,
} from './feedbackParser';
import { fromDbMonth } from '../utils/monthRange';

/**
 * Orchestrates the full import process:
 * Parse → Normalize → Deduplicate → Store → Update derived entities → Log
 */
export async function importCSVFile(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    filename: file.name,
    team: '',
    dateRangeStart: '',
    dateRangeEnd: '',
    totalRowsParsed: 0,
    newRowsInserted: 0,
    duplicateRowsSkipped: 0,
    newPeopleDiscovered: [],
    newProjectsDiscovered: [],
    totalHoursImported: 0,
    errors: [],
  };

  try {
    // Extract metadata from filename
    const filenameMeta = parseFilename(file.name);
    if (!filenameMeta) {
      result.errors.push(
        'Filename does not match expected pattern: Victaulic.timesheets.{TEAM}.{START} to {END}.csv'
      );
    } else {
      result.team = filenameMeta.team;
      result.dateRangeStart = filenameMeta.startDate;
      result.dateRangeEnd = filenameMeta.endDate;
    }

    // Step 1: Parse CSV
    const { entries: rawEntries, errors: parseErrors } = await parseCSV(file);
    result.errors.push(...parseErrors);
    result.totalRowsParsed = rawEntries.length;

    if (rawEntries.length === 0) {
      result.errors.push('No data rows found in CSV');
      return result;
    }

    // Step 2: Normalize entries
    const { entries: normalizedEntries, errors: normalizeErrors } =
      normalizeEntries(rawEntries);
    result.errors.push(...normalizeErrors);

    if (normalizedEntries.length === 0) {
      result.errors.push('No valid entries after normalization');
      return result;
    }

    // Step 3: Deduplicate against existing database
    const { newEntries, duplicateCount } = await deduplicateEntries(normalizedEntries);
    result.duplicateRowsSkipped = duplicateCount;
    result.newRowsInserted = newEntries.length;

    if (newEntries.length === 0) {
      result.success = true;
      result.errors.push('All entries already exist in database (0 new entries)');
      return result;
    }

    // Step 4: Store new entries
    await storeEntries(newEntries);

    // Step 5: Update team members (auto-discover new people)
    const newPeople = await updateTeamMembers(newEntries);
    result.newPeopleDiscovered = newPeople;

    // Step 6: Update projects (auto-discover new R# codes)
    const newProjects = await updateProjects(newEntries);
    result.newProjectsDiscovered = newProjects;

    // Step 7: Calculate total hours imported
    result.totalHoursImported = newEntries.reduce((sum, e) => sum + e.hours, 0);

    // Step 8: Update config if this is the first import
    if (result.team) {
      // Get the first NPD project for config
      const projects = await db.projects.where('type').equals(ProjectType.NPD).toArray();
      const firstNPDProject = projects.length > 0 ? projects[0].project_id : '';

      // Extract month from the first entry
      const month = newEntries[0] ? fromDbMonth(newEntries[0].month) : '';

      await updateConfigFromImport(result.team, month, firstNPDProject);
    }

    // Step 9: Log the import
    await logImport({
      filename: file.name,
      imported_at: new Date().toISOString(),
      team: result.team,
      date_range_start: result.dateRangeStart,
      date_range_end: result.dateRangeEnd,
      total_rows: result.totalRowsParsed,
      new_rows: result.newRowsInserted,
      duplicate_rows: result.duplicateRowsSkipped,
      people_count: result.newPeopleDiscovered.length,
      total_hours: result.totalHoursImported,
    });

    // Step 10: Refresh KPI history snapshots
    await refreshKPIHistory();

    // Step 11: Refresh anomaly history for all imported months
    const importedMonths = [...new Set(newEntries.map(e => fromDbMonth(e.month)))];
    for (const m of importedMonths) {
      await refreshAnomalyHistory(m);
    }

    result.success = true;
  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    result.success = false;
  }

  return result;
}

/**
 * Import a Microsoft Forms feedback CSV file.
 * Parses form responses and upserts into weeklyUpdates table.
 */
export async function importFeedbackFile(file: File): Promise<FeedbackImportResult> {
  const result: FeedbackImportResult = {
    success: false,
    filename: file.name,
    type: 'feedback',
    imported: 0,
    updated: 0,
    projects: [],
    weekEnding: '',
    errors: [],
    warnings: [],
  };

  try {
    const csvText = await file.text();
    const { feedbacks, warnings } = parseFeedbackCSV(csvText, file.name);
    result.warnings = warnings;

    if (feedbacks.length === 0) {
      result.errors.push('No valid feedback entries found in CSV');
      return result;
    }

    const projectSet = new Set<string>();
    const weekSet = new Set<string>();

    for (const fb of feedbacks) {
      try {
        projectSet.add(fb.project_id);
        weekSet.add(fb.week_ending);

        const existing = await db.weeklyUpdates
          .where('[project_id+week_ending]')
          .equals([fb.project_id, fb.week_ending])
          .first();

        const record = {
          project_id: fb.project_id,
          week_ending: fb.week_ending,
          status: fb.status,
          completed_summary: fb.completed_summary,
          action_items: fb.action_items,
          next_milestones: fb.next_milestones,
          notes: fb.notes,
          updated_at: fb.submitted_at,
          updated_by: fb.updated_by,
        };

        if (existing) {
          await db.weeklyUpdates.update(existing.id!, record);
          result.updated++;
        } else {
          await db.weeklyUpdates.add(record);
          result.imported++;
        }
      } catch (err) {
        result.errors.push(`Failed to import ${fb.project_id} week ${fb.week_ending}: ${err}`);
      }
    }

    result.projects = [...projectSet].sort();
    result.weekEnding = [...weekSet].sort().reverse()[0] ?? '';
    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/** Union result type returned from multi-file import */
export type AnyImportResult = ImportResult | FeedbackImportResult;

/**
 * Detect CSV type by reading the first line of headers.
 */
async function detectFileType(file: File): Promise<'timesheet' | 'feedback' | 'unknown'> {
  const text = await file.text();
  const firstLine = text.split('\n')[0] ?? '';
  const headers = firstLine.split(',').map(h => h.replace(/"/g, '').trim());
  return detectCSVType(headers);
}

/**
 * Import multiple CSV files sequentially. Auto-detects timesheet vs feedback.
 */
export async function importMultipleCSVFiles(
  files: File[],
  onProgress?: (current: number, total: number, filename: string) => void
): Promise<AnyImportResult[]> {
  const results: AnyImportResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (onProgress) {
      onProgress(i + 1, files.length, file.name);
    }

    const fileType = await detectFileType(file);

    if (fileType === 'feedback') {
      const result = await importFeedbackFile(file);
      results.push(result);
    } else if (fileType === 'timesheet') {
      const result = await importCSVFile(file);
      results.push(result);
    } else {
      // Unknown type — try as timesheet (original behavior), report error if it fails
      const result = await importCSVFile(file);
      if (!result.success && result.errors.length > 0) {
        result.errors.unshift('Could not detect CSV type. Expected LiquidPlanner timesheet or Microsoft Forms feedback export.');
      }
      results.push(result);
    }
  }

  return results;
}
