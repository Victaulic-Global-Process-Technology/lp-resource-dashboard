import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  KPI_REGISTRY,
  KPI_CATEGORIES,
  KPI_PRESETS,
  DEFAULT_KPI_CARDS,
} from '../aggregation/kpiRegistry';
import type { KPICardKey } from '../types';

export function KPICardsConfig() {
  const config = useLiveQuery(() => db.config.get(1));
  const [draggedKey, setDraggedKey] = useState<KPICardKey | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (!config) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[var(--border-subtle)] rounded-lg"></div>
        ))}
      </div>
    );
  }

  const selectedCards: KPICardKey[] = config.kpi_cards ?? DEFAULT_KPI_CARDS;

  const save = async (cards: KPICardKey[]) => {
    await db.config.update(1, { kpi_cards: cards });
  };

  // ── Toggle a card on/off ──
  const handleToggle = (key: KPICardKey) => {
    if (selectedCards.includes(key)) {
      save(selectedCards.filter(k => k !== key));
    } else {
      save([...selectedCards, key]);
    }
  };

  // ── Preset buttons ──
  const applyPreset = (presetId: string) => {
    const preset = KPI_PRESETS[presetId];
    if (preset) save([...preset.cards]);
  };

  // ── Drag-to-reorder within selected list ──
  const handleDragStart = (key: KPICardKey) => {
    setDraggedKey(key);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedKey === null) return;
    const fromIndex = selectedCards.indexOf(draggedKey);
    if (fromIndex === -1 || fromIndex === targetIndex) {
      setDraggedKey(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...selectedCards];
    reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, draggedKey);
    save(reordered);
    setDraggedKey(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedKey(null);
    setDragOverIndex(null);
  };

  // Group all KPIs by category for the picker
  const allKeys = Object.keys(KPI_REGISTRY) as KPICardKey[];

  return (
    <div className="space-y-6">
      {/* Presets */}
      <div>
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">Quick Presets</h3>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(KPI_PRESETS).map(([id, preset]) => {
            const isActive = preset.cards.length === selectedCards.length &&
              preset.cards.every((k, i) => selectedCards[i] === k);
            return (
              <button
                key={id}
                onClick={() => applyPreset(id)}
                className={`text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors ${
                  isActive
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            onClick={() => save([...DEFAULT_KPI_CARDS])}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[var(--border-input)] text-[var(--text-muted)] bg-white hover:bg-[var(--bg-table-header)] transition-colors"
          >
            Reset to Default
          </button>
        </div>
      </div>

      {/* Selected cards (reorderable) */}
      <div>
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-1">
          Active Cards ({selectedCards.length})
        </h3>
        <p className="text-[12px] text-[var(--text-muted)] mb-2">
          Drag to reorder. These cards appear on the dashboard KPI summary panel.
        </p>
        <div className="space-y-1">
          {selectedCards.map((key, index) => {
            const def = KPI_REGISTRY[key];
            if (!def) return null;
            return (
              <div
                key={key}
                draggable
                onDragStart={() => handleDragStart(key)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-colors ${
                  dragOverIndex === index
                    ? 'border-[var(--accent)] bg-blue-50'
                    : 'border-[var(--border-default)] bg-white'
                } ${draggedKey === key ? 'opacity-40' : ''}`}
              >
                <span className="cursor-grab text-[var(--text-muted)] select-none" style={{ fontSize: '16px' }}>
                  ⠿
                </span>
                <span className="text-[12px] font-medium text-[var(--text-muted)] w-5 text-right tabular-nums">
                  {index + 1}
                </span>
                <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1">
                  {def.label}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] px-1.5 py-0.5 bg-[var(--bg-table-header)] rounded">
                  {def.category}
                </span>
                <button
                  onClick={() => handleToggle(key)}
                  className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                >
                  Remove
                </button>
              </div>
            );
          })}
          {selectedCards.length === 0 && (
            <p className="text-[12px] text-[var(--text-muted)] italic py-4 text-center">
              No cards selected. Choose from the categories below or apply a preset.
            </p>
          )}
        </div>
      </div>

      {/* Available cards by category */}
      <div>
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">Available KPIs</h3>
        {KPI_CATEGORIES.map(cat => {
          const catKeys = allKeys.filter(k => KPI_REGISTRY[k].category === cat.id);
          return (
            <div key={cat.id} className="mb-4">
              <h4 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                {cat.label}
              </h4>
              <div className="space-y-1">
                {catKeys.map(key => {
                  const def = KPI_REGISTRY[key];
                  const isSelected = selectedCards.includes(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[var(--accent)] bg-blue-50/50'
                          : 'border-[var(--border-subtle)] bg-white hover:border-[var(--border-default)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(key)}
                        className="rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] font-medium text-[var(--text-primary)]">
                          {def.label}
                        </span>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                          {def.description}
                        </p>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                        {def.format}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
