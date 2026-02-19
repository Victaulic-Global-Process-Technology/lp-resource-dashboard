import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GlobalParamsConfig } from '../config/GlobalParamsConfig';
import { TeamMembersConfig } from '../config/TeamMembersConfig';
import { ProjectsConfig } from '../config/ProjectsConfig';
import { SkillsMatrixConfig } from '../config/SkillsMatrixConfig';
import { MilestonesConfig } from '../config/MilestonesConfig';
import { PlannedHoursConfig } from '../config/PlannedHoursConfig';
import { ResourceAllocationsConfig } from '../config/ResourceAllocationsConfig';
import { AlertRulesConfig } from '../config/AlertRulesConfig';
import { NarrativeConfigPanel } from '../config/NarrativeConfig';
import { KPICardsConfig } from '../config/KPICardsConfig';

type ConfigTab =
  | 'global'
  | 'team'
  | 'projects'
  | 'skills'
  | 'milestones'
  | 'planned-hours'
  | 'allocations'
  | 'alert-rules'
  | 'narrative-summary'
  | 'kpi-cards';

interface TabDef {
  id: ConfigTab;
  label: string;
  description: string;
}

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  defaultTab: ConfigTab;
  tabs: TabDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'global',
    label: 'Global Settings',
    icon: <GearIcon />,
    defaultTab: 'global',
    tabs: [
      { id: 'global', label: 'General', description: 'Configure team-wide parameters and defaults' },
      { id: 'kpi-cards', label: 'KPI Cards', description: 'Choose which KPI cards appear on the dashboard, apply presets, and reorder' },
      { id: 'narrative-summary', label: 'Narrative Summary', description: 'Configure the monthly narrative observations, tone, and framing' },
      { id: 'alert-rules', label: 'Alert Rules', description: 'Configure anomaly detection thresholds and severity levels' },
    ],
  },
  {
    id: 'project',
    label: 'Project Settings',
    icon: <FolderIcon />,
    defaultTab: 'projects',
    tabs: [
      { id: 'projects', label: 'Projects', description: 'Manage project registry and classifications' },
      { id: 'milestones', label: 'Milestones', description: 'Configure gate review dates for NPD projects' },
      { id: 'planned-hours', label: 'Planned Hours', description: 'Set monthly hour budgets for each project' },
    ],
  },
  {
    id: 'team',
    label: 'Team Settings',
    icon: <PeopleIcon />,
    defaultTab: 'team',
    tabs: [
      { id: 'team', label: 'Team Members', description: 'Manage team roster and role assignments' },
      { id: 'skills', label: 'Skills Matrix', description: 'Rate engineer skills on a 0-5 scale' },
      { id: 'allocations', label: 'Resource Allocations', description: 'Assign engineers to projects with allocation percentages' },
    ],
  },
];

// Build lookup helpers
const ALL_TABS = CATEGORIES.flatMap(c => c.tabs);
const VALID_TAB_IDS = new Set(ALL_TABS.map(t => t.id));

function getCategoryForTab(tabId: ConfigTab): string {
  return CATEGORIES.find(c => c.tabs.some(t => t.id === tabId))?.id ?? 'global';
}

export function ConfigPage() {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = (tabParam && VALID_TAB_IDS.has(tabParam as ConfigTab))
    ? tabParam as ConfigTab
    : 'global';

  const [activeTab, setActiveTab] = useState<ConfigTab>(initialTab);
  const [expandedCategory, setExpandedCategory] = useState<string>(getCategoryForTab(initialTab));

  const activeTabInfo = ALL_TABS.find(t => t.id === activeTab)!;

  const handleCategoryClick = (category: CategoryDef) => {
    if (expandedCategory === category.id) {
      // Already expanded — select its default tab
      setActiveTab(category.defaultTab);
    } else {
      // Expand this category and select its default tab
      setExpandedCategory(category.id);
      setActiveTab(category.defaultTab);
    }
  };

  const handleTabClick = (tabId: ConfigTab) => {
    setActiveTab(tabId);
    setExpandedCategory(getCategoryForTab(tabId));
  };

  return (
    <div>
      <h1 className="text-lg font-bold text-[var(--text-primary)] mb-5">Configuration</h1>

      <div className="flex gap-0 bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden min-h-[600px]">
        {/* Left: grouped sidebar */}
        <div className="w-[220px] flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-table-header)]">
          <nav className="py-1">
            {CATEGORIES.map((category) => {
              const isExpanded = expandedCategory === category.id;
              const hasActiveChild = category.tabs.some(t => t.id === activeTab);

              return (
                <div key={category.id}>
                  {/* Category header */}
                  <button
                    onClick={() => handleCategoryClick(category)}
                    className={`
                      w-full text-left px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors
                      flex items-center gap-2
                      ${hasActiveChild
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                      }
                    `}
                  >
                    <span className="flex-shrink-0 w-4 h-4">{category.icon}</span>
                    <span className="flex-1">{category.label}</span>
                    <svg
                      className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Child tabs — collapsible */}
                  <div
                    className={`overflow-hidden transition-all duration-150 ${
                      isExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    {category.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`
                          w-full text-left pl-9 pr-3 py-2 text-[13px] transition-colors
                          border-l-[3px]
                          ${activeTab === tab.id
                            ? 'border-l-[var(--accent)] text-[var(--accent)] bg-white font-semibold'
                            : 'border-l-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/60 font-medium'
                          }
                        `}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Divider between categories */}
                  <div className="mx-3 border-b border-[var(--border-subtle)]" />
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right: tab content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">{activeTabInfo.label}</h2>
          <p className="text-[13px] text-[var(--text-muted)] mb-6">{activeTabInfo.description}</p>

          {activeTab === 'global' && <GlobalParamsConfig />}
          {activeTab === 'team' && <TeamMembersConfig />}
          {activeTab === 'projects' && <ProjectsConfig />}
          {activeTab === 'skills' && <SkillsMatrixConfig />}
          {activeTab === 'milestones' && <MilestonesConfig />}
          {activeTab === 'planned-hours' && <PlannedHoursConfig />}
          {activeTab === 'allocations' && <ResourceAllocationsConfig />}
          {activeTab === 'alert-rules' && <AlertRulesConfig />}
          {activeTab === 'narrative-summary' && <NarrativeConfigPanel />}
          {activeTab === 'kpi-cards' && <KPICardsConfig />}
        </div>
      </div>
    </div>
  );
}

// ── Category Icons ──

function GearIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7 7 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a7 7 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.282c-.062-.373-.312-.686-.644-.87a7 7 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.248a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7 7 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.248a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
