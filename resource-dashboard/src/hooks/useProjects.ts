import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Project, ProjectType } from '../types';
import { refreshKPIHistory } from '../aggregation/kpiHistory';

/**
 * Hook for project CRUD operations.
 */
export function useProjects() {
  const projects = useLiveQuery(() => db.projects.toArray());

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    await db.projects.update(projectId, updates);
    // Reclassifying type/work_class changes historical KPIs — refresh snapshots
    if ('type' in updates || 'work_class' in updates) {
      refreshKPIHistory();
    }
  };

  const addProject = async (project: Project) => {
    await db.projects.add(project);
  };

  const getProject = async (projectId: string) => {
    return await db.projects.get(projectId);
  };

  // Get projects filtered by type
  const getProjectsByType = (type: ProjectType) => {
    return projects?.filter(p => p.type === type) ?? [];
  };

  return {
    projects: projects ?? [],
    updateProject,
    addProject,
    getProject,
    getProjectsByType,
    loading: projects === undefined,
  };
}
