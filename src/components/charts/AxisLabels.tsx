import type { Measure } from '../../types';
import {
  NAME_SIZE, POLE_SIZE, NAME_CHAR, POLE_CHAR, POLE_LABEL_MIN_SIZE,
  nameText, poleText, truncate,
} from '../../utils/axisLabels';

interface Props {
  cx: number;
  cy: number;
  r: number;
  size: number;
  measures: Measure[];
}

export function AxisLabels({ cx, cy, r, size, measures }: Props) {
  const n = measures.length;
  const showPoles = size >= POLE_LABEL_MIN_SIZE;
  const cap = size * 0.75;
  const maxNameChars = Math.floor(cap / NAME_CHAR);
  const maxPoleChars = Math.floor(cap / POLE_CHAR);

  return (
    <>
      {measures.map((m, i) => {
        const a = (2 * Math.PI * i) / n - Math.PI / 2;
        const labelR = r + 14;
        const lx = cx + labelR * Math.cos(a);
        const ly = cy + labelR * Math.sin(a);
        const anchor: 'middle' | 'start' | 'end' =
          Math.cos(a) > 0.1 ? 'start' : Math.cos(a) < -0.1 ? 'end' : 'middle';

        const name = (
          <text
            x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle"
            fontSize={NAME_SIZE} fill="var(--c-text-2)" fontWeight={500}
          >
            {truncate(nameText(m), maxNameChars)}
          </text>
        );

        if (m.type === 'bipolar' && showPoles) {
          return (
            <g key={i}>
              {name}
              <text
                x={lx} y={ly + 10} textAnchor={anchor} dominantBaseline="middle"
                fontSize={POLE_SIZE} fill="var(--c-text-3)"
              >
                {truncate(poleText(m), maxPoleChars)}
              </text>
            </g>
          );
        }
        return <g key={i}>{name}</g>;
      })}
    </>
  );
}
