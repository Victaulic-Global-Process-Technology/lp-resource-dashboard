import { useState } from 'react';
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
  const showKpiTrends = usePanelDataCheck('kpi-trends');
  const { selectedMonth } = useFilters();
  const [showExport, setShowExport] = useState(false);

  return (
    <div>
      <ViewHeader title="Overview" onExport={() => setShowExport(true)} />
      <ExportConfigModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        selectedMonth={selectedMonth ?? ''}
        viewName="Overview"
        availablePanels={[]}
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
