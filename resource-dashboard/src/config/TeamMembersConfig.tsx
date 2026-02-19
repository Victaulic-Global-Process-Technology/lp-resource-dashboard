import { useState } from 'react';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { PersonRole } from '../types';

export function TeamMembersConfig() {
  const { teamMembers, updateMember, addMember, loading } = useTeamMembers();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({
    person_id: 0,
    person: '',
    full_name: '',
    role: PersonRole.Engineer as PersonRole,
    capacity_override_hours: 0,
  });

  // Compute total hours per person
  const personHours = useLiveQuery(async () => {
    const timesheets = await db.timesheets.toArray();
    const hoursMap = new Map<string, number>();

    for (const entry of timesheets) {
      const current = hoursMap.get(entry.full_name) ?? 0;
      hoursMap.set(entry.full_name, current + entry.hours);
    }

    return hoursMap;
  });

  const handleRoleChange = (personId: number, newRole: PersonRole) => {
    updateMember(personId, { role: newRole });
  };

  const handleCapacityChange = (personId: number, capacity: number) => {
    updateMember(personId, { capacity_override_hours: capacity });
  };

  const handleAddMember = async () => {
    if (!newMember.full_name) {
      alert('Full name is required');
      return;
    }

    // Generate a unique person_id (use timestamp + random)
    const personId = Date.now() + Math.floor(Math.random() * 1000);

    await addMember({
      ...newMember,
      person_id: personId,
      person: newMember.full_name.replace(/\s+/g, ''), // Username = no spaces
    });

    setNewMember({
      person_id: 0,
      person: '',
      full_name: '',
      role: PersonRole.Engineer,
      capacity_override_hours: 0,
    });
    setShowAddForm(false);
  };

  if (loading) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-[13px] font-medium px-4 py-2 rounded-md text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
        >
          {showAddForm ? 'Cancel' : 'Add Member'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-[var(--accent-light)] border border-[var(--border-default)] rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-[var(--text-primary)]">Add New Team Member</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={newMember.full_name}
                onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                placeholder="e.g., Justin Anderson"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                Role
              </label>
              <select
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value as PersonRole })}
                className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
              >
                <option value={PersonRole.Engineer}>Engineer</option>
                <option value={PersonRole.LabTechnician}>Lab Technician</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
                Capacity Override (0 = default)
              </label>
              <input
                type="number"
                value={newMember.capacity_override_hours}
                onChange={(e) => setNewMember({ ...newMember, capacity_override_hours: parseFloat(e.target.value) })}
                className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)]"
                min="0"
              />
            </div>
          </div>
          <button
            onClick={handleAddMember}
            className="text-[13px] font-medium px-4 py-2 rounded-md text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
          >
            Add Member
          </button>
        </div>
      )}

      <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
        <table className="min-w-full divide-y divide-[var(--border-default)]">
          <thead className="bg-[var(--bg-table-header)]">
            <tr>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Name
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Role
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Capacity Override (hrs)
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-[0.05em]">
                Total Hours (all time)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border-subtle)]">
            {teamMembers.map((member) => (
              <tr key={member.person_id} className="hover:bg-[var(--bg-table-hover)]">
                <td className="px-6 py-4 text-[13px] font-medium text-[var(--text-primary)]">
                  {member.full_name}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.person_id, e.target.value as PersonRole)}
                    className="text-[13px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                  >
                    <option value={PersonRole.Engineer}>Engineer</option>
                    <option value={PersonRole.LabTechnician}>Lab Technician</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={member.capacity_override_hours}
                    onChange={(e) => handleCapacityChange(member.person_id, parseFloat(e.target.value))}
                    className="w-24 text-[13px] px-2 py-1 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                    min="0"
                  />
                </td>
                <td className="px-6 py-4 text-[13px] text-[var(--text-secondary)]">
                  {personHours?.get(member.full_name)?.toFixed(1) ?? '0.0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {teamMembers.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          No team members found. Import CSV data to populate automatically,
          or add members manually.
        </div>
      )}
    </div>
  );
}
