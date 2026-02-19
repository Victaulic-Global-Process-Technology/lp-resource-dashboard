import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useProjectSkillRequirements } from '../hooks/useProjectSkillRequirements';

interface ProjectSkillTagEditorProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SkillEntry {
  skill: string;
  enabled: boolean;
  weight: number;
}

export function ProjectSkillTagEditor({
  projectId,
  projectName,
  isOpen,
  onClose,
}: ProjectSkillTagEditorProps) {
  const skillCategories = useLiveQuery(() =>
    db.skillCategories.orderBy('sort_order').toArray()
  );
  const { requirements, setRequirements } = useProjectSkillRequirements(projectId);
  const [entries, setEntries] = useState<SkillEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Initialize entries when data loads or modal opens
  useEffect(() => {
    if (!skillCategories || !isOpen) return;

    const reqMap = new Map(requirements.map((r) => [r.skill, r.weight]));

    setEntries(
      skillCategories.map((cat) => ({
        skill: cat.name,
        enabled: reqMap.has(cat.name),
        weight: reqMap.get(cat.name) ?? 3,
      }))
    );
  }, [skillCategories, requirements, isOpen]);

  if (!isOpen) return null;

  const handleToggle = (skill: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.skill === skill ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const handleWeightChange = (skill: string, weight: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.skill === skill ? { ...e, weight } : e))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    const selected = entries
      .filter((e) => e.enabled)
      .map((e) => ({ skill: e.skill, weight: e.weight }));
    await setRequirements(projectId, selected);
    setSaving(false);
    onClose();
  };

  const enabledCount = entries.filter((e) => e.enabled).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-xl shadow-xl max-w-md w-full p-6 z-10">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            Required Skills
          </h3>
          <p className="text-[12px] text-[var(--text-muted)] mb-4">
            {projectId} — {projectName || 'Untitled'}
          </p>

          {/* Skill list */}
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.skill}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  entry.enabled
                    ? 'bg-[var(--accent-subtle,rgba(37,99,235,0.06))]'
                    : 'hover:bg-[var(--bg-table-hover)]'
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={() => handleToggle(entry.skill)}
                  className="w-4 h-4 rounded border-[var(--border-input)] accent-[var(--accent)]"
                />

                {/* Skill name */}
                <span
                  className={`flex-1 text-[13px] ${
                    entry.enabled
                      ? 'text-[var(--text-primary)] font-medium'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {entry.skill}
                </span>

                {/* Weight selector */}
                {entry.enabled && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-muted)]">Weight:</span>
                    <select
                      value={entry.weight}
                      onChange={(e) =>
                        handleWeightChange(entry.skill, parseInt(e.target.value))
                      }
                      className="text-[12px] px-1.5 py-0.5 border border-[var(--border-input)] rounded bg-[var(--bg-input)] text-[var(--text-primary)]"
                    >
                      {[1, 2, 3, 4, 5].map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--border-subtle)]">
            <span className="text-[12px] text-[var(--text-muted)]">
              {enabledCount} skill{enabledCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] bg-[var(--bg-table-header)] rounded-lg hover:bg-[var(--bg-table-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-[13px] font-medium text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
