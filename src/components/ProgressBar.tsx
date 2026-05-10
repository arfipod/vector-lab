import type { ProgressState } from '../types';

interface ProgressBarProps {
  progress: ProgressState;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function ProgressBar({ progress }: ProgressBarProps) {
  if (!progress.active) return null;

  const determinate = !progress.indeterminate && typeof progress.value === 'number';
  const value = determinate ? clamp01(progress.value ?? 0) : 0;
  const percent = Math.round(value * 100);

  return <div className={`progress-overlay ${determinate ? 'determinate' : 'indeterminate'}`} aria-live="polite">
    <div
      className="progress-track"
      role="progressbar"
      aria-label={progress.label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={determinate ? percent : undefined}
    >
      <div className="progress-fill" style={determinate ? { transform: `scaleX(${value})` } : undefined} />
    </div>
    <div className="progress-status">
      <strong>{progress.label}</strong>
      {progress.detail ? <span>{progress.detail}</span> : null}
      {determinate ? <output>{percent}%</output> : null}
    </div>
  </div>;
}
