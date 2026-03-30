import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePageTitle } from '../hooks/usePageTitle';
import { db } from '../db/database';
import { ViewHeader } from '../dashboard/ViewHeader';
import { PanelWrapper } from '../dashboard/PanelWrapper';
import { PanelErrorBoundary } from '../dashboard/PanelErrorBoundary';
import { KPISummaryPanel } from '../dashboard/panels/KPISummaryPanel';
import { NarrativeSummaryPanel } from '../dashboard/panels/NarrativeSummaryPanel';
import { AnomalyAlertsPanel } from '../dashboard/panels/AnomalyAlertsPanel';
import { KPITrendPanel } from '../dashboard/panels/KPITrendPanel';
import { usePanelDataCheck } from '../hooks/usePanelDataCheck';
import { useFilters } from '../context/ViewFilterContext';
import { ExportConfigModal } from '../export/ExportConfigModal';

export function OverviewPage() {
  usePageTitle('Overview');
  const showKpiTrends = usePanelDataCheck('kpi-trends');
  const { monthFilter } = useFilters();
  const config = useLiveQuery(() => db.config.get(1));
  const [showExport, setShowExport] = useState(false);

  const rangeLabel = config?.selected_date_range?.label;

  return (
    <div>
      <ViewHeader title="Overview" onExport={() => setShowExport(true)} />
      <ExportConfigModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        monthFilter={monthFilter ?? ''}
        rangeLabel={rangeLabel}
        viewName="Overview"
        exportContext={{ viewType: 'overview', rangeLabel }}
        availablePanels={['kpi-trends']}
      />
      <div className="flex flex-col gap-4">
        <PanelWrapper id="kpi-summary" title="KPI Summary Cards">
          <PanelErrorBoundary panelId="kpi-summary">
            <KPISummaryPanel />
          </PanelErrorBoundary>
        </PanelWrapper>

        <PanelWrapper id="narrative-summary" title="Monthly Narrative Summary">
          <PanelErrorBoundary panelId="narrative-summary">
            <NarrativeSummaryPanel />
          </PanelErrorBoundary>
        </PanelWrapper>

        <PanelWrapper id="anomaly-alerts" title="Alerts & Anomalies">
          <PanelErrorBoundary panelId="anomaly-alerts">
            <AnomalyAlertsPanel />
          </PanelErrorBoundary>
        </PanelWrapper>

        {showKpiTrends && (
          <PanelWrapper id="kpi-trends" title="KPI Trends">
            <PanelErrorBoundary panelId="kpi-trends">
              <KPITrendPanel />
            </PanelErrorBoundary>
          </PanelWrapper>
        )}
      </div>
    </div>
  );
}
