import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilters } from '../context/ViewFilterContext';
import { ViewHeader } from '../dashboard/ViewHeader';
import { ExportConfigModal } from '../export/ExportConfigModal';
import { PanelWrapper } from '../dashboard/PanelWrapper';
import { PanelErrorBoundary } from '../dashboard/PanelErrorBoundary';
import { usePanelDataCheck } from '../hooks/usePanelDataCheck';
import { SkillHeatmapPanel } from '../dashboard/panels/SkillHeatmapPanel';
import { LabTechHoursPanel } from '../dashboard/panels/LabTechHoursPanel';
import { EngineerBreakdownPanel } from '../dashboard/panels/EngineerBreakdownPanel';
import { TechAffinityPanel } from '../dashboard/panels/TechAffinityPanel';
import { FocusScorePanel } from '../dashboard/panels/FocusScorePanel';
import { BusFactorPanel } from '../dashboard/panels/BusFactorPanel';
import { MeetingTaxPanel } from '../dashboard/panels/MeetingTaxPanel';
import { AllocationCompliancePanel } from '../dashboard/panels/AllocationCompliancePanel';

const FULL_WIDTH = 'lg:col-span-2';

const TEAM_CHART_PANELS = [
  'skill-heatmap',
  'lab-tech-hours',
  'engineer-breakdown',
  'tech-affinity',
  'focus-score',
  'bus-factor',
  'meeting-tax',
  'allocation-compliance',
];

export function TeamPage() {
  const navigate = useNavigate();
  const { selectedMonth } = useFilters();
  const [showExport, setShowExport] = useState(false);
  const showSkillHeatmap = usePanelDataCheck('skill-heatmap');
  const showTechAffinity = usePanelDataCheck('tech-affinity');
  const showAllocationCompliance = usePanelDataCheck('allocation-compliance');

  const handlePersonClick = (name: string) => {
    navigate(`/dashboard/engineer/${encodeURIComponent(name)}`);
  };

  return (
    <div>
      <ViewHeader title="Team Health" onExport={() => setShowExport(true)} />
      <ExportConfigModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        selectedMonth={selectedMonth ?? ''}
        viewName="Team Health"
        availablePanels={TEAM_CHART_PANELS}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {showSkillHeatmap && (
          <PanelWrapper id="skill-heatmap" title="Skill Heat Map" className={FULL_WIDTH}>
            <PanelErrorBoundary panelId="skill-heatmap">
              <SkillHeatmapPanel />
            </PanelErrorBoundary>
          </PanelWrapper>
        )}

        <PanelWrapper id="lab-tech-hours" title="Lab Tech Hours by Engineer">
          <PanelErrorBoundary panelId="lab-tech-hours">
            <LabTechHoursPanel onPersonClick={handlePersonClick} />
          </PanelErrorBoundary>
        </PanelWrapper>

        <PanelWrapper id="focus-score" title="Focus Score">
          <PanelErrorBoundary panelId="focus-score">
            <FocusScorePanel />
          </PanelErrorBoundary>
        </PanelWrapper>

        <PanelWrapper id="engineer-breakdown" title="Engineer Hour Breakdown" className={FULL_WIDTH}>
          <PanelErrorBoundary panelId="engineer-breakdown">
            <EngineerBreakdownPanel onPersonClick={handlePersonClick} />
          </PanelErrorBoundary>
        </PanelWrapper>

        {showTechAffinity && (
          <PanelWrapper id="tech-affinity" title="Tech Collaboration Affinity" className={FULL_WIDTH}>
            <PanelErrorBoundary panelId="tech-affinity">
              <TechAffinityPanel />
            </PanelErrorBoundary>
          </PanelWrapper>
        )}

        <PanelWrapper id="bus-factor" title="Knowledge Risk (Bus Factor)">
          <PanelErrorBoundary panelId="bus-factor">
            <BusFactorPanel onPersonClick={handlePersonClick} />
          </PanelErrorBoundary>
        </PanelWrapper>

        <PanelWrapper id="meeting-tax" title="Meeting & Admin Tax">
          <PanelErrorBoundary panelId="meeting-tax">
            <MeetingTaxPanel />
          </PanelErrorBoundary>
        </PanelWrapper>

        {showAllocationCompliance && (
          <PanelWrapper id="allocation-compliance" title="Allocation Compliance" className={FULL_WIDTH}>
            <PanelErrorBoundary panelId="allocation-compliance">
              <AllocationCompliancePanel />
            </PanelErrorBoundary>
          </PanelWrapper>
        )}
      </div>
    </div>
  );
}
