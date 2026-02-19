import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen h-full" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Fixed Sidebar */}
      <Sidebar />

      {/* Main content with left margin for sidebar */}
      <main className="ml-[220px] px-6 py-5 min-h-screen">
        {children}
      </main>
    </div>
  );
}
