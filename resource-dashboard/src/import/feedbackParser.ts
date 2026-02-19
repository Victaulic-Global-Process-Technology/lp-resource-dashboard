import Papa from 'papaparse';
import { parse, isValid, format } from 'date-fns';
import { getWeekFriday } from '../utils/weekDates';
import type { ActionItem, UpdateStatus } from '../types';

// ── Types ──

export interface ParsedFeedback {
  project_id: string;
  week_ending: string;       // YYYY-MM-DD Friday
  status: UpdateStatus;
  completed_summary: string;
  action_items: ActionItem[];
  next_milestones: string;
  notes: string;
  updated_by: string;
  submitted_at: string;
}

export interface FeedbackImportResult {
  success: boolean;
  filename: string;
  type: 'feedback';
  imported: number;
  updated: number;
  projects: string[];
  weekEnding: string;
  errors: string[];
  warnings: string[];
}

// ── Column Mapping ──

const COLUMN_MAP: Record<string, string[]> = {
  respondent_name: ['your name'],
  project: ['project'],
  week_ending: ['week ending (friday)', 'week ending'],
  status: ['project status', 'status'],
  completed_summary: ['what did you accomplish this week?', 'accomplished', 'completed'],
  action_items_raw: ['action items'],
  next_milestones: ['next milestones', 'milestones'],
  notes: ['additional notes', 'notes'],
};

function findColumn(headers: string[], aliases: string[]): number {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lowerHeaders.indexOf(alias.toLowerCase());
    if (idx !== -1) return idx;
  }
  // Partial match fallback
  for (const alias of aliases) {
    const idx = lowerHeaders.findIndex(h => h.includes(alias.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

// ── Date Normalization ──

function normalizeDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  // Try common date formats
  const formats = ['M/d/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd/M/yyyy', 'dd/MM/yyyy'];
  for (const fmt of formats) {
    const parsed = parse(trimmed, fmt, new Date());
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd');
    }
  }

  // Fallback: Date constructor
  const fallback = new Date(trimmed);
  if (isValid(fallback)) {
    return format(fallback, 'yyyy-MM-dd');
  }

  throw new Error(`Cannot parse date: ${dateStr}`);
}

// ── Project ID Extraction ──

function extractProjectId(projectString: string): string {
  const match = projectString.match(/^([RST]\d+(?:\.\d+[A-Z]?)?)/);
  return match ? match[1] : projectString.trim();
}

// ── Status Mapping ──

function mapStatus(raw: string): UpdateStatus {
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('on track')) return 'on-track';
  if (normalized.includes('at risk')) return 'at-risk';
  if (normalized.includes('blocked')) return 'blocked';
  if (normalized.includes('complete')) return 'complete';
  return 'on-track';
}

// ── Action Item Parser ──

