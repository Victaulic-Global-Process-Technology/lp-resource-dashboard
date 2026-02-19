import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { PersonRole } from '../types';
import type { TeamMember } from '../types';
import { refreshKPIHistory } from '../aggregation/kpiHistory';

/**
 * Hook for team member CRUD operations.
 */
export function useTeamMembers() {
  const teamMembers = useLiveQuery(() => db.teamMembers.toArray());

  const updateMember = async (personId: number, updates: Partial<TeamMember>) => {
    await db.teamMembers.update(personId, updates);
    // Role or capacity changes affect KPI calculations
    if ('role' in updates || 'capacity_override_hours' in updates) {
      refreshKPIHistory();
    }
  };

  const addMember = async (member: Omit<TeamMember, 'person_id'> & { person_id: number }) => {
    await db.teamMembers.add(member);
  };

  // Get sorted list: engineers first, then techs, alphabetically within each group
  const sortedMembers = teamMembers
    ? [...teamMembers].sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === PersonRole.Engineer ? -1 : 1;
        }
        return a.full_name.localeCompare(b.full_name);
      })
    : [];

  return {
    teamMembers: sortedMembers,
    updateMember,
    addMember,
    loading: teamMembers === undefined,
  };
}
