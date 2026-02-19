import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { NARRATIVE_OBSERVATIONS, DEFAULT_NARRATIVE_CONFIG } from '../aggregation/narrativeObservations';
import { generateNarrativeSummary } from '../aggregation/narrative';
import type { NarrativeConfig as NarrativeConfigType, NarrativeObservationKey } from '../types';

export function NarrativeConfigPanel() {
  const storedConfig = useLiveQuery(() => db.narrativeConfig.get(1));
  const dashConfig = useLiveQuery(() => db.config.get(1));
  const selectedMonth = dashConfig?.selected_month;
  const selectedProject = dashConfig?.selected_project || undefined;

  // Live preview — depends on storedConfig so it auto-updates on config changes
  const preview = useLiveQuery(async () => {
    if (!selectedMonth) return null;
    return await generateNarrativeSummary(selectedMonth, selectedProject);
  }, [selectedMonth, selectedProject, storedConfig]);

  const config: NarrativeConfigType = storedConfig ?? DEFAULT_NARRATIVE_CONFIG;

  const [openingDraft, setOpeningDraft] = useState<string | null>(null);
  const [closingDraft, setClosingDraft] = useState<string | null>(null);
  const [draggedKey, setDraggedKey] = useState<NarrativeObservationKey | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const save = async (updates: Partial<NarrativeConfigType>) => {
    await db.narrativeConfig.put({ ...config, ...updates });
  };

  // ── Observation toggle ──
  const handleToggle = (key: NarrativeObservationKey) => {
    save({
      observations: { ...config.observations, [key]: !config.observations[key] },
    });
  };

  // ── Drag-to-reorder ──
  const handleDragStart = (key: NarrativeObservationKey) => {
    setDraggedKey(key);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedKey === null) return;
    const list = [...config.observationPriority];
    const fromIndex = list.indexOf(draggedKey);
    if (fromIndex === -1 || fromIndex === targetIndex) {
      setDraggedKey(null);
      setDragOverIndex(null);
      return;
    }
    list.splice(fromIndex, 1);
    list.splice(targetIndex, 0, draggedKey);
    save({ observationPriority: list });
    setDraggedKey(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedKey(null);
    setDragOverIndex(null);
  };

  // ── Tone changes ──
  const handleToneToggle = (field: 'nameIndividuals' | 'includeSpecificNumbers' | 'includeTrendComparisons') => {
    save({ [field]: !config[field] });
  };

  // ── Max observations ──
  const handleMaxChange = (value: number) => {
    save({ maxObservations: value });
  };

  // ── Custom text (auto-save on blur) ──
  const handleOpeningBlur = () => {
    if (openingDraft !== null) {
      save({ customOpening: openingDraft });
      setOpeningDraft(null);
    }
  };

  const handleClosingBlur = () => {
    if (closingDraft !== null) {
      save({ customClosing: closingDraft });
      setClosingDraft(null);
    }
  };

  // Build the ordered observations list based on priority
  const orderedObservations = config.observationPriority.map(key => {
    const def = NARRATIVE_OBSERVATIONS.find(o => o.key === key)!;
    return { ...def, enabled: config.observations[key] };
  });

  return (
    <div className="space-y-8">
      {/* Section 1: Observation Selection & Priority */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Observations to Include
        </h3>
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">
          The summary highlights the top observations from the month. Enable the ones you want eligible and drag to set priority. Higher items are selected first when multiple trigger.
        </p>

        {/* Max observations dropdown */}
        <div className="flex items-center gap-3 mb-3">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">
            Max observations in summary:
          </label>
          <select
            value={config.maxObservations}
            onChange={(e) => handleMaxChange(parseInt(e.target.value))}
            className="text-[13px] px-2 py-1.5 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:outline-none"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>

        {/* Observation list */}
        <div className="space-y-1.5">
          {orderedObservations.map((obs, index) => (
            <div
              key={obs.key}
              draggable
              onDragStart={() => handleDragStart(obs.key)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg transition-colors ${
                dragOverIndex === index
                  ? 'border-[var(--accent)] bg-blue-50'
                  : obs.enabled
                    ? 'border-[var(--border-default)] bg-white'
                    : 'border-[var(--border-subtle)] opacity-50'
              } ${draggedKey === obs.key ? 'opacity-40' : ''}`}
            >
              {/* Drag handle */}
              <span className="cursor-grab text-[var(--text-muted)] select-none flex-shrink-0" style={{ fontSize: '16px' }}>
                ⠿
              </span>

              {/* Priority badge */}
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-[var(--bg-table-header)] text-[11px] font-bold text-[var(--text-muted)] flex-shrink-0">
                {index + 1}
              </span>

              {/* Toggle */}
              <input
                type="checkbox"
                checked={obs.enabled}
                onChange={() => handleToggle(obs.key)}
                className="w-4 h-4 rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)] flex-shrink-0"
              />

              {/* Label & template */}
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {obs.label}
                </span>
                <p className="text-[11px] italic text-[var(--text-muted)] mt-0.5">
                  &ldquo;{obs.teamTemplate}&rdquo;
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: Tone Controls */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Tone &amp; Language
        </h3>
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">
          Control the level of detail and specificity in the narrative.
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.nameIndividuals}
              onChange={() => handleToneToggle('nameIndividuals')}
              className="w-4 h-4 mt-0.5 rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
            />
            <div>
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Name individuals in summary</span>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                When off, names are replaced with &ldquo;one engineer&rdquo; or &ldquo;a team member.&rdquo;
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeSpecificNumbers}
              onChange={() => handleToneToggle('includeSpecificNumbers')}
              className="w-4 h-4 mt-0.5 rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
            />
            <div>
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Include specific numbers</span>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                When off, percentages and hours are replaced with relative language (&ldquo;above target&rdquo;, &ldquo;significantly&rdquo;).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeTrendComparisons}
              onChange={() => handleToneToggle('includeTrendComparisons')}
              className="w-4 h-4 mt-0.5 rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
            />
            <div>
              <span className="text-[13px] font-medium text-[var(--text-primary)]">Include trend comparisons (when multi-month data exists)</span>
              <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                Adds phrases like &ldquo;up from 8% last month&rdquo; or &ldquo;continuing a 3-month trend.&rdquo;
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Section 3: Custom Framing */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Custom Framing (optional)
        </h3>
        <p className="text-[12px] text-[var(--text-secondary)] mb-3">
          Add optional opening or closing sentences to the narrative.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
              Opening sentence
            </label>
            <textarea
              value={openingDraft ?? config.customOpening}
              onChange={(e) => setOpeningDraft(e.target.value)}
              onBlur={handleOpeningBlur}
              placeholder='e.g., "The team had a strong month with solid NPD progress across key programs."'
              rows={2}
              className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)] resize-none"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Added before the auto-generated summary. Leave blank to use only auto-generated text.
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
              Closing sentence
            </label>
            <textarea
              value={closingDraft ?? config.customClosing}
              onChange={(e) => setClosingDraft(e.target.value)}
              onBlur={handleClosingBlur}
              placeholder='e.g., "We expect February to normalize as holiday carry-over clears."'
              rows={2}
              className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)] resize-none"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Added after the auto-generated summary.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: Live Preview */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Preview
        </h3>

        <div className="border border-[var(--border-default)] rounded-lg p-4 bg-[var(--bg-table-header)]">
          {!selectedMonth ? (
            <p className="text-[13px] text-[var(--text-muted)] italic">
              Select a month on the dashboard to see a preview.
            </p>
          ) : !preview ? (
            <div className="animate-pulse h-16 bg-[var(--border-subtle)] rounded" />
          ) : (
            <div className="space-y-3">
              <p className="text-[14px] leading-relaxed text-[var(--text-primary)]">
                {preview.paragraph}
              </p>
              {preview.highlights.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {preview.highlights.map((h, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--accent-light)] text-[var(--accent)]"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedMonth && (
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            Uses data from {selectedMonth}. Changes apply immediately to the dashboard.
          </p>
        )}
      </section>
    </div>
  );
}
