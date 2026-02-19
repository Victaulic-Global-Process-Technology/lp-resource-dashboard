import { db } from '../db/database';
import { computeAllKPIs } from '../aggregation/kpiEngine';
import { generateNarrativeSummary } from '../aggregation/narrative';
import { computeAnomalies } from '../aggregation/anomalies';
import { KPI_REGISTRY, formatKPIValue, getKPIColor } from '../aggregation/kpiRegistry';
import { DEFAULT_KPI_CARDS } from '../aggregation/kpiRegistry';
import { generateExecutivePDF } from './pdfGenerator';
import { captureChartForExport } from './chartCapture';
import { formatExportDate, formatMonthLabel } from './exportUtils';
import type { KPICardKey, PDFExportSections } from '../types';

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
};

function getPanelTitle(panelId: string): string {
  return PANEL_TITLES[panelId] ?? panelId;
}

export async function exportExecutivePDF(
  month: string,
  projectFilter: string | undefined,
  sections: PDFExportSections,
  onProgress?: (step: string, current: number, total: number) => void
): Promise<void> {
  const totalSteps = 2 + sections.chartPanels.length;
  let step = 0;

  const config = await db.config.get(1);

  // 1. Gather KPI data
  onProgress?.('Computing KPIs...', ++step, totalSteps);
  const kpiResults = await computeAllKPIs(month, projectFilter);
  const kpiCards = buildKPICardData(kpiResults, config?.kpi_cards, projectFilter);

  // 2. Gather narrative
  onProgress?.('Generating narrative...', ++step, totalSteps);
  const narrative = await generateNarrativeSummary(month, projectFilter);

  // 3. Gather alerts (if selected)
  let alerts: { title: string; detail: string; severity: 'alert' | 'warning' | 'info' }[] = [];
  if (sections.includeAlerts) {
    const anomalies = await computeAnomalies(month, projectFilter);
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

  // 5. Generate PDF
  onProgress?.('Building PDF...', step, totalSteps);
  const doc = await generateExecutivePDF({
    teamName: config?.team_name || 'Engineering',
    month,
    monthLabel: formatMonthLabel(month),
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
  });

  // 6. Download
  const filename = `Resource_Report_${month.replace('-', '')}.pdf`;
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
