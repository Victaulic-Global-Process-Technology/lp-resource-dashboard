import { useLiveQuery } from 'dexie-react-hooks';
import { db, SKILL_CATEGORIES } from "../db/database";
import { PersonRole } from '../types';
import type { SkillCategory } from "../types";
import { useState, useEffect, useMemo } from "react";
import { skillColor } from "../charts/ChartTheme";

const SCORE_LEGEND = [
  { score: 0, label: "No rating", short: "—" },
  { score: 1, label: "Basic awareness — requires supervision" },
  { score: 2, label: "Working knowledge — can complete tasks independently" },
  { score: 3, label: "Advanced — can solve complex problems" },
  { score: 4, label: "Expert — can mentor others / set standards" },
  { score: 5, label: "Recognized authority — defines best practices" },
];

function buttonStyle(score: number, isSelected: boolean): React.CSSProperties {
  const bg = skillColor(score);
  if (isSelected) {
    // Dark text on light backgrounds, white on dark
    const darkBgs = ["#4ade80", "#16a34a"];
    const color = darkBgs.includes(bg) ? "#fff" : "#000";
    return {
      backgroundColor: bg,
      color,
      borderColor: bg === "#f3f4f6" ? "#9ca3af" : bg,
      fontWeight: 700,
    };
  }
  return {
    backgroundColor: "#fff",
    color: "#9ca3af",
    borderColor: "#e5e7eb",
  };
}

