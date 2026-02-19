import type { TimesheetEntry } from '../types';

/**
 * Normalize and validate parsed CSV entries.
 * This ensures all required fields are present and properly typed.
 */
export function normalizeEntries(
  rawEntries: Partial<TimesheetEntry>[]
): { entries: TimesheetEntry[]; errors: string[] } {
  const entries: TimesheetEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];

    try {
      const entry = normalizeEntry(raw);
      entries.push(entry);
    } catch (error) {
      errors.push(`Entry ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { entries, errors };
}

/**
 * Normalize a single entry, ensuring all fields are present.
 */
function normalizeEntry(raw: Partial<TimesheetEntry>): TimesheetEntry {
  // Validate required fields
  if (!raw.timesheet_entry_id) {
    throw new Error('Missing timesheet_entry_id');
  }

  if (!raw.date) {
    throw new Error('Missing date');
  }

  if (!raw.person_id) {
    throw new Error('Missing person_id');
  }

  // Build complete entry with defaults for optional fields
  const entry: TimesheetEntry = {
    timesheet_entry_id: raw.timesheet_entry_id,
    date: raw.date,
    status: raw.status || '',
    person: raw.person || '',
    full_name: raw.full_name || '',
    client: raw.client || '',
    project: raw.project || '',
    activity: raw.activity!,
    hours: raw.hours || 0,
    billable: raw.billable || '',
    timesheet_entry_note: raw.timesheet_entry_note || '',
    task: raw.task || '',
    task_reference: raw.task_reference || '',
    folder: raw.folder || '',
    package: raw.package || '',
    person_id: raw.person_id,
    client_id: raw.client_id || '',
    project_id: raw.project_id || 0,
    activity_id: raw.activity_id || 0,
    task_id: raw.task_id || 0,
    folder_id: raw.folder_id || 0,
    package_id: raw.package_id || '',
    person_reference: raw.person_reference || '',
    client_reference: raw.client_reference || '',
    project_reference: raw.project_reference || '',
    is_done: raw.is_done || false,
    done_date: raw.done_date || '',
    team: raw.team || '',
    month: raw.month || '',
    week: raw.week || 0,
    tags: raw.tags || '',
    inherited_tags: raw.inherited_tags || '',
    max_effort: raw.max_effort || '',
    r_number: raw.r_number || 'UNKNOWN',
    work_order_group: raw.work_order_group || '',
    project_stage_type: raw.project_stage_type || '',
    drawing_number_rev: raw.drawing_number_rev || '',
    work_order_status: raw.work_order_status || '',
    part_code: raw.part_code || '',
    test_day: raw.test_day || '',
    source_facility: raw.source_facility || '',
    jn_order: raw.jn_order || '',
    job_type: raw.job_type || '',
    sourcing_category: raw.sourcing_category || '',
    po_number: raw.po_number || '',
    supplier: raw.supplier || '',
    due_date: raw.due_date || '',
    cpr_number: raw.cpr_number || '',
    region: raw.region || '',
    major_market: raw.major_market || '',
    department_code: raw.department_code || '',
    approved_date: raw.approved_date || '',
    approval: raw.approval || '',
    cost: raw.cost || '',
    project_phase: raw.project_phase || '',
    order: raw.order || '',
    dependency_satisfied_date: raw.dependency_satisfied_date || '',
    market: raw.market || '',
    task_approved_date: raw.task_approved_date || '',
    rework: raw.rework || '',
    original_deadline: raw.original_deadline || '',
    test_type: raw.test_type || '',
    andon: raw.andon || '',
    number_of_tests: raw.number_of_tests || '',
  };

  return entry;
}
