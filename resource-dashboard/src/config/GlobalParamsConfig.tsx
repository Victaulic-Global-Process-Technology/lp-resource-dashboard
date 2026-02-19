import { useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { refreshKPIHistory } from '../aggregation/kpiHistory';

export function GlobalParamsConfig() {
  const { config, updateConfig, loading } = useConfig();
  const [saveMessage, setSaveMessage] = useState('');

  const handleChange = async (field: string, value: string | number) => {
    try {
      await updateConfig({ [field]: value });
      // Capacity changes affect KPI calculations — refresh history
      if (field === 'std_monthly_capacity_hours' || field === 'over_utilization_threshold_pct') {
        refreshKPIHistory();
      }
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error('Failed to save:', error);
      setSaveMessage('Error saving');
    }
  };

  if (loading || !config) {
    return <div className="p-4 text-[var(--text-muted)]">Loading...</div>;
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
          Team Name
        </label>
        <input
          type="text"
          value={config.team_name}
          onChange={(e) => handleChange('team_name', e.target.value)}
          onBlur={(e) => handleChange('team_name', e.target.value)}
          className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)]"
          placeholder="e.g., ENG_Fire Suppression"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
          Auto-filled from first CSV import
        </p>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
          Standard Monthly Capacity (hours)
        </label>
        <input
          type="number"
          value={config.std_monthly_capacity_hours}
          onChange={(e) => handleChange('std_monthly_capacity_hours', parseFloat(e.target.value))}
          onBlur={(e) => handleChange('std_monthly_capacity_hours', parseFloat(e.target.value))}
          className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)]"
          min="0"
          step="1"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
          Base working hours per person per month (used to calculate utilization)
        </p>
      </div>

      <div>
        <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
          Over-Utilization Threshold (%)
        </label>
        <input
          type="number"
          value={config.over_utilization_threshold_pct * 100}
          onChange={(e) => handleChange('over_utilization_threshold_pct', parseFloat(e.target.value) / 100)}
          onBlur={(e) => handleChange('over_utilization_threshold_pct', parseFloat(e.target.value) / 100)}
          className="w-full text-[13px] px-3 py-2 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-focus-ring)]"
          min="0"
          step="1"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
          Engineers above this percentage are flagged as over-utilized
        </p>
      </div>

      {saveMessage && (
        <div className={`text-sm font-medium ${saveMessage === 'Saved' ? 'text-[var(--status-good)]' : 'text-[var(--status-danger)]'}`}>
          {saveMessage}
        </div>
      )}
    </div>
  );
}
