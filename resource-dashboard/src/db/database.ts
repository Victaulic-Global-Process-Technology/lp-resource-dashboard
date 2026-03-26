import Dexie, { type Table } from 'dexie';
import type {
  TimesheetEntry,
  TeamMember,
  Project,
  ProjectMilestone,
  PlannedAllocation,
  PlannedProjectMonth,
  DashboardConfig,
  ImportLog,
  SkillRating,
  SkillCategory,
  ProjectSkillRequirement,
  AnomalyThreshold,
  NarrativeConfig,
  KPISnapshot,
  AnomalySnapshot,
  WeeklyUpdate,
  PlanningScenario,
  ScenarioAllocation,
  ScenarioSnapshot,
} from '../types';
import { DEFAULT_KPI_CARDS } from '../aggregation/kpiRegistry';

// Full skills matrix organized by 7 categories (from Excel source)
export const SKILL_CATEGORIES: { category: string; skills: string[] }[] = [
  {
    category: 'Mechanical Design & CAD',
    skills: ['3D CAD Modeling', 'GD&T', 'Design for Manufacturing/Assembly (DFM/DFA)'],
  },
  {
    category: 'Engineering Analysis & Simulation',
    skills: ['FEA', 'CFD', 'Tolerance Stack Analysis', 'Statistical analysis (6 sigma, process capability, etc.)', 'Design of Experiments (DOE)', 'Fatigue behavior'],
  },
  {
    category: 'Testing & Validation',
    skills: ['Instrumentation (strain gauges, thermocouples)', 'Data acquisition', 'Test plan development', 'FMEA'],
  },
  {
    category: 'Fire Suppression Domain Expertise',
    skills: [
      'Deflector development', 'Sprinkler operation / lodgement mitigation',
      'Thermal element (link, bulb) expertise', 'Large scale fire testing expertise',
      'Hose development', 'Bracket development', 'Vortex system design',
      'Vortex operation / troubleshooting', 'Vortex fire testing / applications',
      'Vortex VTHS', 'NFPA standards expertise',
    ],
  },
  {
    category: 'Project Skills',
    skills: ['Project Management', 'Technical Presentation'],
  },
  {
    category: 'Manufacturing & Production Knowledge',
    skills: ['Machining', 'Casting', 'Forging', 'Injection Molding', 'Sheet Metal', 'Welding'],
  },
  {
    category: 'Materials Engineering',
    skills: ['Metals', 'Plastics', 'Elastomers', 'Corrosion considerations', 'Coatings/finishes'],
  },
];

// Flat list for backward compat
export const DEFAULT_SKILLS = SKILL_CATEGORIES.flatMap(c => c.skills);

// Map old 14-skill names to new 38-skill names where possible
const SKILL_RENAME_MAP: Record<string, string> = {
  'Tolerance stackup': 'Tolerance Stack Analysis',
  'Statistical analysis': 'Statistical analysis (6 sigma, process capability, etc.)',
  'VicFlex hose': 'Hose development',
  'VicFlex bracket': 'Bracket development',
  'Vortex design': 'Vortex system design',
  'Vortex operation': 'Vortex operation / troubleshooting',
  'Fire test protocols': 'Large scale fire testing expertise',
  'Codes and standards': 'NFPA standards expertise',
  'Failure / root cause analysis': 'FMEA',
  'Test fixture design': 'Test plan development',
};

