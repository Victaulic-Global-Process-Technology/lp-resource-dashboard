import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProjects } from '../hooks/useProjects';
import { db } from '../db/database';
import { ProjectType, WorkClass } from '../types';
import type { ProjectSkillRequirement } from '../types';
import { ProjectSkillTagEditor } from './ProjectSkillTagEditor';

export function ProjectsConfig() {
  const { projects, updateProject, loading } = useProjects();
  const teamMembers = useLiveQuery(() => db.teamMembers.toArray()) ?? [];
  const [typeFilter, setTypeFilter] = useState<Set<ProjectType>>(
    new Set([ProjectType.NPD, ProjectType.Sustaining, ProjectType.Admin, ProjectType.OutOfOffice, ProjectType.Sprint])
  );
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Fetch all project skill requirements for pill display
  const allRequirements = useLiveQuery(() => db.projectSkillRequirements.toArray());
  const requirementsByProject = new Map<string, ProjectSkillRequirement[]>();
  if (allRequirements) {
    for (const req of allRequirements) {
      const list = requirementsByProject.get(req.project_id) ?? [];
      list.push(req);
      requirementsByProject.set(req.project_id, list);
    }
  }

  const toggleTypeFilter = (type: ProjectType) => {
    const newFilter = new Set(typeFilter);
    if (newFilter.has(type)) {
      newFilter.delete(type);
    } else {
      newFilter.add(type);
    }
    setTypeFilter(newFilter);
  };

  const filteredProjects = projects.filter(p => typeFilter.has(p.type));

  if (loading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  const editingProject = editingProjectId
    ? projects.find((p) => p.project_id === editingProjectId)
    : null;

  return (
    <div className="space-y-5">
      {/* Type filter */}
      <div>
        <h3 className="text-[13px] font-medium text-[var(--text-secondary)] mb-3">Filter by Type</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(ProjectType).map((type) => (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className={`px-3 py-1 text-[13px] font-medium rounded-md ${
                typeFilter.has(type)
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-table-header)] text-[var(--text-secondary)] hover:bg-[var(--bg-table-hover)]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--border-default)]">
          <thead className="bg-[var(--bg-table-header)]">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Project ID
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Project Name
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Type
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Work Class
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Required Skills
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border-subtle)]">
            {filteredProjects.map((project) => {
              const reqs = requirementsByProject.get(project.project_id) ?? [];
              return (
                <React.Fragment key={project.project_id}>
                <tr className="hover:bg-[var(--bg-table-hover)]">
                  <td className="px-6 py-4 text-[13px] font-medium text-[var(--text-primary)]">
                    <div className="flex items-center gap-2">
                      {project.project_id}
                      <button
                        onClick={() => setExpandedProjectId(
                          expandedProjectId === project.project_id ? null : project.project_id
                        )}
                        className="text-[10px] text-[var(--accent)] hover:underline"
                        title="Toggle extended details"
                      >
                        {expandedProjectId === project.project_id ? '▾' : '▸'} details
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={project.project_name}
                      onChange={(e) => updateProject(project.project_id, { project_name: e.target.value })}
                      className="w-full text-[13px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={project.type}
                      onChange={(e) => updateProject(project.project_id, { type: e.target.value as ProjectType })}
                      className="text-[13px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                    >
                      {Object.values(ProjectType).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={project.work_class}
                      onChange={(e) => updateProject(project.project_id, { work_class: e.target.value as WorkClass })}
                      className="text-[13px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                    >
                      {Object.values(WorkClass).map((wc) => (
                        <option key={wc} value={wc}>
                          {wc}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {reqs.length > 0 ? (
                        <>
                          {reqs
                            .sort((a, b) => b.weight - a.weight)
                            .map((req) => (
                              <span
                                key={req.skill}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-[var(--accent)] text-white"
                                title={`${req.skill} — weight ${req.weight}`}
                              >
                                {req.skill}
                                <span className="opacity-70">×{req.weight}</span>
                              </span>
                            ))}
                          <button
                            onClick={() => setEditingProjectId(project.project_id)}
                            className="text-[11px] text-[var(--accent)] hover:underline font-medium"
                          >
                            Edit
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingProjectId(project.project_id)}
                          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--accent)] hover:underline"
                        >
                          + Add skills
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedProjectId === project.project_id && (
                  <tr className="bg-[var(--bg-table-header)]">
                    <td colSpan={5} className="px-6 py-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Product Category</label>
                          <input
                            type="text"
                            value={project.product_category ?? ''}
                            onChange={(e) => updateProject(project.project_id, { product_category: e.target.value || undefined })}
                            placeholder="e.g., Couplings, Valves"
                            className="w-full text-[12px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Mendix Score (1-10)</label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={project.mendix_score ?? ''}
                            onChange={(e) => updateProject(project.project_id, { mendix_score: e.target.value ? parseInt(e.target.value) : undefined })}
                            className="w-full text-[12px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Assigned Engineer</label>
                          <select
                            value={project.assigned_engineer ?? ''}
                            onChange={(e) => updateProject(project.project_id, { assigned_engineer: e.target.value || undefined })}
                            className="w-full text-[12px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                          >
                            <option value="">—</option>
                            {teamMembers.map(m => (
                              <option key={m.person_id} value={m.full_name}>{m.full_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Assigned Lab Tech</label>
                          <select
                            value={project.assigned_lab_tech ?? ''}
                            onChange={(e) => updateProject(project.project_id, { assigned_lab_tech: e.target.value || undefined })}
                            className="w-full text-[12px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                          >
                            <option value="">—</option>
                            {teamMembers.map(m => (
                              <option key={m.person_id} value={m.full_name}>{m.full_name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Est. Eng Hours</label>
                          <input
                            type="number"
                            min={0}
                            value={project.estimated_eng_hours ?? ''}
                            onChange={(e) => updateProject(project.project_id, { estimated_eng_hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="w-full text-[12px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--text-muted)] uppercase mb-1">Est. Lab Hours</label>
                          <input
                            type="number"
                            min={0}
                            value={project.estimated_lab_hours ?? ''}
                            onChange={(e) => updateProject(project.project_id, { estimated_lab_hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="w-full text-[12px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          No projects match the selected filters.
        </div>
      )}

      {/* Skill tag editor modal */}
      {editingProjectId && editingProject && (
        <ProjectSkillTagEditor
          projectId={editingProjectId}
          projectName={editingProject.project_name}
          isOpen={true}
          onClose={() => setEditingProjectId(null)}
        />
      )}
    </div>
  );
}
