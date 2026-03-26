# Changelog

All notable changes to this project are documented here.

## v2.0.0 — 2026-03-26

### Phase 1 — Multi-view architecture

- Added four dedicated view pages: Overview, Planning & Resources, Team Health, Engineer Profile
- Added collapsible sidebar navigation with view-specific routes
- Added `ViewFilterContext` for shared filter state (month range, project, engineer)
- Added parameterized routes for project drill-in (`/planning/:projectId`) and engineer profiles (`/engineer/:fullName`)

### Phase 2 — Engineer Profile

- Added Engineer Profile page with team roster selector and per-engineer panels
- Added Employee Header Card with utilization, logged hours, planned hours, active projects, and capacity stats
- Added Hours by Activity donut and Work Mix (NPD/Sustaining/Sprint) donut
- Added Utilization Trend sparkline for individual engineers
- Added Project Portfolio panel with project-level hour breakdown
- Added per-engineer Allocation Compliance and Firefighting Trend panels

### Phase 3 — Panel availability and drill-down

- Added `usePanelDataCheck` hook to conditionally show/hide panels based on data availability
- Added cross-view drill-down navigation (click engineer names to open profiles, click projects to open planning view)
- Added Anomaly Alerts panel for engineer-level outlier detection

### Phase 4 — Polish and consistency

- Removed dead code and unused hooks (`useMonthFilter`)
- Fixed `ExportConfigModal` for per-view panel scoping
- Added PDF export scoping per view
- Added sidebar active state highlighting for parameterized routes
- Fixed loading vs empty state separation across panels
- Applied `formatHours` consistently across all panels

### Phase 5 — Resource Allocations rewrite

- Rewrote Resource Allocations Config to person-first layout with six sections
- Added capacity summary cards (capacity, planned, unplanned) with stacked category bar
- Added current allocations list grouped by project with inline editing and remove
- Added allocation form with MonthRangePicker range selector, project dropdown grouped by type, and bidirectional % ↔ hours auto-calculation
- Added conflict resolution panel with month-by-month comparison table and Replace/Skip/Cancel actions
- Added monthly capacity breakdown cards with color-coded utilization thresholds

### Phase 6 — Team Health panels

- Added Work Category Pie panel (NPD/Sustaining/Sprint/Other split) to Team Health
- Added Hours by Discipline donut panel (Engineering/Lab Testing/PM & Admin) to Team Health
- Added Team Utilization heatmap (capacity forecast) to Team Health with click-to-navigate to engineer profiles
- Matched team donut/pie chart design to engineer profile style (center label, vertical legend, consistent tooltips)

### Phase 7 — Scope filtering and UX improvements

- Added MonthRangePicker `both` mode combining historical and future shortcut pills
- Configured per-view picker modes: Overview (historical), Team/Planning/Engineer (both), Resource Allocations (future)
- Scoped Utilization Heatmap panel to respect selected date range filter
- Scoped Capacity Forecast panel to respect selected date range filter
- Scoped NPD Project Comparison to hide projects with zero planned and actual hours
- Added logged/planned month range captions to Engineer Profile header card
- Hidden unconfigured engineers (zero skills rated) from Skill Heat Map
- Fixed Skill Heat Map category header alignment with subcategory columns

### Skills Matrix

- Rewrote Skills Matrix Config to person-first vertical card layout
- Added engineer dropdown with category-grouped skill sections
- Added inline [—][1][2][3][4][5] rating buttons per skill

### Housekeeping

- Removed legacy `scripts/` directory (batch files, packaging scripts)
- Added GitHub Pages deployment workflow

## v1.0.0 — 2026-03-07

### Dashboard

- Added 11 configurable dashboard panels with toggle visibility
- Added KPI Summary, Planned vs Actual, Firefighting Trend, Utilization Heatmap panels
- Added NPD Project Comparison with color-coded variance indicators
- Added Skill Heat Map with engineer ranking by compatibility score
- Added NPD Milestones with gate review status indicators
- Added Lab Tech Hours, Engineer Breakdown, Project Burndown, and Tech Affinity panels

### Import pipeline

- Added CSV import from LiquidPlanner timesheet exports
- Added drag-and-drop, file picker, and multi-file sequential import
- Added deduplication on timesheet_entry_id
- Added gap detection for missing months between imports
- Added import history logging

### Configuration

- Added seven settings tabs (Global Settings, Team Members, Projects, Skills Matrix, Milestones, Planned Hours, Resource Allocations)
- Added auto-classification of projects by R#/S#/T# prefix patterns
- Added auto-classification of team members by activity distribution
- Added interactive 0-5 skill rating grid

### Export / reporting

- Added optimized print stylesheet with page breaks and exact colors
- Added email export with chart-to-image conversion
- Added selective panel export

### Data model

- Added 11 IndexedDB tables via Dexie schema v3

### Build and release

- Initial release