class DashboardDB extends Dexie {
  timesheets!: Table<TimesheetEntry, number>;
  teamMembers!: Table<TeamMember, number>;
  projects!: Table<Project, string>;
  milestones!: Table<ProjectMilestone, string>;
  plannedAllocations!: Table<PlannedAllocation, number>;
  plannedProjectMonths!: Table<PlannedProjectMonth, number>;
  config!: Table<DashboardConfig, number>;
  importLogs!: Table<ImportLog, number>;
  skills!: Table<SkillRating, number>;
  skillCategories!: Table<SkillCategory, string>;
  projectSkillRequirements!: Table<ProjectSkillRequirement, number>;
  anomalyThresholds!: Table<AnomalyThreshold, string>;
  narrativeConfig!: Table<NarrativeConfig, number>;
  kpiHistory!: Table<KPISnapshot, number>;
  anomalyHistory!: Table<AnomalySnapshot, number>;
  weeklyUpdates!: Table<WeeklyUpdate, number>;
  planningScenarios!: Table<PlanningScenario, number>;
  scenarioAllocations!: Table<ScenarioAllocation, number>;
  scenarioSnapshots!: Table<ScenarioSnapshot, number>;

  constructor() {
    super('ResourceDashboard');

    // Version 1: Phase 1 tables
    this.version(1).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
    });

    // Version 2: Add Phase 2 tables (skills)
    this.version(2).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
    });

    // Version 3: Add project skill requirements table
    this.version(3).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
    });

    // Version 4: Add anomaly thresholds table
    this.version(4).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
    });

    // Version 5: Add narrative config table
    this.version(5).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
      narrativeConfig: 'id',
    });

    // Version 6: Add kpi_cards to DashboardConfig
    this.version(6).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
      narrativeConfig: 'id',
    }).upgrade(tx => {
      return tx.table('config').toCollection().modify(config => {
        if (!config.kpi_cards) {
          config.kpi_cards = [...DEFAULT_KPI_CARDS];
        }
      });
    });

    // Version 7: Add pdf_export_sections to DashboardConfig
    this.version(7).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
      narrativeConfig: 'id',
    }).upgrade(tx => {
      return tx.table('config').toCollection().modify(config => {
        if (!config.pdf_export_sections) {
          config.pdf_export_sections = {
            includeKPISummary: true,
            includeNarrative: true,
            includeAlerts: false,
            chartPanels: ['engineer-breakdown', 'npd-project-comp'],
          };
        }
      });
    });

    // Version 8: Add KPI history + anomaly history tables
    this.version(8).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
      narrativeConfig: 'id',
      kpiHistory: '++id, [month+project_filter], month, project_filter, computed_at',
      anomalyHistory: '++id, [month+project_filter], month, project_filter',
    });

    // Version 9: Add weekly updates table
    this.version(9).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
      narrativeConfig: 'id',
      kpiHistory: '++id, [month+project_filter], month, project_filter, computed_at',
      anomalyHistory: '++id, [month+project_filter], month, project_filter',
      weeklyUpdates: '++id, &[project_id+week_ending], project_id, week_ending',
    });

    // Version 10: Add what-if scenario planning tables
    this.version(10).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
      narrativeConfig: 'id',
      kpiHistory: '++id, [month+project_filter], month, project_filter, computed_at',
      anomalyHistory: '++id, [month+project_filter], month, project_filter',
      weeklyUpdates: '++id, &[project_id+week_ending], project_id, week_ending',
      planningScenarios: '++id, status, created_at',
      scenarioAllocations: '++id, [scenario_id+month+project_id+engineer], scenario_id, month, engineer',
      scenarioSnapshots: '++id, scenario_id, computed_at',
    });

    // Version 11: Add category field to skillCategories, expand to 38 skills
    this.version(11).stores({
      timesheets: 'timesheet_entry_id, date, person, full_name, activity, r_number, team, month, week, person_id, project_id, task_id',
      teamMembers: 'person_id, person, full_name, role',
      projects: 'project_id, type, work_class',
      milestones: 'project_id',
      plannedAllocations: '++id, [month+project_id+engineer], month, project_id, engineer',
      plannedProjectMonths: '++id, [month+project_id], month, project_id',
      config: 'id',
      importLogs: '++id, imported_at, filename',
      skills: '++id, [engineer+skill], engineer, skill',
      skillCategories: 'name, category, sort_order',
      projectSkillRequirements: '++id, [project_id+skill], project_id, skill',
      anomalyThresholds: 'ruleId',
      narrativeConfig: 'id',
      kpiHistory: '++id, [month+project_filter], month, project_filter, computed_at',
      anomalyHistory: '++id, [month+project_filter], month, project_filter',
      weeklyUpdates: '++id, &[project_id+week_ending], project_id, week_ending',
      planningScenarios: '++id, status, created_at',
      scenarioAllocations: '++id, [scenario_id+month+project_id+engineer], scenario_id, month, engineer',
      scenarioSnapshots: '++id, scenario_id, computed_at',
    }).upgrade(async tx => {
      // Rename existing skill ratings to match new names
      const skills = await tx.table('skills').toArray();
      for (const s of skills) {
        const newName = SKILL_RENAME_MAP[s.skill];
        if (newName) {
          await tx.table('skills').update(s.id, { skill: newName });
        }
      }

      // Rename existing skill categories and add category field
      const cats = await tx.table('skillCategories').toArray();
      for (const c of cats) {
        const newName = SKILL_RENAME_MAP[c.name];
        if (newName) {
          // Delete old, add renamed (primary key is name, can't update PK)
          await tx.table('skillCategories').delete(c.name);
          const parentCat = SKILL_CATEGORIES.find(sc => sc.skills.includes(newName));
          await tx.table('skillCategories').add({
            name: newName,
            category: parentCat?.category ?? '',
            sort_order: c.sort_order,
          });
        } else {
          // Just add category field to existing entries
          const parentCat = SKILL_CATEGORIES.find(sc => sc.skills.includes(c.name));
          await tx.table('skillCategories').update(c.name, {
            category: parentCat?.category ?? '',
          });
        }
      }

      // Rename project skill requirements too
      const reqs = await tx.table('projectSkillRequirements').toArray();
      for (const r of reqs) {
        const newName = SKILL_RENAME_MAP[r.skill];
        if (newName) {
          await tx.table('projectSkillRequirements').update(r.id, { skill: newName });
        }
      }
    });
  }
}

