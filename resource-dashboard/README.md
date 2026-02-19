# Resource Dashboard

Engineering resource management tool for the Victaulic Fire Suppression Technology team. Transforms LiquidPlanner timesheet exports into an interactive dashboard for tracking utilization, project progress, skill coverage, and work distribution.

**Local-first architecture** — all data lives in the browser via IndexedDB. No backend, no accounts, no internet required after initial load.

## Tech Stack

- **Vite** + **React 19** + **TypeScript** (strict mode)
- **Tailwind CSS** + custom design tokens
- **Dexie.js** (IndexedDB) for persistent local storage
- **Recharts** for data visualization
- **PapaParse** for CSV parsing
- **date-fns** for date handling
- **html2canvas** for chart-to-image export

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173. Import a CSV file from LiquidPlanner to populate the dashboard.

### Production Build

```bash
npm run build
npx serve dist
```

## CSV Import

### Expected Filename

```
Victaulic.timesheets.{TEAM}.{YYYY-MM-DD} to {YYYY-MM-DD}.csv
```

Example: `Victaulic.timesheets.ENG_Fire_Suppression.2026-01-01 to 2026-01-31.csv`

### Import Pipeline

1. **Parse** — PapaParse reads the CSV with column mapping (64+ columns)
2. **Normalize** — Type coercion, date formatting, field validation
3. **Deduplicate** — Checks `timesheet_entry_id` against existing records
4. **Auto-discover** — New team members and projects are classified automatically
5. **Store** — Bulk insert into IndexedDB
6. **Log** — Import event recorded with statistics

Supports drag-and-drop, file picker, and multi-file sequential import. Duplicate rows are detected and skipped. The Data Status panel shows date range coverage with **gap detection** — warns when months are missing between imports.

## Features

### Dashboard Panels

The dashboard provides 11 configurable panels, toggled on/off via the panel drawer:

| Panel | Description |
|-------|-------------|
| **KPI Summary** | Team utilization %, NPD focus %, firefighting load, active engineers, total hours, projects touched |
| **Planned vs Actual** | Stacked bar chart comparing planned vs actual hours by category (NPD, Sustaining, Sprint) |
| **Firefighting Trend** | Unplanned/firefighting hours tracked month-over-month |
| **Utilization Heatmap** | Engineer x Month grid with color-coded utilization percentages |
| **NPD Project Comparison** | Per-project planned vs actual with color-coded variance (red >10% over, green >10% under) |
| **Skill Heat Map** | Engineer x Skill rating grid (0-5 scale) with project-based ranking and top-3 highlighting |
| **NPD Milestones** | Gate review dates (DR1/DR2/DR3/Launch) with status indicators (approaching, past due, future) |
| **Lab Tech Hours** | Bar chart of lab testing hours per engineer |
| **Engineer Breakdown** | Stacked horizontal bars showing hour distribution by category per engineer |
| **Project Burndown** | Timeline chart with planned/actual lines and milestone reference markers |
| **Tech Affinity** | Engineer-technician collaboration patterns based on shared project hours |

### Skill-Based Engineer Ranking

Projects can be tagged with required skills and importance weights (1-5). When a project is selected in the Skill Heat Map panel:

- Engineers are reordered by **compatibility score** (weighted dot product of skill ratings vs project requirements, normalized to 0-100%)
- **Top 3 candidates** are highlighted with green indicators
- Required skill columns are accented
- Score badges appear next to each engineer's name

### Configuration

Accessible via the Settings page with seven tabs:

- **Global Settings** — Team name, standard monthly capacity (default 140 hrs), over-utilization threshold
- **Team Members** — Role assignment (Engineer / Lab Technician), capacity overrides, auto-discovered from imports
- **Projects** — Type classification (NPD, Sustaining, Admin, OOO, Sprint), work class (Planned / Unplanned), required skill tags with weights
- **Skills Matrix** — Interactive 0-5 rating grid across 14 default skill categories. Click cells to cycle ratings. Add/remove skill columns. Clear entire engineer rows
- **Milestones** — Gate review dates (DR1, DR2, DR3, Launch) for NPD projects with phase tracking
- **Planned Hours** — Monthly hour budgets per project, copy-from-previous-month utility
- **Resource Allocations** — Engineer assignment percentages per project per month, auto-calculated hours, utilization status indicators

### Auto-Classification

**Projects** are classified on import using R# prefix patterns and inherited tags:
- `NPD` — R-prefix codes > R0999 (active development)
- `Sustaining` — S-prefix codes
- `Admin` — R0996
- `OOO` — R0999 (PTO/holidays)
- `Sprint` — T-prefix codes
- Known firefighting codes (R0992, S0002, etc.) are flagged as Unplanned

**Team members** are classified by activity distribution:
- `Engineer` — Default role
- `Lab Technician` — >60% of hours logged as "Lab - Testing"

### Export & Reporting

- **Print** — Optimized print stylesheet with page breaks, hidden UI chrome, exact colors
- **Email** — Converts chart panels to embedded images, generates HTML copied to clipboard
- **Selective export** — Choose which panels to include

### Data Integrity

- **Deduplication** on `timesheet_entry_id` prevents double-counting across overlapping imports
- **Gap detection** identifies missing months in the imported date range and displays warnings
- **Import history** logs every import with row counts, date ranges, and discovered entities

## Data Model

11 IndexedDB tables (Dexie schema v3):

| Table | Purpose | Key |
|-------|---------|-----|
| `timesheets` | Raw CSV rows (verbatim) | `timesheet_entry_id` |
| `teamMembers` | People with roles and capacity | `person_id` |
| `projects` | R#/S#/T# codes with classification | `project_id` |
| `skills` | Engineer skill ratings (0-5) | `[engineer+skill]` |
| `skillCategories` | Skill definitions with ordering | `name` |
| `projectSkillRequirements` | Required skills per project with weights | `[project_id+skill]` |
| `milestones` | NPD gate review dates | `project_id` |
| `plannedAllocations` | Engineer assignments per project per month | `[month+project_id+engineer]` |
| `plannedProjectMonths` | Monthly hour budgets per project | `[month+project_id]` |
| `config` | Global settings (singleton) | `id` |
| `importLogs` | Import history | `++id` |

## Project Structure

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
├── hooks/              # Data hooks (useProjects, useConfig, useTeamMembers, etc.)
├── import/             # CSV parser, normalizer, import engine
├── pages/              # Top-level route pages
├── types/              # TypeScript interfaces and enums
└── utils/              # Classification logic, project utilities
```

## License

Proprietary — Victaulic Fire Suppression Technology Engineering Team
