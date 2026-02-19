import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

/**
 * Hook for project skill requirement CRUD operations.
 * Optionally filters by project_id; omit for all requirements.
 */
export function useProjectSkillRequirements(projectId?: string) {
  const requirements = useLiveQuery(
    () =>
      projectId
        ? db.projectSkillRequirements.where('project_id').equals(projectId).toArray()
        : db.projectSkillRequirements.toArray(),
    [projectId]
  );

  const setRequirements = async (
    targetProjectId: string,
    skills: { skill: string; weight: number }[]
  ) => {
    await db.projectSkillRequirements
      .where('project_id')
      .equals(targetProjectId)
      .delete();

    if (skills.length > 0) {
      await db.projectSkillRequirements.bulkAdd(
        skills.map((s) => ({
          project_id: targetProjectId,
          skill: s.skill,
          weight: s.weight,
        }))
      );
    }
  };

  return {
    requirements: requirements ?? [],
    setRequirements,
    loading: requirements === undefined,
  };
}
