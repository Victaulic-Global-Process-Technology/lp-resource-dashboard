/**
 * Master aggregation engine - central export point for all aggregations.
 */

export { computeActualHours } from './actualHours';
export { computeLabTechHours } from './labTechHours';
export { computePlannedUtilization } from './utilization';
export {
  computeMonthlyCategoryTotals,
  computeNPDProjectComparison,
  computeProjectTimeline,
  getProjectParent,
} from './plannedVsActual';
export { computeTechAffinity } from './techAffinity';
export { computeFocusScore } from './focusScore';
export { computeBusFactorRisk } from './busFactor';
export { computeMeetingTax } from './meetingTax';
export { computeAnomalies } from './anomalies';
export { generateNarrativeSummary } from './narrative';
export { computeAllKPIs } from './kpiEngine';
export { computeCapacityForecast } from './capacityForecast';
export { computeWeeklyAutoSummary, formatAutoSummary } from './weeklyAutoSummary';
