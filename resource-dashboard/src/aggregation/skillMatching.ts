import type { ProjectSkillRequirement, SkillRating, TeamMember } from '../types';
import { PersonRole } from '../types';

export interface CompatibilityScore {
  engineer: string;
  score: number;    // 0-100 normalized
}

/**
 * Compute compatibility scores for all engineers against a project's skill requirements.
 *
 * Algorithm (weighted dot product, normalized to 0-100):
 *   raw_score = SUM(weight_i * rating_i)   for each required skill i
 *   max_score = SUM(weight_i * 5)           (perfect = all ratings at 5)
 *   score     = (raw_score / max_score) * 100
 *
 * Pure synchronous function — takes pre-fetched arrays to avoid redundant DB queries.
 */
export function computeCompatibilityScores(
  requirements: ProjectSkillRequirement[],
  skills: SkillRating[],
  teamMembers: TeamMember[]
): CompatibilityScore[] {
  if (requirements.length === 0) return [];

  // Build lookup: "engineer|skill" -> rating
  const skillMap = new Map<string, number>();
  for (const s of skills) {
    skillMap.set(`${s.engineer}|${s.skill}`, s.rating);
  }

  // Max possible score (all ratings at 5)
  const maxScore = requirements.reduce((sum, req) => sum + req.weight * 5, 0);

  // Score each engineer
  const engineers = teamMembers.filter((m) => m.role === PersonRole.Engineer);

  const scores: CompatibilityScore[] = engineers.map((member) => {
    const rawScore = requirements.reduce((sum, req) => {
      const rating = skillMap.get(`${member.full_name}|${req.skill}`) ?? 0;
      return sum + req.weight * rating;
    }, 0);

    return {
      engineer: member.full_name,
      score: maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0,
    };
  });

  // Sort descending by score, then alphabetical for ties
  scores.sort((a, b) => b.score - a.score || a.engineer.localeCompare(b.engineer));

  return scores;
}
