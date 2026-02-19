import { useState } from 'react';
import { usePanelConfig, PANEL_CATEGORIES } from './hooks/usePanelConfig';
import type { PanelAvailability } from '../hooks/usePanelAvailability';

interface PanelToggleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availability?: PanelAvailability[];
}

function GripIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

export function PanelToggleDrawer({ isOpen, onClose, availability = [] }: PanelToggleDrawerProps) {
  const { panels, togglePanel, resetToDefaults, reorderPanels } = usePanelConfig();

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (!isOpen) return null;

  function toggleCategory(catId: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function handleDragStart(id: string) {
    setDraggedId(id);
    setDragOverId(null);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  }

  function handleDrop(targetId: string) {
    if (draggedId && draggedId !== targetId) {
      // Only reorder within the same category
      const draggedPanel = panels.find(p => p.id === draggedId);
      const targetPanel  = panels.find(p => p.id === targetId);
      if (draggedPanel && targetPanel && draggedPanel.category === targetPanel.category) {
        reorderPanels(draggedId, targetId);
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  const enabledCount = panels.filter(p => p.enabled).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 toggle-drawer"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[340px] shadow-2xl z-50 overflow-y-auto border-l bg-[var(--bg-panel)] border-[var(--border-default)] toggle-drawer">
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Customize Dashboard
            </h2>
            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-[12px] text-[var(--text-secondary)] mb-5">
            Toggle panels on or off and drag to reorder within each category.
          </p>

          {/* Category groups */}
          <div className="space-y-3 mb-6">
            {PANEL_CATEGORIES.map(category => {
              const categoryPanels = panels
                .filter(p => p.category === category.id)
                .sort((a, b) => a.order - b.order);

              const catEnabledCount = categoryPanels.filter(p => p.enabled).length;
              const isCollapsed = collapsedCategories.has(category.id);

              return (
                <div key={category.id} className="rounded-lg border border-[var(--border-default)] overflow-hidden">
                  {/* Category header */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-table-header)] hover:bg-[var(--bg-panel-hover,var(--bg-table-header))] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-150"
                        style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                        {category.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      {catEnabledCount}/{categoryPanels.length}
                    </span>
                  </button>

                  {/* Panel list */}
                  {!isCollapsed && (
                    <div className="divide-y divide-[var(--border-default)]">
                      {categoryPanels.map(panel => {
                        const isBeingDragged = draggedId === panel.id;
                        const isDropTarget   = dragOverId === panel.id;
                        const avail = availability.find(a => a.panelId === panel.id);
                        const isAvailable = avail?.available ?? true;

                        return (
                          <div
                            key={panel.id}
                            draggable={isAvailable}
                            onDragStart={() => isAvailable && handleDragStart(panel.id)}
                            onDragOver={e => handleDragOver(e, panel.id)}
                            onDrop={() => handleDrop(panel.id)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-2 px-3 py-2 transition-colors select-none"
                            style={{
                              opacity: isBeingDragged ? 0.4 : isAvailable ? 1 : 0.5,
                              borderTop: isDropTarget ? '2px solid var(--accent)' : '2px solid transparent',
                              backgroundColor: panel.enabled && isAvailable ? 'var(--bg-table-header)' : 'transparent',
                              cursor: 'default',
                            }}
                          >
                            {/* Drag handle */}
                            <span
                              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
                              style={{ cursor: isAvailable ? 'grab' : 'not-allowed' }}
                              title={isAvailable ? 'Drag to reorder' : avail?.reason}
                            >
                              <GripIcon />
                            </span>

                            {/* Label + unavailability reason */}
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">
                                {panel.label}
                              </span>
                              {!isAvailable && avail?.reason && (
                                <span className="block text-[11px] text-[var(--text-muted)] leading-tight truncate">
                                  {avail.reason}
                                </span>
                              )}
                            </div>

                            {/* Toggle */}
                            <button
                              type="button"
                              onClick={() => isAvailable && togglePanel(panel.id)}
                              disabled={!isAvailable}
                              className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out"
                              style={{
                                backgroundColor: !isAvailable ? '#e2e8f0' : panel.enabled ? 'var(--accent)' : '#cbd5e1',
                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                              }}
                              aria-label={`${panel.enabled ? 'Disable' : 'Enable'} ${panel.label}`}
                              title={!isAvailable ? avail?.reason : undefined}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-150 ease-in-out ${
                                  panel.enabled && isAvailable ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reset button */}
          <button
            onClick={resetToDefaults}
            className="w-full text-[13px] font-medium px-4 py-2 rounded-md border border-[var(--border-input)] text-[var(--text-secondary)] bg-white hover:bg-[var(--bg-table-header)] transition-colors"
          >
            Reset to Defaults
          </button>

          {/* Footer */}
          <div className="mt-5 pt-5 border-t border-[var(--border-default)]">
            <p className="text-[11px] text-[var(--text-muted)]">
              {enabledCount} of {panels.length} panels enabled
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
