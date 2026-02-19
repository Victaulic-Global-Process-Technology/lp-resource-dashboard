import { db } from '../db/database';
import { computeAnomalies, generateAnomalyId } from './anomalies';
import { isRuleEnabled } from './anomalyRules';
import type { StoredAnomaly, AnomalyWithStatus, AnomalyThreshold } from '../types';

/**
 * Refresh the anomaly history snapshot for a given month/project filter.
 * Computes current anomalies, converts to StoredAnomaly with stable IDs, and upserts.
 */
export async function refreshAnomalyHistory(
  month: string,
  projectFilter?: string
): Promise<void> {
  const filter = projectFilter ?? '';
  const anomalies = await computeAnomalies(month, filter || undefined);

  const stored: StoredAnomaly[] = anomalies.map(a => ({
    anomaly_id: generateAnomalyId(a),
    type: a.type,
    severity: a.severity,
    title: a.title,
    detail: a.detail,
    person: a.person,
    projectId: a.projectId,
    ruleId: a.ruleId,
  }));

  const now = new Date().toISOString();

  // Check for existing snapshot
  const existing = await db.anomalyHistory
    .where('[month+project_filter]')
    .equals([month, filter])
    .first();

  if (existing && existing.id != null) {
    await db.anomalyHistory.update(existing.id, {
      computed_at: now,
      anomalies: stored,
    });
  } else {
    await db.anomalyHistory.add({
      month,
      project_filter: filter,
      computed_at: now,
      anomalies: stored,
    });
  }
}

/**
 * Get anomalies for a month enriched with cross-month status (new/recurring/resolved).
 * Compares current month's snapshot against the previous month.
 */
export async function getAnomaliesWithStatus(
  month: string,
  projectFilter?: string
): Promise<AnomalyWithStatus[]> {
  const filter = projectFilter ?? '';

  // Get current month snapshot
  const currentSnapshot = await db.anomalyHistory
    .where('[month+project_filter]')
    .equals([month, filter])
    .first();

  if (!currentSnapshot) {
    // No snapshot yet — compute live and treat all as new
    const live = await computeAnomalies(month, filter || undefined);
    return live.map(a => ({
      anomaly_id: generateAnomalyId(a),
      type: a.type,
      severity: a.severity,
      title: a.title,
      detail: a.detail,
      person: a.person,
      projectId: a.projectId,
      ruleId: a.ruleId,
      status: 'new' as const,
    }));
  }

  // Get all prior snapshots for this filter, sorted by month descending
  const allSnapshots = await db.anomalyHistory
    .where('project_filter')
    .equals(filter)
    .sortBy('month');

  const priorSnapshots = allSnapshots.filter(s => s.month < month);

  // Build a map of anomaly_id -> how many consecutive prior months it appeared
  const currentIds = new Set(currentSnapshot.anomalies.map(a => a.anomaly_id));

  // Count consecutive prior months each anomaly appeared (going backwards)
  const recurringCount = new Map<string, number>();
  const priorReversed = [...priorSnapshots].reverse();

  for (const prior of priorReversed) {
    const priorIds = new Set(prior.anomalies.map(a => a.anomaly_id));
    let foundAny = false;
    for (const id of currentIds) {
      if (priorIds.has(id)) {
        recurringCount.set(id, (recurringCount.get(id) ?? 0) + 1);
        foundAny = true;
      }
    }
    // Stop if no overlap at all (gap in recurrence breaks the streak)
    if (!foundAny) break;
  }

  // Previous month's snapshot (for resolved detection)
  const prevSnapshot = priorReversed[0];

  // Build result: current anomalies with status
  const result: AnomalyWithStatus[] = currentSnapshot.anomalies.map(a => {
    const count = recurringCount.get(a.anomaly_id) ?? 0;
    return {
      ...a,
      status: count > 0 ? 'recurring' as const : 'new' as const,
      recurring_months: count > 0 ? count : undefined,
    };
  });

  // Add resolved anomalies (were in previous month but not in current)
  if (prevSnapshot) {
    for (const prevAnomaly of prevSnapshot.anomalies) {
      if (!currentIds.has(prevAnomaly.anomaly_id)) {
        result.push({
          ...prevAnomaly,
          status: 'resolved',
        });
      }
    }
  }

  // Filter out anomalies from rules that are currently disabled in settings.
  // Snapshots may contain stale data from before a rule was toggled off.
  const storedThresholds = await db.anomalyThresholds.toArray();
  const thresholdMap: Map<string, AnomalyThreshold> = new Map(
    storedThresholds.map(t => [t.ruleId, t])
  );
  return result.filter(a => isRuleEnabled(thresholdMap, a.ruleId));
}