export function SkillsMatrixConfig() {
  const [selectedEngineer, setSelectedEngineer] = useState("");
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState("");

  const teamMembers = useLiveQuery(() => db.teamMembers.toArray());
  const skills = useLiveQuery(() => db.skills.toArray());
  const skillCategories = useLiveQuery(() => db.skillCategories.toArray());

  // Initialize default skill categories if none exist
  useEffect(() => {
    if (skillCategories && skillCategories.length === 0) {
      const initSkills = async () => {
        let sortOrder = 0;
        for (const group of SKILL_CATEGORIES) {
          for (const name of group.skills) {
            await db.skillCategories.add({
              name,
              category: group.category,
              sort_order: sortOrder++,
            });
          }
        }
      };
      initSkills();
    }
  }, [skillCategories]);

  const engineers = useMemo(() => {
    if (!teamMembers) return [];
    return teamMembers
      .filter((m) => m.role === PersonRole.Engineer)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [teamMembers]);

  // Auto-select first engineer
  useEffect(() => {
    if (!selectedEngineer && engineers.length > 0) {
      setSelectedEngineer(engineers[0].full_name);
    }
  }, [engineers, selectedEngineer]);

  const sortedCategories = useMemo(() => {
    if (!skillCategories) return [];
    return [...skillCategories].sort((a, b) => a.sort_order - b.sort_order);
  }, [skillCategories]);

  const groupedSkills = useMemo(
    () => groupByCategory(sortedCategories),
    [sortedCategories],
  );

  // Build skills map for selected engineer
  const engineerSkills = useMemo(() => {
    if (!skills || !selectedEngineer) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const s of skills) {
      if (s.engineer === selectedEngineer) {
        map.set(s.skill, s.rating);
      }
    }
    return map;
  }, [skills, selectedEngineer]);

  const ratedCount = useMemo(() => {
    let count = 0;
    for (const r of engineerSkills.values()) {
      if (r > 0) count++;
    }
    return count;
  }, [engineerSkills]);

  if (!teamMembers || !skills || !skillCategories) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  if (engineers.length === 0) {
    return (
      <div className="space-y-5">
        <div className="bg-[var(--bg-table-header)] border border-[var(--border-default)] rounded-lg p-8 text-center">
          <p className="text-[var(--text-secondary)]">Import timesheet data first to populate team members.</p>
        </div>
      </div>
    );
  }

  const handleRatingClick = async (skillName: string, score: number) => {
    if (!selectedEngineer) return;
    const currentRating = engineerSkills.get(skillName) ?? 0;
    const newRating = currentRating === score ? 0 : score;

    const existing = skills.find(
      (s) => s.engineer === selectedEngineer && s.skill === skillName,
    );
    if (existing) {
      await db.skills.update(existing.id!, { rating: newRating });
    } else {
      await db.skills.add({
        engineer: selectedEngineer,
        skill: skillName,
        rating: newRating,
      });
    }
  };

  const handleClearEngineer = async () => {
    if (!selectedEngineer) return;
    if (!confirm(`Clear all skill ratings for ${selectedEngineer}?`)) return;
    const toDelete = skills
      .filter((s) => s.engineer === selectedEngineer)
      .map((s) => s.id!);
    if (toDelete.length === 0) return;
    await db.skills.bulkDelete(toDelete);
  };

  const handleAddSkill = async () => {
    if (!newSkillName.trim()) return;
    const category = newSkillCategory.trim() || "Uncategorized";

    const maxOrder = sortedCategories.length > 0
      ? Math.max(...sortedCategories.map(c => c.sort_order))
      : -1;

    await db.skillCategories.add({
      name: newSkillName.trim(),
      category,
      sort_order: maxOrder + 1,
    });

    setNewSkillName('');
    setNewSkillCategory("");
    setAddingSkill(false);
  };

  const handleRemoveSkill = async (skillName: string) => {
    if (
      !confirm(
        `Remove '${skillName}' skill? This will delete all ratings for this skill.`,
      )
    )
      return;
    const toDelete = skills.filter(s => s.skill === skillName).map(s => s.id!);
    await db.skills.bulkDelete(toDelete);
    await db.skillCategories.where('name').equals(skillName).delete();
  };

  const categoryNames = [
    ...new Set(sortedCategories.map((c) => c.category).filter(Boolean)),
  ];

  return (
    <div className="space-y-4">
      {/* Engineer selector + progress */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedEngineer}
          onChange={(e) => setSelectedEngineer(e.target.value)}
          className="text-[14px] px-3 py-1.5 border border-[var(--border-input)] rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] font-medium"
        >
          {engineers.map((e) => (
            <option key={e.person_id} value={e.full_name}>
              {e.full_name}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-[var(--text-muted)]">
          {ratedCount} of {sortedCategories.length} skills rated
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleClearEngineer}
            className="text-[11px] px-2 py-1 rounded border border-[var(--border-default)] hover:bg-red-50 transition-colors"
            style={{ color: "var(--status-danger)" }}
          >
            Clear all ratings
          </button>
        </div>
      </div>

      {/* Scoring legend */}
      <div className="flex flex-wrap items-center gap-3 p-2.5 bg-[var(--bg-table-header)] border border-[var(--border-default)] rounded-lg">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Legend
        </span>
        {SCORE_LEGEND.filter((l) => l.score > 0).map((item) => (
          <span key={item.score} className="inline-flex items-center gap-1">
            <span
              className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
              style={buttonStyle(item.score, true)}
            >
              {item.score}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              {item.label}
            </span>
          </span>
        ))}
      </div>

      {/* Skill categories with rating buttons */}
      <div
        className="overflow-y-auto space-y-5"
        style={{ maxHeight: "calc(100vh - 360px)" }}
      >
        {groupedSkills.map((group) => (
          <div key={group.category}>
            {/* Category header */}
            <div
              className="flex items-center gap-2 mb-2 pb-1.5"
              style={{ borderBottom: "2px solid var(--border-default)" }}
            >
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[#3b5998]">
                {group.category}
              </span>
              <span className="text-[11px] text-[var(--text-muted)]">
                ({group.skills.length})
              </span>
            </div>

            {/* Skill rows */}
            <div className="space-y-0">
              {group.skills.map((cat, idx) => {
                const rating = engineerSkills.get(cat.name) ?? 0;
                return (
                  <div
                    key={cat.name}
                    className="flex items-center gap-3 px-3 py-2 rounded group/skill"
                    style={{
                      backgroundColor:
                        idx % 2 === 0
                          ? "transparent"
                          : "var(--bg-table-header)",
                    }}
                  >
                    {/* Skill name */}
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] text-[var(--text-primary)]">
                        {cat.name}
                      </span>
                      <button
                        onClick={() => handleRemoveSkill(cat.name)}
                        className="opacity-0 group-hover/skill:opacity-100 transition-opacity ml-1.5 text-[12px] align-middle"
                        style={{ color: "var(--status-danger)" }}
                        title={`Remove "${cat.name}"`}
                      >
                        ×
                      </button>
                    </div>

                    {/* Rating buttons */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {[0, 1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          onClick={() => handleRatingClick(cat.name, score)}
                          className="w-7 h-7 rounded text-[11px] font-semibold border transition-all hover:ring-2 hover:ring-[var(--accent)] hover:ring-offset-1 cursor-pointer"
                          style={buttonStyle(score, rating === score)}
                          title={SCORE_LEGEND[score].label}
                        >
                          {score === 0 ? "—" : score}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Add skill section */}
        <div
          className="pt-3"
          style={{ borderTop: "2px solid var(--border-default)" }}
        >
          {addingSkill ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSkill()}
                placeholder="Skill name"
                className="px-2.5 py-1.5 text-[13px] border rounded-lg"
                style={{
                  borderColor: "var(--border-input)",
                  backgroundColor: "var(--bg-input)",
                }}
                autoFocus
              />
              <select
                value={newSkillCategory}
                onChange={(e) => setNewSkillCategory(e.target.value)}
                className="px-2 py-1.5 text-[12px] border rounded-lg"
                style={{
                  borderColor: "var(--border-input)",
                  backgroundColor: "var(--bg-input)",
                }}
              >
                <option value="">Category...</option>
                {categoryNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddSkill}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg"
                style={{ color: "#fff", backgroundColor: "var(--accent)" }}
              >
                Add skill
              </button>
              <button
                onClick={() => {
                  setAddingSkill(false);
                  setNewSkillName("");
                  setNewSkillCategory("");
                }}
                className="px-2 py-1.5 text-[12px] text-[var(--text-muted)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingSkill(true)}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-dashed border-[var(--border-default)] hover:bg-[var(--bg-table-header)] transition-colors"
              style={{ color: "var(--accent)" }}
            >
              + Add skill
            </button>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="text-[12px]" style={{ color: "var(--text-muted)" }}>
        {engineers.length} engineers &times; {sortedCategories.length} skills
        across {groupedSkills.length} categories
      </div>
    </div>
  );
}

/** Group skill categories by their parent category, preserving sort order. */
function groupByCategory(sortedCategories: SkillCategory[]): { category: string; skills: SkillCategory[] }[] {
  const groups: { category: string; skills: SkillCategory[] }[] = [];
  const seen = new Map<string, { category: string; skills: SkillCategory[] }>();

  for (const cat of sortedCategories) {
    const key = cat.category || 'Uncategorized';
    let group = seen.get(key);
    if (!group) {
      group = { category: key, skills: [] };
      seen.set(key, group);
      groups.push(group);
    }
    group.skills.push(cat);
  }

  return groups;
}
