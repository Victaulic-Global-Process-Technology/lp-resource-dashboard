import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { PersonRole } from '../types';
import { useState, useEffect } from 'react';

const DEFAULT_SKILLS = [
  'FEA',
  'CFD',
  'Deflector development',
  'VicFlex hose',
  'VicFlex bracket',
  'Vortex design',
  'Vortex operation',
  'Data acquisition',
  'Fire test protocols',
  'Failure / root cause analysis',
  'Statistical analysis',
  'Test fixture design',
  'Codes and standards',
  'Tolerance stackup',
];

export function SkillsMatrixConfig() {
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');

  const teamMembers = useLiveQuery(() => db.teamMembers.toArray());
  const skills = useLiveQuery(() => db.skills.toArray());
  const skillCategories = useLiveQuery(() => db.skillCategories.toArray());

  // Initialize default skill categories if none exist
  useEffect(() => {
    if (skillCategories && skillCategories.length === 0) {
      const initSkills = async () => {
        for (let i = 0; i < DEFAULT_SKILLS.length; i++) {
          await db.skillCategories.add({
            name: DEFAULT_SKILLS[i],
            sort_order: i,
          });
        }
      };
      initSkills();
    }
  }, [skillCategories]);

  if (!teamMembers || !skills || !skillCategories) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  const engineers = teamMembers
    .filter(m => m.role === PersonRole.Engineer)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  if (engineers.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-[var(--bg-table-header)] border border-[var(--border-default)] rounded-lg p-8 text-center">
          <p className="text-[var(--text-secondary)]">Import timesheet data first to populate team members.</p>
        </div>
      </div>
    );
  }

  const sortedCategories = skillCategories.sort((a, b) => a.sort_order - b.sort_order);

  // Build skills map
  const skillsMap = new Map<string, number>();
  skills.forEach(s => {
    skillsMap.set(`${s.engineer}|${s.skill}`, s.rating);
  });

  const handleCellClick = async (engineer: string, skillName: string) => {
    const currentRating = skillsMap.get(`${engineer}|${skillName}`) || 0;
    const newRating = (currentRating + 1) % 6; // Cycle 0→1→2→3→4→5→0

    const existing = skills.find(s => s.engineer === engineer && s.skill === skillName);
    if (existing) {
      await db.skills.update(existing.id!, { rating: newRating });
    } else {
      await db.skills.add({
        engineer,
        skill: skillName,
        rating: newRating,
      });
    }
  };

  const getRatingColor = (rating: number): string => {
    switch (rating) {
      case 0: return 'bg-[var(--bg-table-header)] text-[var(--text-muted)]';
      case 1: return 'bg-amber-100 text-amber-800';
      case 2: return 'bg-amber-200 text-amber-900';
      case 3: return 'bg-green-100 text-green-800';
      case 4: return 'bg-green-300 text-green-900';
      case 5: return 'bg-green-600 text-white';
      default: return 'bg-[var(--bg-table-header)] text-[var(--text-muted)]';
    }
  };

  const getRatingDisplay = (rating: number): string => {
    return rating === 0 ? '—' : rating.toString();
  };

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;

    const maxOrder = sortedCategories.length > 0
      ? Math.max(...sortedCategories.map(c => c.sort_order))
      : -1;

    await db.skillCategories.add({
      name: newSkillName.trim(),
      sort_order: maxOrder + 1,
    });

    for (const engineer of engineers) {
      await db.skills.add({
        engineer: engineer.full_name,
        skill: newSkillName.trim(),
        rating: 0,
      });
    }

    setNewSkillName('');
    setAddingSkill(false);
  };

  const handleClearEngineer = async (engineerName: string) => {
    const toDelete = skills.filter(s => s.engineer === engineerName).map(s => s.id!);
    if (toDelete.length === 0) return;
    await db.skills.bulkDelete(toDelete);
  };

  const handleRemoveSkill = async (skillName: string) => {
    if (!confirm(`Remove '${skillName}' skill? This will delete all ratings for this skill.`)) {
      return;
    }

    const toDelete = skills.filter(s => s.skill === skillName).map(s => s.id!);
    await db.skills.bulkDelete(toDelete);
    await db.skillCategories.where('name').equals(skillName).delete();
  };

  return (
    <div className="space-y-4">
      {/* Scrollable table container */}
      <div
        className="overflow-auto border border-[var(--border-default)] rounded-lg"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {/* Frozen engineer column header */}
              <th
                className="sticky left-0 z-30 border-b-2 border-r px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.05em]"
                style={{
                  backgroundColor: 'var(--bg-table-header)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-muted)',
                  minWidth: 140,
                }}
              >
                Engineer
              </th>
              {/* Horizontal skill column headers — text wraps naturally */}
              {sortedCategories.map(category => (
                <th
                  key={category.name}
                  className="border-b-2 px-2 py-2 text-center text-[11px] font-medium group"
                  style={{
                    backgroundColor: 'var(--bg-table-header)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-secondary)',
                    minWidth: 80,
                    position: 'relative',
                  }}
                >
                  {category.name}
                  <button
                    onClick={() => handleRemoveSkill(category.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      fontSize: 13,
                      lineHeight: 1,
                      padding: '0 2px',
                      color: 'var(--status-danger)',
                    }}
                    title={`Remove "${category.name}"`}
                  >
                    ×
                  </button>
                </th>
              ))}
              {/* Add skill column */}
              <th
                className="border-b-2 px-2 py-2 text-center"
                style={{
                  backgroundColor: 'var(--bg-table-header)',
                  borderColor: 'var(--border-default)',
                  minWidth: 56,
                }}
              >
                {addingSkill ? (
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                    onBlur={handleAddSkill}
                    placeholder="Skill name"
                    className="w-24 px-1.5 py-0.5 text-[11px] border rounded"
                    style={{
                      borderColor: 'var(--border-input)',
                      backgroundColor: 'var(--bg-input)',
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setAddingSkill(true)}
                    style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}
                    title="Add skill column"
                  >
                    + Add
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {engineers.map((engineer, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? '#ffffff' : 'var(--bg-table-header)';
              return (
                <tr key={engineer.person_id}>
                  {/* Frozen engineer name cell */}
                  <td
                    className="sticky left-0 z-10 border-r border-b whitespace-nowrap text-[13px] font-medium group/row"
                    style={{
                      backgroundColor: rowBg,
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-primary)',
                      padding: '4px 12px',
                      boxShadow: '2px 0 4px -2px rgba(0,0,0,0.08)',
                    }}
                  >
                    <span className="flex items-center gap-1">
                      {engineer.full_name}
                      <button
                        onClick={() => handleClearEngineer(engineer.full_name)}
                        className="opacity-0 group-hover/row:opacity-100 transition-opacity ml-auto text-[11px] px-1.5 py-0.5 rounded hover:bg-red-50"
                        style={{ color: 'var(--status-danger)' }}
                        title={`Clear all skills for ${engineer.full_name}`}
                      >
                        Clear
                      </button>
                    </span>
                  </td>
                  {/* Rating cells */}
                  {sortedCategories.map(category => {
                    const rating = skillsMap.get(`${engineer.full_name}|${category.name}`) || 0;
                    return (
                      <td
                        key={category.name}
                        className="border-b text-center"
                        style={{
                          borderColor: 'var(--border-subtle)',
                          padding: '3px 4px',
                          backgroundColor: rowBg,
                        }}
                      >
                        <button
                          onClick={() => handleCellClick(engineer.full_name, category.name)}
                          className={`
                            w-10 h-7 rounded text-xs font-semibold
                            ${getRatingColor(rating)}
                            hover:ring-2 hover:ring-[var(--accent)] hover:ring-offset-1
                            transition-all cursor-pointer
                          `}
                        >
                          {getRatingDisplay(rating)}
                        </button>
                      </td>
                    );
                  })}
                  <td
                    className="border-b"
                    style={{ borderColor: 'var(--border-subtle)', padding: '3px 4px', backgroundColor: rowBg }}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend footer */}
      <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--text-muted)' }}>
        <p>{engineers.length} engineers × {sortedCategories.length} skills</p>
        <div className="flex items-center gap-3">
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Rating:</span>
          {[0, 1, 2, 3, 4, 5].map(rating => (
            <div
              key={rating}
              className={`w-7 h-5 rounded flex items-center justify-center text-[10px] font-semibold ${getRatingColor(rating)}`}
            >
              {getRatingDisplay(rating)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
