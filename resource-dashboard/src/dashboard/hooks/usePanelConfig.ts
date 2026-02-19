import { useCallback, useSyncExternalStore } from 'react';

export interface PanelConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  category: string;
}

export interface PanelCategory {
  id: string;
  label: string;
}

export const PANEL_CATEGORIES: PanelCategory[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'hours-planning', label: 'Hours & Planning' },
  { id: 'projects', label: 'Projects & Milestones' },
  { id: 'team', label: 'Team & Collaboration' },
  { id: 'insights', label: 'Insights & Risk' },
];

const DEFAULT_PANEL_CONFIG: PanelConfig[] = [
  { id: 'kpi-summary',           label: 'KPI Summary Cards',                    enabled: true,  order: 0,  category: 'overview' },
  { id: 'narrative-summary',     label: 'Monthly Narrative Summary',             enabled: true,  order: 1,  category: 'overview' },
  { id: 'anomaly-alerts',        label: 'Alerts & Anomalies',                   enabled: true,  order: 2,  category: 'overview' },
  { id: 'kpi-trends',            label: 'KPI Trends',                           enabled: true,  order: 3,  category: 'overview' },
  { id: 'planned-vs-actual',     label: 'Planned vs Actual (NPD/Sustaining)',   enabled: true,  order: 4,  category: 'hours-planning' },
  { id: 'firefighting-trend',    label: 'Firefighting (Unplanned) Hours',       enabled: true,  order: 5,  category: 'hours-planning' },
  { id: 'utilization-heatmap',   label: 'Planned Utilization Heatmap',          enabled: true,  order: 6,  category: 'hours-planning' },
  { id: 'capacity-forecast',     label: 'Capacity Forecast',                    enabled: true,  order: 7,  category: 'hours-planning' },
  { id: 'npd-project-comp',      label: 'NPD Projects: Planned vs Actual',      enabled: true,  order: 8,  category: 'hours-planning' },
  { id: 'milestone-timeline',    label: 'NPD Milestones',                       enabled: true,  order: 9,  category: 'projects' },
  { id: 'project-timeline',      label: 'Selected Project Timeline',            enabled: false, order: 10, category: 'projects' },
  { id: 'skill-heatmap',         label: 'Skill Heat Map',                       enabled: true,  order: 11, category: 'team' },
  { id: 'lab-tech-hours',        label: 'Lab Tech Hours by Engineer',           enabled: true,  order: 12, category: 'team' },
  { id: 'engineer-breakdown',    label: 'Engineer Hour Breakdown',              enabled: false, order: 13, category: 'team' },
  { id: 'tech-affinity',         label: 'Engineer ↔ Tech Collaboration',        enabled: false, order: 14, category: 'team' },
  { id: 'focus-score',           label: 'Focus Score',                          enabled: true,  order: 15, category: 'insights' },
  { id: 'bus-factor',            label: 'Knowledge Risk (Bus Factor)',           enabled: true,  order: 16, category: 'insights' },
  { id: 'meeting-tax',           label: 'Meeting & Admin Tax',                  enabled: false, order: 17, category: 'insights' },
  { id: 'allocation-compliance', label: 'Allocation Compliance',                enabled: false, order: 18, category: 'insights' },
];

const STORAGE_KEY = 'dashboard-panel-config';
const STORAGE_VERSION_KEY = 'dashboard-panel-config-version';
// Bump this whenever DEFAULT_PANEL_CONFIG changes to invalidate stale configs.
const CURRENT_VERSION = 6;

// ── Shared store so every usePanelConfig() hook reads the same state ──

let listeners: Array<() => void> = [];
let currentPanels: PanelConfig[] = loadFromStorage();

function loadFromStorage(): PanelConfig[] {
  try {
    const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    const stored = localStorage.getItem(STORAGE_KEY);

    // If stored version doesn't match current, discard stale config
    if (!storedVersion || parseInt(storedVersion, 10) < CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
      return [...DEFAULT_PANEL_CONFIG];
    }

    if (stored) {
      const parsed: PanelConfig[] = JSON.parse(stored);
      // Merge with defaults to pick up any newly added panels
      const storedIds = new Set(parsed.map(p => p.id));
      const merged = [
        ...parsed,
        ...DEFAULT_PANEL_CONFIG.filter(d => !storedIds.has(d.id)),
      ];
      return merged;
    }
  } catch {
    // Fall through to defaults
  }
  localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
  return [...DEFAULT_PANEL_CONFIG];
}

function saveAndNotify(next: PanelConfig[]) {
  currentPanels = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
  // Notify all subscribers
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function getSnapshot(): PanelConfig[] {
  return currentPanels;
}

// ── Public hook ──

export function usePanelConfig() {
  const panels = useSyncExternalStore(subscribe, getSnapshot);

  const togglePanel = useCallback((id: string) => {
    const next = currentPanels.map(p =>
      p.id === id ? { ...p, enabled: !p.enabled } : p
    );
    saveAndNotify(next);
  }, []);

  const isPanelEnabled = useCallback((id: string): boolean => {
    return panels.find(p => p.id === id)?.enabled ?? false;
  }, [panels]);

  const resetToDefaults = useCallback(() => {
    saveAndNotify([...DEFAULT_PANEL_CONFIG]);
  }, []);

  const reorderPanels = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const arr = [...currentPanels];
    const fromIdx = arr.findIndex(p => p.id === draggedId);
    const toIdx = arr.findIndex(p => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [item] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, item);
    const reindexed = arr.map((p, i) => ({ ...p, order: i }));
    saveAndNotify(reindexed);
  }, []);

  return {
    panels,
    togglePanel,
    isPanelEnabled,
    resetToDefaults,
    reorderPanels,
  };
}
