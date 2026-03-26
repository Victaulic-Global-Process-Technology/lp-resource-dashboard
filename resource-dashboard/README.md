# Resource Dashboard

Engineering resource management tool for the Victaulic Fire Suppression Technology team. Transforms LiquidPlanner timesheet exports into an interactive dashboard for tracking utilization, project progress, skill coverage, and work distribution across the engineering organization.

Local-first architecture — all data lives in the browser via IndexedDB. No backend, no accounts, no internet required after initial load.

---

## Features

### Dashboard

- 11 configurable panels toggled on/off via the panel drawer
- KPI Summary with team utilization, NPD focus, firefighting load, active engineers, and total hours
- Planned vs Actual stacked bar chart by category (NPD, Sustaining, Sprint)
- Firefighting trend tracked month-over-month
- Utilization heatmap (Engineer x Month grid with color-coded percentages)
- NPD project comparison with color-coded variance indicators
- Engineer breakdown with stacked horizontal bars by category
- Project burndown with planned/actual lines and milestone markers
- Lab tech hours and tech affinity panels

### Skill-based engineer ranking

- Projects tagged with required skills and importance weights (1-5)
- Engineers reordered by compatibility score (weighted dot product, normalized to 0-100%)
- Top 3 candidates highlighted with green indicators
- Required skill columns accented, score badges next to each name

### Configuration

- Seven settings tabs: Global Settings, Team Members, Projects, Skills Matrix, Milestones, Planned Hours, Resource Allocations
- Auto-classification of projects by R#/S#/T# prefix patterns
- Auto-classification of team members by activity distribution
- Interactive 0-5 skill rating grid across 14 default categories

### Import pipeline

- CSV import from LiquidPlanner timesheet exports
- Drag-and-drop, file picker, and multi-file sequential import
- Deduplication on `timesheet_entry_id` prevents double-counting
- Gap detection identifies missing months and displays warnings
- Import history log with row counts, date ranges, and discovered entities

### Export and reporting

- Optimized print stylesheet with page breaks and exact colors
- Email export converts charts to embedded images, generates HTML to clipboard
- Selective panel export

## Technology stack

| Layer | Technology |
|-------|------------|
| Framework | Vite + React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + design tokens |
| State | Dexie.js (IndexedDB) |
| Charts | Recharts |
| Data | PapaParse (CSV), date-fns |
| Export | html2canvas |

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. Import a CSV file from LiquidPlanner to populate the dashboard.

### Production build

```bash
npm run build
```

Produces an optimized bundle in `/dist` for deployment.

## Build and release

This project uses an automated release system. Running `npm run release` will:

1. Check for uncommitted changes and prompt to commit
2. Read the version from `package.json`
3. Check the release repository for version conflicts
4. Build the project
5. Copy the build to the release repository (`/latest` and `/history/v{version}`)
6. Commit and push both repositories

## Project structure

```
src/
├── aggregation/        # Computation logic (actual hours, utilization, skill matching)
├── charts/             # Reusable chart components (Heatmap, ChartTheme)
├── components/         # Shared UI (ImportPanel, ImportStatus)
├── config/             # Settings tab components (7 config sections)
├── dashboard/
│   ├── panels/         # 11 dashboard panel components
│   └── hooks/          # Panel config and layout hooks
├── db/
│   ├── database.ts     # Dexie schema and initialization
│   └── operations.ts   # CRUD operations, stats, gap detection
├── export/             # Print and email export
├── hooks/              # Data hooks (useProjects, useConfig, useTeamMembers)
├── import/             # CSV parser, normalizer, import engine
├── pages/              # Top-level route pages
├── types/              # TypeScript interfaces and enums
└── utils/              # Classification logic, project utilities
```

## Data model

11 IndexedDB tables (Dexie schema v3):

| Table | Purpose |
|-------|---------|
| `timesheets` | Raw CSV rows (verbatim) |
| `teamMembers` | People with roles and capacity |
| `projects` | R#/S#/T# codes with classification |
| `skills` | Engineer skill ratings (0-5) |
| `skillCategories` | Skill definitions with ordering |
| `projectSkillRequirements` | Required skills per project with weights |
| `milestones` | NPD gate review dates |
| `plannedAllocations` | Engineer assignments per project per month |
| `plannedProjectMonths` | Monthly hour budgets per project |
| `config` | Global settings (singleton) |
| `importLogs` | Import history |

## Repository information

| Field | Value |
|-------|-------|
| Version | 1.0.0 |
| Repository | resource-dashboard |
| Maintainer | Fire Suppression Engineering — Easton, PA |
| License | Proprietary — Victaulic Company |

## Engineering disclaimer

This tool is intended to assist qualified engineers and estimators during system configuration and estimation. Final system designs must be reviewed and approved in accordance with applicable codes, standards, and Victaulic engineering guidance.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

(c) 2026 Victaulic Company. All rights reserved.