export function parseActionItems(raw: string): ActionItem[] {
  if (!raw || !raw.trim()) return [];

  const items: ActionItem[] = [];
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);

  for (let line of lines) {
    // Remove leading bullets/numbers
    line = line.replace(/^\d+[.)]\s*/, '').replace(/^[-•·]\s*/, '').trim();
    if (!line) continue;

    let owner = '';
    let due_date = '';

    // Extract owner: "text - Name" at end
    const ownerDash = line.match(/\s+-\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*$/);
    if (ownerDash) {
      owner = ownerDash[1];
      line = line.replace(ownerDash[0], '').trim();
    } else {
      // Try "(Name)" at end
      const ownerParen = line.match(/\(([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\)\s*$/);
      if (ownerParen) {
        owner = ownerParen[1];
        line = line.replace(ownerParen[0], '').trim();
      }
    }

    // Extract due date: "by M/DD" or "by MM/DD/YYYY"
    const dateMatch = line.match(/\b(?:by|due)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
    if (dateMatch) {
      const rawDate = dateMatch[1];
      try {
        // Add year if missing
        const parts = rawDate.split('/');
        const dateWithYear = parts.length === 2
          ? `${rawDate}/${new Date().getFullYear()}`
          : rawDate;
        const parsed = parse(dateWithYear, parts.length === 2 ? 'M/d/yyyy' : 'M/d/yyyy', new Date());
        if (isValid(parsed)) {
          due_date = format(parsed, 'yyyy-MM-dd');
        }
      } catch {
        // Keep empty
      }
    }

    items.push({
      id: crypto.randomUUID(),
      text: line.replace(/\s+/g, ' ').trim(),
      owner,
      due_date,
      done: false,
    });
  }

  return items;
}

// ── CSV Type Detection ──

export function detectCSVType(headers: string[]): 'timesheet' | 'feedback' | 'unknown' {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  // LiquidPlanner timesheets: date, person, activity, hours, r #
  const timesheetSignature = ['date', 'person', 'activity', 'hours'];
  const isTimesheet = timesheetSignature.every(s =>
    lowerHeaders.some(h => h.includes(s))
  ) && lowerHeaders.some(h => h.includes('r #') || h.includes('r_number'));

  // Microsoft Forms: id, start time, completion time, email
  const feedbackSignature = ['id', 'start time', 'completion time', 'email'];
  const isFeedback = feedbackSignature.every(s =>
    lowerHeaders.some(h => h.includes(s))
  );

  if (isTimesheet) return 'timesheet';
  if (isFeedback) return 'feedback';
  return 'unknown';
}

// ── Main Parser ──

export function parseFeedbackCSV(csvText: string, _filename: string): {
  feedbacks: ParsedFeedback[];
  warnings: string[];
} {
  const warnings: string[] = [];

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (!parsed.data || parsed.data.length === 0) {
    return { feedbacks: [], warnings: ['No data rows found in CSV'] };
  }

  const headers = parsed.meta.fields ?? [];

  // Build column index map
  const colIdx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    const idx = findColumn(headers, aliases);
    if (idx === -1) {
      warnings.push(`Column not found for "${field}" — will use empty values`);
    }
    colIdx[field] = idx;
  }

  // Find completion_time column for dedup
  const completionTimeIdx = findColumn(headers, ['completion time']);

  const rawFeedbacks: (ParsedFeedback & { completion_time: string })[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i] as Record<string, string>;
    const values = headers.map(h => row[h] ?? '');

    const getVal = (field: string) => {
      const idx = colIdx[field];
      return idx >= 0 ? (values[idx] ?? '').trim() : '';
    };

    const projectRaw = getVal('project');
    if (!projectRaw) {
      warnings.push(`Row ${i + 2}: Missing project — skipped`);
      continue;
    }

    const weekEndingRaw = getVal('week_ending');
    if (!weekEndingRaw) {
      warnings.push(`Row ${i + 2}: Missing week ending date — skipped`);
      continue;
    }

    let weekEnding: string;
    try {
      const normalized = normalizeDate(weekEndingRaw);
      weekEnding = getWeekFriday(normalized);
      if (normalized !== weekEnding) {
        warnings.push(`Row ${i + 2}: Date ${weekEndingRaw} snapped to Friday ${weekEnding}`);
      }
    } catch (err) {
      warnings.push(`Row ${i + 2}: Invalid date "${weekEndingRaw}" — skipped`);
      continue;
    }

    const completionTime = completionTimeIdx >= 0 ? (values[completionTimeIdx] ?? '') : '';

    rawFeedbacks.push({
      project_id: extractProjectId(projectRaw),
      week_ending: weekEnding,
      status: mapStatus(getVal('status')),
      completed_summary: getVal('completed_summary'),
      action_items: parseActionItems(getVal('action_items_raw')),
      next_milestones: getVal('next_milestones'),
      notes: getVal('notes'),
      updated_by: getVal('respondent_name'),
      submitted_at: completionTime ? new Date(completionTime).toISOString() : new Date().toISOString(),
      completion_time: completionTime,
    });
  }

  // Deduplicate: keep latest submission per [project_id, week_ending]
  const deduped = new Map<string, ParsedFeedback & { completion_time: string }>();
  for (const fb of rawFeedbacks) {
    const key = `${fb.project_id}::${fb.week_ending}`;
    const existing = deduped.get(key);
    if (!existing || fb.completion_time > existing.completion_time) {
      deduped.set(key, fb);
    }
  }

  if (deduped.size < rawFeedbacks.length) {
    warnings.push(`${rawFeedbacks.length - deduped.size} duplicate submission(s) resolved (kept latest)`);
  }

  // Strip completion_time from results
  const feedbacks: ParsedFeedback[] = [...deduped.values()].map(({ completion_time: _, ...rest }) => rest);

  return { feedbacks, warnings };
}
