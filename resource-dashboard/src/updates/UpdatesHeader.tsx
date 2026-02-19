import { formatWeekLabel } from '../utils/weekDates';

interface UpdatesHeaderProps {
  availableWeeks: string[];
  selectedWeek: string;
  onWeekChange: (week: string) => void;
  onMeetingPrep: () => void;
}

export function UpdatesHeader({
  availableWeeks,
  selectedWeek,
  onWeekChange,
  onMeetingPrep,
}: UpdatesHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">
          Weekly Updates
        </h1>

        <select
          value={selectedWeek}
          onChange={(e) => onWeekChange(e.target.value)}
          className="text-[13px] px-3 py-1.5 border border-[var(--border-input)] rounded-md bg-[var(--bg-input)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent-focus-ring)] focus:outline-none"
        >
          {availableWeeks.map(w => (
            <option key={w} value={w}>
              Week ending {w}
            </option>
          ))}
        </select>

        {selectedWeek && (
          <span className="text-[13px] text-[var(--text-muted)]">
            {formatWeekLabel(selectedWeek)}
          </span>
        )}
      </div>

      <button
        onClick={onMeetingPrep}
        className="text-[13px] font-medium px-4 py-2 rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] transition-colors"
      >
        Meeting Prep
      </button>
    </div>
  );
}
