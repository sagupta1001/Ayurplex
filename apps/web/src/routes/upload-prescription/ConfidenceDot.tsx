import type { ReactElement } from 'react';

export interface ConfidenceDotProps {
  score: number;
  size?: number;
}

function getColor(score: number): string {
  if (score > 0.8) return '#2E7D32';
  if (score >= 0.5) return '#F9A825';
  return '#C62828';
}

export function ConfidenceDot({ score, size = 10 }: ConfidenceDotProps): ReactElement {
  return (
    <span
      title={`Confidence: ${Math.round(score * 100)}%`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: getColor(score),
        marginLeft: 6,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}
