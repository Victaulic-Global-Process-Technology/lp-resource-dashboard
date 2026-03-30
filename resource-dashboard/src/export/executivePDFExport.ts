import { db } from '../db/database';
import { computeAllKPIs } from '../aggregation/kpiEngine';
import { generateNarrativeSummary } from '../aggregation/narrative';
import { computeAnomalies } from '../aggregation/anomalies';
import { KPI_REGISTRY, formatKPIValue, getKPIColor } from '../aggregation/kpiRegistry';
import { DEFAULT_KPI_CARDS } from '../aggregation/kpiRegistry';
import { generateExecutivePDF } from './pdfGenerator';
import { captureChartForExport } from './chartCapture';
import { formatExportDate, formatMonthFilterLabel, formatMonthFilterFilename } from './exportUtils';
import type { KPICardKey, PDFExportSections } from '../types';
import type { MonthFilter } from '../utils/monthRange';
import { resolveMonths } from '../utils/monthRange';

// Panel ID → display title mapping
const PANEL_TITLES: Record<string, string> = {
  'kpi-summary': 'KPI Summary Cards',
  'narrative-summary': 'Monthly Narrative Summary',
  'anomaly-alerts': 'Alerts & Anomalies',
  'planned-vs-actual': 'Planned vs Actual (NPD/Sustaining)',
  'firefighting-trend': 'Firefighting (Unplanned) Hours',
  'utilization-heatmap': 'Planned Utilization Heatmap',
  'npd-project-comp': 'NPD Projects: Planned vs Actual',
  'milestone-timeline': 'NPD Milestones',
  'project-timeline': 'Selected Project Timeline',
  'skill-heatmap': 'Skill Heat Map',
  'lab-tech-hours': 'Lab Tech Hours by Engineer',
  'engineer-breakdown': 'Engineer Hour Breakdown',
  'tech-affinity': 'Engineer-Tech Collaboration',
  'focus-score': 'Focus Score',
  'bus-factor': 'Knowledge Risk (Bus Factor)',
  'meeting-tax': 'Meeting & Admin Tax',
  'allocation-compliance': 'Allocation Compliance',
  'kpi-trends': 'KPI Trends',
  'work-category-pie': 'Work Category Split',
  'discipline-donut': 'Hours by Discipline',
  'capacity-forecast': 'Team Utilization / Capacity Forecast',
  'what-if-planner': 'What-If Scenario Planner',
  // Engineer panels
  'hours-by-activity': 'Hours by Activity',
  'work-mix': 'NPD / Sustaining / Sprint Split',
  'utilization-trend': 'Planned Utilization Trend',
  'project-portfolio': 'Project Portfolio',
  'allocation-compliance-engineer': 'Allocation Compliance',
  'firefighting-trend-engineer': 'Firefighting Hours',
  'anomaly-alerts-engineer': 'Alerts & Anomalies',
  'skill-heatmap-engineer': 'Skills',
  'tech-affinity-engineer': 'Lab Tech Collaboration',
};

function getPanelTitle(panelId: string): string {
  return PANEL_TITLES[panelId] ?? panelId;
}

export interface ExportContext {
  viewType: 'overview' | 'team' | 'planning' | 'engineer';
  engineerName?: string;
  rangeLabel?: string;
}

