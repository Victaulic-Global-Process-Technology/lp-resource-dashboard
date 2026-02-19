import Papa from 'papaparse';
import { ActivityType } from '../types';
import type { TimesheetEntry } from '../types';

// CSV column header to TypeScript field mapping
const CSV_COLUMN_MAP: Record<string, keyof TimesheetEntry> = {
  'date': 'date',
  'status': 'status',
  'person': 'person',
  'full_name': 'full_name',
  'client': 'client',
  'project': 'project',
  'activity': 'activity',
  'hours': 'hours',
  'billable': 'billable',
  'timesheet_entry_note': 'timesheet_entry_note',
  'task': 'task',
  'task_reference': 'task_reference',
  'folder': 'folder',
  'package': 'package',
  'person_id': 'person_id',
  'client_id': 'client_id',
  'project_id': 'project_id',
  'activity_id': 'activity_id',
  'task_id': 'task_id',
  'folder_id': 'folder_id',
  'package_id': 'package_id',
  'timesheet_entry_id': 'timesheet_entry_id',
  'person_reference': 'person_reference',
  'client_reference': 'client_reference',
  'project_reference': 'project_reference',
  'is_done': 'is_done',
  'done_date': 'done_date',
  'team': 'team',
  'month': 'month',
  'week': 'week',
  'tags': 'tags',
  'inherited_tags': 'inherited_tags',
  'max_effort': 'max_effort',
  'R #': 'r_number',                       // NOTE: space before #
  'Work Order Group': 'work_order_group',
  'Project Stage/Type': 'project_stage_type',
  'Drawing Number & Rev': 'drawing_number_rev',
  'Work Order Status': 'work_order_status',
  'Part Code': 'part_code',
  'Test Day': 'test_day',
  'Source/ Facility': 'source_facility',    // NOTE: space before /
  'JN/ Order #': 'jn_order',               // NOTE: space before /
  'Job Type ': 'job_type',                  // NOTE: trailing space
  'Sourcing Category': 'sourcing_category',
  'PO#': 'po_number',
  'Supplier': 'supplier',
  'Due Date': 'due_date',
  'CPR#': 'cpr_number',
  'Region': 'region',
  'Major Market': 'major_market',
  'Department Code': 'department_code',
  'Approved Date': 'approved_date',
  'Approval': 'approval',
  'Cost': 'cost',
  'Project Phase': 'project_phase',
  'Order': 'order',
  'Dependency Satisfied Date': 'dependency_satisfied_date',
  'Market': 'market',
  'Task Approved Date': 'task_approved_date',
  'Rework': 'rework',
  'Original Deadline': 'original_deadline',
  'Test Type': 'test_type',
  'Andon': 'andon',
  'Number of Tests': 'number_of_tests',
};

/**
 * Extract team name and date range from LP export filename.
 * Pattern: Victaulic.timesheets.{TEAM}.{START} to {END}.csv
 * Also accepts legacy underscore pattern for backward compatibility.
 */
export function parseFilename(filename: string): {
  team: string;
  startDate: string;
  endDate: string;
} | null {
  // Primary pattern: Victaulic.timesheets.{TEAM}.{START} to {END}.csv
  const dotMatch = filename.match(
    /^Victaulic\.timesheets\.(.+)\.(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\.csv$/
  );
  if (dotMatch) {
    return { team: dotMatch[1], startDate: dotMatch[2], endDate: dotMatch[3] };
  }

  // Legacy pattern: Victaulic_timesheets_{TEAM}_{START}_to_{END}.csv
  const underscoreMatch = filename.match(
    /^Victaulic_timesheets_(.+)_(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.csv$/
  );
  if (underscoreMatch) {
    return { team: underscoreMatch[1], startDate: underscoreMatch[2], endDate: underscoreMatch[3] };
  }

  return null;
}

/**
 * Parse and validate a CSV file into TimesheetEntry objects.
 */
export async function parseCSV(file: File): Promise<{
  entries: Partial<TimesheetEntry>[];
  errors: string[];
}> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    const entries: Partial<TimesheetEntry>[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Remove BOM if present and trim
        return header.replace(/^\uFEFF/, '').trim();
      },
      complete: (results) => {
        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          try {
            const entry = mapRowToEntry(row);
            entries.push(entry);
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        resolve({ entries, errors });
      },
      error: (error) => {
        errors.push(`Parse error: ${error.message}`);
        resolve({ entries, errors });
      },
    });
  });
}

/**
 * Map a CSV row to a TimesheetEntry object with proper type coercion.
 */
function mapRowToEntry(row: Record<string, string>): Partial<TimesheetEntry> {
  const entry: Partial<TimesheetEntry> = {};

  for (const [csvColumn, tsField] of Object.entries(CSV_COLUMN_MAP)) {
    const value = row[csvColumn];

    // Handle missing/empty values
    if (value === undefined || value === null) {
      (entry as any)[tsField] = '';
      continue;
    }

    const trimmedValue = value.trim();

    // Type coercion based on field type
    switch (tsField) {
      case 'hours':
        (entry as any)[tsField] = parseFloat(trimmedValue) || 0;
        break;

      case 'person_id':
      case 'project_id':
      case 'activity_id':
      case 'task_id':
      case 'folder_id':
      case 'timesheet_entry_id':
        (entry as any)[tsField] = parseInt(trimmedValue) || 0;
        break;

      case 'week':
        (entry as any)[tsField] = parseInt(trimmedValue) || 0;
        break;

      case 'is_done':
        (entry as any)[tsField] = trimmedValue.toLowerCase() === 'true';
        break;

      case 'activity':
        // Validate activity type
        if (Object.values(ActivityType).includes(trimmedValue as ActivityType)) {
          (entry as any)[tsField] = trimmedValue as ActivityType;
        } else {
          (entry as any)[tsField] = trimmedValue; // Store as-is, will be flagged in validation
        }
        break;

      default:
        (entry as any)[tsField] = trimmedValue;
    }
  }

  // Validate required fields
  if (!entry.timesheet_entry_id) {
    throw new Error('Missing timesheet_entry_id');
  }

  if (!entry.date) {
    throw new Error('Missing date');
  }

  if (!entry.r_number) {
    // Assign synthetic code for missing R#
    entry.r_number = 'UNKNOWN';
  }

  return entry;
}
