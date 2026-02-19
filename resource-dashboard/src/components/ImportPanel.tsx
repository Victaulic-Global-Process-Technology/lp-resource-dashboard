import { useState, useRef } from 'react';
import { importMultipleCSVFiles } from '../import/importEngine';
import type { AnyImportResult } from '../import/importEngine';
import type { FeedbackImportResult } from '../import/feedbackParser';

function isFeedbackResult(result: AnyImportResult): result is FeedbackImportResult {
  return 'type' in result && result.type === 'feedback';
}

export function ImportPanel() {
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    filename: string;
  } | null>(null);
  const [results, setResults] = useState<AnyImportResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));

    if (csvFiles.length === 0) {
      alert('Please select CSV files only');
      return;
    }

    setIsImporting(true);
    setResults([]);

    try {
      const importResults = await importMultipleCSVFiles(
        csvFiles,
        (current, total, filename) => {
          setImportProgress({ current, total, filename });
        }
      );

      setResults(importResults);
      window.dispatchEvent(new CustomEvent('data-imported'));
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer
          ${isDragging ? 'border-[var(--accent)] bg-[var(--accent-light)]/20' : 'border-[var(--border-input)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)]/10'}
          ${isImporting ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <svg className="mx-auto w-10 h-10 text-[var(--text-muted)] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-[13px] font-medium text-[var(--text-secondary)]">
          Drop CSV files here, or <span className="text-[var(--accent)] underline">browse</span>
        </p>
        <p className="text-[11px] text-[var(--text-muted)] mt-1">
          Accepts LiquidPlanner timesheet exports and Microsoft Forms feedback exports (.csv)
        </p>
      </div>

      {/* Progress Indicator */}
      {isImporting && importProgress && (
        <div className="border rounded-lg p-4 bg-[var(--accent-light)] border-[var(--accent)]">
          <div className="flex items-center">
            <div className="animate-spin mr-3">
              <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-[13px] text-[var(--accent)]">
                Importing {importProgress.current} of {importProgress.total}...
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {importProgress.filename}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-[var(--bg-panel)] border border-[var(--border-default)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-table-header)]">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Import Results
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {results.map((result, index) => {
              const isFeedback = isFeedbackResult(result);
              return (
                <div
                  key={index}
                  className="border rounded-lg p-4"
                  style={{
                    backgroundColor: result.success ? 'var(--status-good-bg)' : 'var(--status-danger-bg)',
                    borderColor: result.success ? 'var(--status-good-border)' : 'var(--status-danger-border)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {result.success ? (
                        <svg className="w-4 h-4 text-[var(--status-good)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[var(--status-danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[13px] truncate text-[var(--text-primary)]">
                          {result.filename}
                        </p>
                        {isFeedback && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--accent)] text-white">
                            Feedback
                          </span>
                        )}
                      </div>

                      {result.success && isFeedback && (
                        <div className="mt-2 text-[11px] space-y-0.5 text-[var(--text-secondary)]">
                          <p><span className="font-medium">Type:</span> Weekly Feedback Form</p>
                          <p><span className="font-medium">Week Ending:</span> {result.weekEnding}</p>
                          <p>
                            <span className="font-medium">Records:</span>{' '}
                            {result.imported} new, {result.updated} updated
                          </p>
                          {result.projects.length > 0 && (
                            <p><span className="font-medium">Projects:</span> {result.projects.join(', ')}</p>
                          )}
                          {result.warnings.length > 0 && (
                            <div className="mt-1">
                              <p className="text-[11px] font-medium text-[var(--status-warn)]">Warnings:</p>
                              <ul className="list-disc list-inside text-[11px] mt-0.5 text-[var(--status-warn)]">
                                {result.warnings.slice(0, 5).map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                                {result.warnings.length > 5 && (
                                  <li>... and {result.warnings.length - 5} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {result.success && !isFeedback && (
                        <div className="mt-2 text-[11px] space-y-0.5 text-[var(--text-secondary)]">
                          <p><span className="font-medium">Team:</span> {result.team}</p>
                          <p><span className="font-medium">Date Range:</span> {result.dateRangeStart} to {result.dateRangeEnd}</p>
                          <p>
                            <span className="font-medium">Rows:</span>{' '}
                            {result.newRowsInserted.toLocaleString()} new,{' '}
                            {result.duplicateRowsSkipped.toLocaleString()} duplicate
                            {' '}({result.totalRowsParsed.toLocaleString()} total)
                          </p>
                          <p>
                            <span className="font-medium">Hours:</span>{' '}
                            {result.totalHoursImported.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          {result.newPeopleDiscovered.length > 0 && (
                            <p><span className="font-medium">New People:</span> {result.newPeopleDiscovered.join(', ')}</p>
                          )}
                          {result.newProjectsDiscovered.length > 0 && (
                            <p><span className="font-medium">New Projects:</span> {result.newProjectsDiscovered.join(', ')}</p>
                          )}
                        </div>
                      )}

                      {result.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[11px] font-medium text-[var(--status-danger)]">Errors:</p>
                          <ul className="list-disc list-inside text-[11px] mt-1 text-[var(--status-danger)]">
                            {result.errors.slice(0, 5).map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                            {result.errors.length > 5 && (
                              <li>... and {result.errors.length - 5} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
