import { useState } from 'react';

interface PanelWrapperProps {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function PanelWrapper({ id, title, children, defaultCollapsed = false, className = '' }: PanelWrapperProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={`bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden panel-wrapper ${className}`}
      data-panel-id={id}
    >
      {/* Compact title bar */}
      <button
        type="button"
        className="w-full px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-table-header)] cursor-pointer hover:bg-[var(--border-subtle)] transition-colors flex items-center justify-between"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] leading-tight">
          {title}
        </h3>
        <svg
          className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform flex-shrink-0 ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {/* Content — overflow-visible to prevent tooltip clipping */}
      {!collapsed && (
        <div className="p-3 overflow-visible">
          {children}
        </div>
      )}
    </div>
  );
}
