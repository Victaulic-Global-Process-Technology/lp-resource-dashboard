import { ImportPanel } from '../components/ImportPanel';
import { ImportStatus } from '../components/ImportStatus';

export function ImportPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-[var(--text-primary)] mb-1">
        Import Data
      </h1>
      <p className="text-[13px] text-[var(--text-muted)] mb-6">
        Upload LiquidPlanner timesheet exports or Microsoft Forms feedback exports.
      </p>

      <ImportPanel />

      <div className="mt-6">
        <ImportStatus />
      </div>
    </div>
  );
}