export const db = new DashboardDB();

/**
 * Initialize database with default config and seed data if empty.
 */
export async function initializeDatabase(): Promise<void> {
  const configCount = await db.config.count();

  if (configCount === 0) {
    const defaultConfig: DashboardConfig = {
      id: 1,
      team_name: '',
      std_monthly_capacity_hours: 140,
      over_utilization_threshold_pct: 1.0,
      selected_month: '',
      selected_project: '',
      kpi_cards: [...DEFAULT_KPI_CARDS],
      pdf_export_sections: {
        includeKPISummary: true,
        includeNarrative: true,
        includeAlerts: false,
        chartPanels: ['engineer-breakdown', 'npd-project-comp'],
      },
    };

    await db.config.add(defaultConfig);
  }

  // Seed default skill categories if empty (38 skills across 7 categories)
  const skillCatCount = await db.skillCategories.count();

  if (skillCatCount === 0) {
    let sortOrder = 0;
    const categories = SKILL_CATEGORIES.flatMap(group =>
      group.skills.map(name => ({
        name,
        category: group.category,
        sort_order: sortOrder++,
      }))
    );
    await db.skillCategories.bulkAdd(categories);
  }

  // Seed default anomaly thresholds if empty
  const anomalyCount = await db.anomalyThresholds.count();

  if (anomalyCount === 0) {
    const { seedAnomalyDefaults } = await import('../aggregation/anomalyRules');
    await db.anomalyThresholds.bulkAdd(seedAnomalyDefaults());
  }

  // Seed default narrative config if empty
  const narrativeCount = await db.narrativeConfig.count();

  if (narrativeCount === 0) {
    const { DEFAULT_NARRATIVE_CONFIG } = await import('../aggregation/narrativeObservations');
    await db.narrativeConfig.add({ ...DEFAULT_NARRATIVE_CONFIG });
  }
}