export async function exportExecutivePDF(
  monthFilter: MonthFilter,
  projectFilter: string | undefined,
  sections: PDFExportSections,
  onProgress?: (step: string, current: number, total: number) => void,
  context?: ExportContext
): Promise<void> {
  const totalSteps = 2 + sections.chartPanels.length;
  let step = 0;

  const config = await db.config.get(1);
  const rangeLabel = context?.rangeLabel;
  const monthLabel = formatMonthFilterLabel(monthFilter, rangeLabel);

  // 1. Gather KPI data
  onProgress?.('Computing KPIs...', ++step, totalSteps);
  const kpiResults = await computeAllKPIs(monthFilter, projectFilter, context?.engineerName);
  const kpiCards = buildKPICardData(kpiResults, config?.kpi_cards, projectFilter);

  // 2. Gather narrative
  onProgress?.('Generating narrative...', ++step, totalSteps);
  const narrative = await generateNarrativeSummary(monthFilter, projectFilter, context?.engineerName);

  // 3. Gather alerts (if selected)
  let alerts: { title: string; detail: string; severity: 'alert' | 'warning' | 'info' }[] = [];
  if (sections.includeAlerts) {
    const anomalies = await computeAnomalies(monthFilter, projectFilter);
    alerts = anomalies.slice(0, 8).map(a => ({
      title: a.title,
      detail: a.detail,
      severity: a.severity,
    }));
  }

  // 4. Capture charts
  const chartImages: { panelId: string; title: string; dataUrl: string; aspectRatio: number }[] = [];
  for (const panelId of sections.chartPanels) {
    onProgress?.(`Capturing ${getPanelTitle(panelId)}...`, ++step, totalSteps);
    const img = await captureChartForExport(panelId, getPanelTitle(panelId));
    if (img) chartImages.push(img);
  }

  // 5. Build PDF title based on context
  const months = resolveMonths(monthFilter);
  let reportTitle = 'Monthly Resource Report';
  if (months.length > 1) reportTitle = 'Resource Report';
  if (context?.viewType === 'engineer' && context.engineerName) {
    reportTitle = `Engineer Report: ${context.engineerName}`;
  }

  // 6. Generate PDF
  onProgress?.('Building PDF...', step, totalSteps);
  const doc = await generateExecutivePDF({
    teamName: config?.team_name || 'Engineering',
    month: months[months.length - 1],
    monthLabel,
    generatedDate: formatExportDate(new Date()),
    includeKPISummary: sections.includeKPISummary,
    includeNarrative: sections.includeNarrative,
    includeAlerts: sections.includeAlerts,
    includeCharts: sections.chartPanels,
    kpiCards,
    narrativeText: narrative?.paragraph ?? '',
    narrativeHighlights: narrative?.highlights ?? [],
    alerts,
    chartImages,
    reportTitle,
  });

  // 7. Download
  const fileDatePart = formatMonthFilterFilename(monthFilter, rangeLabel);
  let filename: string;
  if (context?.viewType === 'engineer' && context.engineerName) {
    const safeName = context.engineerName.replace(/[^a-zA-Z0-9]/g, '_');
    filename = `Engineer_Report_${safeName}_${fileDatePart}.pdf`;
  } else {
    filename = `Resource_Report_${fileDatePart}.pdf`;
  }
  doc.save(filename);
}

function buildKPICardData(
  kpiResults: Awaited<ReturnType<typeof computeAllKPIs>>,
  configCards: KPICardKey[] | undefined,
  projectFilter: string | undefined
): { label: string; value: string; color: 'green' | 'yellow' | 'red' | 'neutral' }[] {
  const selectedCards = configCards ?? DEFAULT_KPI_CARDS;

  // When project is selected, only show applicable KPIs
  const visibleCards = projectFilter
    ? selectedCards.filter(k => KPI_REGISTRY[k]?.applicableToSingleProject)
    : selectedCards;

  return visibleCards.map(key => {
    const def = KPI_REGISTRY[key];
    if (!def) return { label: key, value: '—', color: 'neutral' as const };

    const rawValue = def.getValue(kpiResults);
    const displayValue = formatKPIValue(rawValue, def.format);
    const color = getKPIColor(rawValue, def.thresholds);

    // Add unit suffix for display
    let valueWithUnit = displayValue;
    if (def.format === 'percent') valueWithUnit += '%';
    if (def.format === 'hours') valueWithUnit += 'h';

    return {
      label: def.label,
      value: valueWithUnit,
      color,
    };
  });
}
