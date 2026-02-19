interface HeatmapProps {
  rows: { key: string; label: string }[];
  columns: { key: string; label: string }[];
  data: Map<string, number>;       // Key format: "rowKey|colKey" → numeric value
  colorFn: (value: number) => string;
  formatFn?: (value: number) => string;
  emptyValue?: number;
  title?: string;
  highlightedRows?: Set<string>;        // Row keys to visually highlight (e.g., top 3)
  rowAnnotations?: Map<string, string>; // Extra text after row label (e.g., score)
  highlightedColumns?: Set<string>;     // Column keys to accent (e.g., required skills)
}

export function Heatmap({
  rows,
  columns,
  data,
  colorFn,
  formatFn = (v) => v.toString(),
  emptyValue = 0,
  title,
  highlightedRows,
  rowAnnotations,
  highlightedColumns,
}: HeatmapProps) {
  const getValue = (rowKey: string, colKey: string): number => {
    return data.get(`${rowKey}|${colKey}`) ?? emptyValue;
  };

  // Helper to determine text color based on background brightness
  const getTextColor = (bgColor: string): string => {
    // Dark backgrounds that need white text
    const darkColors = ['#16a34a', '#2563eb', '#1d4ed8', '#dc2626', '#7c3aed', '#0d9488'];
    return darkColors.some(dark => bgColor.toLowerCase() === dark.toLowerCase()) ? '#FFFFFF' : '#000000';
  };

  return (
    <div className="overflow-x-auto">
      {title && <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">{title}</h3>}
      <table className="heatmap-table">
        <thead>
          <tr>
            <th>
              {/* Empty corner cell */}
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className={highlightedColumns?.has(col.key) ? 'heatmap-col-required' : ''}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isHighlighted = highlightedRows?.has(row.key);
            const annotation = rowAnnotations?.get(row.key);

            return (
              <tr
                key={row.key}
                className={isHighlighted ? 'heatmap-row-highlighted' : ''}
              >
                <td>
                  {row.label}
                  {annotation && (
                    <span
                      className={`heatmap-score-badge ${
                        isHighlighted ? 'heatmap-score-badge--top' : 'heatmap-score-badge--normal'
                      }`}
                    >
                      {annotation}
                    </span>
                  )}
                </td>
                {columns.map((col) => {
                  const value = getValue(row.key, col.key);
                  const bgColor = colorFn(value);
                  const textColor = getTextColor(bgColor);

                  return (
                    <td
                      key={col.key}
                      title={`${row.label} × ${col.label}: ${formatFn(value)}`}
                    >
                      <span
                        className="heatmap-cell"
                        style={{ backgroundColor: bgColor, color: textColor }}
                      >
                        {formatFn(value)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
