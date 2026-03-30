/**
 * Branded loading animation — three ascending bars inspired by the app logo.
 * Bars rise sequentially from left to right to their target heights.
 */
export function ChartLoader({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`${height} flex items-center justify-center`}>
      <div className="chart-loader" aria-label="Loading chart data">
        <span className="chart-loader__bar chart-loader__bar--1" />
        <span className="chart-loader__bar chart-loader__bar--2" />
        <span className="chart-loader__bar chart-loader__bar--3" />
      </div>
    </div>
  );
}
