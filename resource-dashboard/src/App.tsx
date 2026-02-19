import { useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { initializeDatabase, db } from './db/database';
import { refreshKPIHistory } from './aggregation/kpiHistory';

const ImportPage = lazy(() => import('./pages/ImportPage').then(m => ({ default: m.ImportPage })));
const ConfigPage = lazy(() => import('./pages/ConfigPage').then(m => ({ default: m.ConfigPage })));
const DashboardPageV3 = lazy(() => import('./pages/DashboardPageV3').then(m => ({ default: m.DashboardPageV3 })));
const UpdatesPage = lazy(() => import('./pages/UpdatesPage').then(m => ({ default: m.UpdatesPage })));

function App() {
  useEffect(() => {
    // Initialize database on app load
    initializeDatabase()
      .then(async () => {
        // One-time KPI history population: if kpiHistory is empty but timesheets exist
        const [kpiCount, tsCount] = await Promise.all([
          db.kpiHistory.count(),
          db.timesheets.count(),
        ]);
        if (kpiCount === 0 && tsCount > 0) {
          await refreshKPIHistory();
        }
      })
      .catch(console.error);
  }, []);

  return (
    <HashRouter>
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center py-20 text-[var(--text-muted)]">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/updates" element={<UpdatesPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/dashboard" element={<DashboardPageV3 />} />
          </Routes>
        </Suspense>
      </Layout>
    </HashRouter>
  );
}

export default App;
