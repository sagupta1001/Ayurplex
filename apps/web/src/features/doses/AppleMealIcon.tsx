import type { ReactElement } from 'react';
import type { MealRelationship } from '@ayurplex/shared';

export interface AppleMealIconProps {
  relationship: MealRelationship;
  size?: number;
  title?: string;
}

const LABELS: Record<MealRelationship, string> = {
  before: 'Take before meal',
  with: 'Take with meal',
  after: 'Take after meal',
  any: 'Take any time',
};

export function AppleMealIcon({
  relationship,
  size = 24,
  title,
}: AppleMealIconProps): ReactElement {
  const label = title ?? LABELS[relationship];
  const isAny = relationship === 'any';

  const bodyFill = isAny ? '#4D9999' : '#19AFA2';
  const stemFill = isAny ? '#4D9999' : '#007972';
  const leafFill = isAny ? '#4D9999' : '#6EC07A';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      data-testid="apple-meal-icon"
      data-relationship={relationship}
    >
      {/* Apple body */}
      <circle cx={12} cy={14} r={8} fill={bodyFill} />

      {/* Stem */}
      <rect x={11} y={4} width={2} height={4} fill={stemFill} />

      {/* Leaf */}
      <ellipse
        cx={14}
        cy={5}
        rx={2}
        ry={1}
        fill={leafFill}
        transform="rotate(30 14 5)"
      />

      {/* Variant markers */}
      {relationship === 'before' && (
        /* Left-pointing triangle at x=2, y=12, w=4, h=4 */
        <polygon
          points="6,12 2,14 6,16"
          fill={stemFill}
        />
      )}

      {relationship === 'after' && (
        /* Right-pointing triangle at x=18, y=12, w=4, h=4 */
        <polygon
          points="18,12 22,14 18,16"
          fill={stemFill}
        />
      )}

      {relationship === 'with' && (
        /* Fork overlay: two vertical lines in center */
        <>
          <line x1={11} y1={14} x2={11} y2={19} stroke="#FFFFFF" strokeWidth={1.5} />
          <line x1={13} y1={14} x2={13} y2={19} stroke="#FFFFFF" strokeWidth={1.5} />
        </>
      )}
    </svg>
  );
}
