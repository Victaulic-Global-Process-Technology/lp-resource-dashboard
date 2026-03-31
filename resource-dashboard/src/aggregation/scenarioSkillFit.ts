import { db } from '../db/database';
import { PersonRole } from '../types';
import type { ScenarioAllocation } from '../types';
import { getEngineerCapacity } from '../utils/capacity';
import { computeCapacityForecast } from './capacityForecast';

export interface CandidateRanking {
  engineer: string;
  role: string;
  skill_fit_pct: number;        // 0–100
  skill_breakdown: {
    skill: string;
    rating: number;              // engineer's rating (0–5)
    max_rating: number;          // always 5
  }[];
  capacity_hours: number;        // monthly capacity
  current_allocated_hours: number; // already allocated in start month
  available_hours: number;       // capacity - current_allocated
  availability_pct: number;      // 0–1
  composite_score: number;       // sort key
}

/**
 * Rank all eligible engineers for a scenario based on skill fit + availability.
 *
 * Skill fit: sum of ratings for tagged skills / (count of tags × 5) × 100
 * Availability: from computeCapacityForecast for start_month
 * Composite: (skill_fit_pct × 0.6) + (availability_pct × 100 × 0.4)
 *
 * Engineers with exclude_from_capacity === true are excluded.
 */
export async function rankCandidatesForScenario(
  skillTags: string[],
  startMonth: string,
): Promise<CandidateRanking[]> {
  const [teamMembers, allSkills, config, forecast] = await Promise.all([
    db.teamMembers.toArray(),
    db.skills.toArray(),
    db.config.get(1),
    computeCapacityForecast([startMonth]),
  ]);

  const stdCapacity = config?.std_monthly_capacity_hours ?? 140;

  // Filter: engineers only, not excluded from capacity
  const eligible = teamMembers.filter(
    m => m.role === PersonRole.Engineer && !m.exclude_from_capacity,
  );

  // Build skills lookup: engineer → Map<skill, rating>
  const skillsByEngineer = new Map<string, Map<string, number>>();
  for (const s of allSkills) {
    if (!skillsByEngineer.has(s.engineer)) {
      skillsByEngineer.set(s.engineer, new Map());
    }
    skillsByEngineer.get(s.engineer)!.set(s.skill, s.rating);
  }

  // Build forecast lookup: engineer → allocated_hours in startMonth
  const forecastMap = new Map<string, number>();
  for (const entry of forecast.entries) {
    if (entry.month === startMonth) {
      forecastMap.set(entry.engineer, entry.allocated_hours);
    }
  }

  const results: CandidateRanking[] = [];

  for (const member of eligible) {
    const capacity = getEngineerCapacity(member, stdCapacity);
    const currentAllocated = forecastMap.get(member.full_name) ?? 0;
    const availableHours = Math.max(0, capacity - currentAllocated);
    const availabilityPct = capacity > 0 ? availableHours / capacity : 0;

    const engineerSkills = skillsByEngineer.get(member.full_name) ?? new Map<string, number>();

    // Skill fit
    let skillFitPct = 0;
    const skillBreakdown: CandidateRanking['skill_breakdown'] = [];

    if (skillTags.length > 0) {
      let ratingSum = 0;
      for (const tag of skillTags) {
        const rating = engineerSkills.get(tag) ?? 0;
        ratingSum += rating;
        skillBreakdown.push({ skill: tag, rating, max_rating: 5 });
      }
      skillFitPct = (ratingSum / (skillTags.length * 5)) * 100;
    }

    const compositeScore = skillTags.length > 0
      ? (skillFitPct * 0.6) + (availabilityPct * 100 * 0.4)
      : availabilityPct * 100;

    results.push({
      engineer: member.full_name,
      role: member.role,
      skill_fit_pct: skillFitPct,
      skill_breakdown: skillBreakdown,
      capacity_hours: capacity,
      current_allocated_hours: currentAllocated,
      available_hours: availableHours,
      availability_pct: availabilityPct,
      composite_score: compositeScore,
    });
  }

  return results.sort((a, b) => b.composite_score - a.composite_score);
}

/**
 * Add a month offset to a YYYY-MM string.
 */
export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Generate the list of YYYY-MM months from start (inclusive) for durationMonths.
 */
export function monthRange(startMonth: string, durationMonths: number): string[] {
  const months: string[] = [];
  for (let i = 0; i < durationMonths; i++) {
    months.push(addMonths(startMonth, i));
  }
  return months;
}

/**
 * Project the completion month for a scenario.
 *
 * Formula:
 *   totalMonthlyHours = sum of all allocations' planned_hours
 *   durationMonths = ceil(targetHours / totalMonthlyHours)
 *   completionMonth = startMonth + durationMonths - 1
 *
 * Returns null if no allocations or totalMonthlyHours === 0.
 * Returns startMonth with duration 1 if targetHours === 0.
 */
export function projectCompletion(
  startMonth: string,
  targetHours: number,
  allocations: Pick<ScenarioAllocation, 'planned_hours'>[],
): { completionMonth: string; durationMonths: number; totalMonthlyHours: number } | null {
  const totalMonthlyHours = allocations.reduce((sum, a) => sum + a.planned_hours, 0);

  if (allocations.length === 0 || totalMonthlyHours === 0) return null;

  if (targetHours === 0) {
    return { completionMonth: startMonth, durationMonths: 1, totalMonthlyHours };
  }

  const durationMonths = Math.ceil(targetHours / totalMonthlyHours);
  const completionMonth = addMonths(startMonth, durationMonths - 1);

  return { completionMonth, durationMonths, totalMonthlyHours };
}
