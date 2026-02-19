import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { ANOMALY_RULES, getDefaultThresholdsForRule } from '../aggregation/anomalyRules';
import type { AnomalyThreshold } from '../types';

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  alert: { bg: '#fef2f2', text: '#dc2626' },
  warning: { bg: '#fffbeb', text: '#d97706' },
  info: { bg: '#eff6ff', text: '#2563eb' },
};

export function AlertRulesConfig() {
  const thresholds = useLiveQuery(() => db.anomalyThresholds.toArray());

  if (!thresholds) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-[var(--border-subtle)] rounded-lg"></div>
        ))}
      </div>
    );
  }

  const thresholdMap = new Map(thresholds.map(t => [t.ruleId, t]));

  const handleToggle = async (ruleId: string) => {
    const existing = thresholdMap.get(ruleId);
    const rule = ANOMALY_RULES.find(r => r.ruleId === ruleId)!;

    await db.anomalyThresholds.put({
      ruleId,
      enabled: existing ? !existing.enabled : !rule.defaultEnabled,
      severity: existing?.severity ?? rule.defaultSeverity,
      thresholds: existing?.thresholds ?? getDefaultThresholdsForRule(ruleId),
    });
  };

  const handleSeverityChange = async (ruleId: string, severity: AnomalyThreshold['severity']) => {
    const existing = thresholdMap.get(ruleId);
    const rule = ANOMALY_RULES.find(r => r.ruleId === ruleId)!;

    await db.anomalyThresholds.put({
      ruleId,
      enabled: existing?.enabled ?? rule.defaultEnabled,
      severity,
      thresholds: existing?.thresholds ?? getDefaultThresholdsForRule(ruleId),
    });
  };

  const handleThresholdChange = async (ruleId: string, paramKey: string, value: number) => {
    const existing = thresholdMap.get(ruleId);
    const rule = ANOMALY_RULES.find(r => r.ruleId === ruleId)!;

    const currentThresholds = existing?.thresholds ?? getDefaultThresholdsForRule(ruleId);

    await db.anomalyThresholds.put({
      ruleId,
      enabled: existing?.enabled ?? rule.defaultEnabled,
      severity: existing?.severity ?? rule.defaultSeverity,
      thresholds: { ...currentThresholds, [paramKey]: value },
    });
  };

  const handleResetRule = async (ruleId: string) => {
    const rule = ANOMALY_RULES.find(r => r.ruleId === ruleId)!;
    await db.anomalyThresholds.put({
      ruleId,
      enabled: rule.defaultEnabled,
      severity: rule.defaultSeverity,
      thresholds: getDefaultThresholdsForRule(ruleId),
    });
  };

  return (
    <div className="space-y-4">
      {ANOMALY_RULES.map(rule => {
        const stored = thresholdMap.get(rule.ruleId);
        const isEnabled = stored?.enabled ?? rule.defaultEnabled;
        const severity = stored?.severity ?? rule.defaultSeverity;
        const currentThresholds = stored?.thresholds ?? getDefaultThresholdsForRule(rule.ruleId);
        const severityColor = SEVERITY_COLORS[severity];

        return (
          <div
            key={rule.ruleId}
            className={`border rounded-lg overflow-hidden transition-opacity ${
              isEnabled ? 'border-[var(--border-default)]' : 'border-[var(--border-subtle)] opacity-60'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-table-header)]">
              <label className="flex items-center gap-2 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => handleToggle(rule.ruleId)}
                  className="w-4 h-4 rounded border-[var(--border-input)] text-[var(--accent)] focus:ring-[var(--accent-focus-ring)]"
                />
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {rule.name}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] font-normal">
                  ({rule.category})
                </span>
              </label>

              <select
                value={severity}
                onChange={(e) => handleSeverityChange(rule.ruleId, e.target.value as AnomalyThreshold['severity'])}
                disabled={!isEnabled}
                className="text-[11px] font-semibold px-2 py-1 rounded-full border-0 cursor-pointer"
                style={{
                  backgroundColor: isEnabled ? severityColor.bg : 'var(--border-subtle)',
                  color: isEnabled ? severityColor.text : 'var(--text-muted)',
                }}
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="alert">alert</option>
              </select>
            </div>

            {/* Body */}
            {isEnabled && (
              <div className="px-4 py-3 space-y-3">
                <p className="text-[13px] text-[var(--text-secondary)]">
                  {rule.description}
                </p>

                {/* Rationale */}
                <div className="border-l-2 border-[var(--accent)] pl-3 py-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Why this matters
                  </p>
                  <p className="text-[12px] text-[var(--text-secondary)] italic">
                    {rule.rationale}
                  </p>
                </div>

                {/* Parameters */}
                {rule.parameters.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {rule.parameters.map(param => {
                      const value = currentThresholds[param.key] ?? param.defaultValue;
                      const isModified = value !== param.defaultValue;

                      return (
                        <div key={param.key} className="flex items-start gap-4">
                          <div className="flex-1">
                            <label className="text-[13px] font-medium text-[var(--text-primary)]">
                              {param.label}
                              {isModified && (
                                <span className="ml-1.5 text-[10px] text-[var(--accent)] font-normal">
                                  (modified)
                                </span>
                              )}
                            </label>
                            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                              {param.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <input
                              type="number"
                              value={value}
                              min={param.min}
                              max={param.max}
                              step={param.step}
                              onChange={(e) => {
                                const num = parseFloat(e.target.value);
                                if (!isNaN(num) && num >= param.min && num <= param.max) {
                                  handleThresholdChange(rule.ruleId, param.key, num);
                                }
                              }}
                              className="w-20 px-2 py-1.5 text-[13px] border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:outline-none tabular-nums text-right"
                            />
                            {param.unit && (
                              <span className="text-[11px] text-[var(--text-muted)] w-12">
                                {param.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reset link */}
                <div className="pt-1">
                  <button
                    onClick={() => handleResetRule(rule.ruleId)}
                    className="text-[11px] text-[var(--accent)] hover:underline"
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
