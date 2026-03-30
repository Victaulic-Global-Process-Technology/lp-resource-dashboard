import { ImportPanel } from '../components/ImportPanel';
import { ImportStatus } from '../components/ImportStatus';
import { ConfigStatus } from '../components/ConfigStatus';
import { usePageTitle } from '../hooks/usePageTitle';

export function ImportPage() {
  usePageTitle('Import Data');
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">
        Import Data
      </h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-6">
        Upload LiquidPlanner timesheet exports, Microsoft Forms feedback exports, or dashboard configuration files.
      </p>

      <ImportPanel />

      <div className="mt-6 space-y-6">
        <ImportStatus />
        <ConfigStatus />
      </div>
    </div>
  );
}
