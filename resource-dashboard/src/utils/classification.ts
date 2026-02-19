import { ProjectType, WorkClass, PersonRole, ActivityType } from '../types';
import type { TimesheetEntry } from '../types';

// Known project names from the Excel template
export const KNOWN_PROJECTS: Record<string, string> = {
  'R1337.1': 'K4.0 Resi Concealed Sidewall',
  'R1337.2': 'K8.0 Resi Concealed Sidewall ECLH',
  'R1337.3': 'K5.6 Resi Concealed Sidewall',
  'R1430.1A': 'K11.2 Low Profile In Rack Storage Sprinkler',
  'R1430.1B': 'K8.0 Low Profile In Rack Storage Sprinkler',
  'R1430.1C': 'K5.6 Low Profile In Rack Storage Sprinkler',
  'R1514.1': 'K4.9 Resi Concealed Pendent',
  'R1514.2': 'K3.0 Resi Concealed Pendent',
  'R1517': 'K22/K25 ESFR High Pressure',
  'R1517.1': 'K17 ESFR High Pressure',
  'R1518': 'Universal Cleanroom',
  'R1527': 'UL Listing for Vortex',
  'S0001': 'V10 Spray Nozzle Kfactor Noncompliance',
  'S0057': 'VicFlex Double Window VB5 Data Center Bracket',
  'S0013': 'General Sustaining Support',
  'S0062': 'VTI 300 Bar Cylinder Valve',
  'R0999': 'Out of Office (PTO/Holiday)',
  'R0996': 'Administrative Work',
  'S0004': 'Regulatory Support / Industry Committee Work',
  'R0992': 'Applications / Sales Support',
  'S0002': 'EP Support',
  'S0005': 'Manufacturing Support',
  'R0991': 'Lab 5S Support',
  'S0006': 'Submittal Modifications',
  'S0082': 'Vortex Sustaining',
  'R0751': 'QA / PER Support',
  'S0008': 'Drawing Maintenance',
  'S0003': 'Reliability Growth',
};

// These R#s are known "Unplanned/Firefighting" from the Excel template
const FIREFIGHTING_CODES = new Set([
  'R0992',  // Applications / Sales Support
  'S0002',  // EP Support
  'S0005',  // Manufacturing Support
  'R0991',  // Lab 5S Support
  'R0751',  // QA / PER Support
  'S0008',  // Drawing Maintenance
  'S0003',  // Reliability Growth
  'S0001',  // V10 Spray Nozzle (reactive)
  'R0993',  // Misc sustaining support
]);

/**
 * Classify project type based on R# code and inherited tags.
 */
export function classifyProjectType(rNumber: string, inheritedTags: string): ProjectType {
  // Admin and OOO are fixed codes
  if (rNumber === 'R0996') return ProjectType.Admin;
  if (rNumber === 'R0999') return ProjectType.OutOfOffice;

  // T-prefix = Sprint
  if (rNumber.startsWith('T')) return ProjectType.Sprint;

  // Check inherited tags for explicit signals
  const tags = inheritedTags.split(',').map(t => t.trim().toLowerCase());
  if (tags.includes('npd')) return ProjectType.NPD;
  if (tags.includes('sustaineng')) return ProjectType.Sustaining;

  // S-prefix R#s are typically Sustaining
  if (rNumber.startsWith('S')) return ProjectType.Sustaining;

  // R-prefix with numeric suffix > R0999 are typically NPD
  const rMatch = rNumber.match(/^R(\d+)/);
  if (rMatch) {
    const num = parseInt(rMatch[1]);
    if (num > 999 && num !== 996 && num !== 999) return ProjectType.NPD;
    // R0991, R0992, R0993, R0751 = Sustaining support
    return ProjectType.Sustaining;
  }

  return ProjectType.Sustaining; // Safe default
}

/**
 * Classify work class based on R# code.
 */
export function classifyWorkClass(rNumber: string): WorkClass {
  if (FIREFIGHTING_CODES.has(rNumber)) return WorkClass.UnplannedFirefighting;
  return WorkClass.Planned;
}

/**
 * Heuristic: if a person logs >60% of their hours as "Lab - Testing",
 * default them to LabTechnician. Otherwise Engineer.
 * This runs across ALL imported data for a person, not just one month.
 */
export function classifyPersonRole(entries: TimesheetEntry[]): PersonRole {
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const labHours = entries
    .filter(e => e.activity === ActivityType.LabTesting)
    .reduce((sum, e) => sum + e.hours, 0);

  if (totalHours > 0 && (labHours / totalHours) > 0.6) {
    return PersonRole.LabTechnician;
  }
  return PersonRole.Engineer;
}

/**
 * When auto-discovering a project, pick the most common LP project name
 * for that R# code. If there's a tie, prefer the shortest name.
 * Users can override in config.
 */
export function resolveProjectName(rNumber: string, entries: TimesheetEntry[]): string {
  // Check if we have a known project name first
  if (KNOWN_PROJECTS[rNumber]) {
    return KNOWN_PROJECTS[rNumber];
  }

  const projectEntries = entries.filter(e => e.r_number === rNumber);
  const nameCounts = new Map<string, number>();

  for (const entry of projectEntries) {
    nameCounts.set(entry.project, (nameCounts.get(entry.project) || 0) + 1);
  }

  // Sort by count desc, then by name length asc (prefer shorter names)
  const sorted = [...nameCounts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].length - b[0].length;
  });

  return sorted[0]?.[0] || rNumber;
}
