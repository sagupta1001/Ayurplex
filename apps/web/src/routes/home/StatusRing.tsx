import type { CSSProperties, ReactElement } from 'react';

export interface StatusRingProps {
  taken: number;
  total: number;
  size?: number;
}

const TEAL = '#19AFA2';
const TRACK = '#E5F4F2';
const STROKE_WIDTH = 12;

export function StatusRing({ taken, total, size = 160 }: StatusRingProps): ReactElement {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : Math.max(0, Math.min(1, taken / total));
  const filled = circumference * ratio;
  const gap = circumference - filled;

  const labelStyle: CSSProperties = {
    fontFamily: 'Lexend, sans-serif',
    fontSize: size * 0.22,
    fontWeight: 600,
    fill: '#092C4C',
  };

  return (
    <div
      role="img"
      aria-label={`${taken} of ${total} doses taken today`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TRACK}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <circle
          data-testid="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={TEAL}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" style={labelStyle}>
          {taken}/{total}
        </text>
      </svg>
    </div>
  );
}
