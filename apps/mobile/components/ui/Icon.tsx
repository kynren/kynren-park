import Svg, { Path, Circle } from 'react-native-svg';

type Def = { d: string[]; circles?: [number, number, number][]; dash?: string };

const ICONS = {
  menu: { d: ['M4 7h16', 'M4 12h16', 'M4 17h10'] },
  search: { d: ['M20 20l-3.6-3.6'], circles: [[11, 11, 7]] },
  filter: { d: ['M5 4v16', 'M12 4v16', 'M19 4v16', 'M2.5 9h5', 'M9.5 15h5', 'M16.5 8h5'] },
  home: { d: ['M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'] },
  pin: { d: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z'], circles: [[12, 10, 2.5]] },
  fork: { d: ['M6.5 3v5M9.5 3v5M8 3v18M6.5 8h3', 'M16 3c-1.5 2-1.5 6 0 8.5V21M16 11.5c1.5-2.5 1.5-6.5 0-8.5'] },
  ticket: { d: ['M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z', 'M13 6v12'], dash: '1.6 2.4' },
  chevron: { d: ['M9 6l6 6-6 6'] },
  back: { d: ['M15 5l-7 7 7 7'] },
  close: { d: ['M6 6l12 12', 'M18 6L6 18'] },
  heart: { d: ['M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z'] },
  calendar: { d: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'] },
  user: { d: ['M4 21a8 8 0 0 1 16 0'], circles: [[12, 8, 4]] },
  bell: { d: ['M18 9a6 6 0 0 0-12 0c0 6-3 7-3 7h18s-3-1-3-7', 'M10.3 20a2 2 0 0 0 3.4 0'] },
  access: { d: ['M5 8.5l7 1.5 7-1.5', 'M12 10v5l-3 6', 'M12 15l3 6'], circles: [[12, 4.5, 1.6]] },
  bus: { d: ['M5 16V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v9', 'M5 16h14', 'M5 12h14', 'M8 19.5v-3', 'M16 19.5v-3'] },
  globe: { d: ['M3 12h18', 'M12 3c3 3.2 3 14.8 0 18', 'M12 3c-3 3.2-3 14.8 0 18'], circles: [[12, 12, 9]] },
  map: { d: ['M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z', 'M9 4v14', 'M15 6v14'] },
  check: { d: ['M20 6L9 17l-5-5'] },
  sliders: { d: ['M4 7h10', 'M18 7h2', 'M4 17h2', 'M10 17h10'], circles: [[16, 7, 2], [8, 17, 2]] },
  shop: { d: ['M4 9h16l-1 11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z', 'M4 9l1.5-5h13L20 9', 'M9 13a3 3 0 0 0 6 0'] },
  star: { d: ['M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'] },
  list: { d: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'] },
  grid: { d: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'] },
  scan: { d: ['M4 8V5a1 1 0 0 1 1-1h3', 'M16 4h3a1 1 0 0 1 1 1v3', 'M20 16v3a1 1 0 0 1-1 1h-3', 'M8 20H5a1 1 0 0 1-1-1v-3', 'M4 12h16'] },
} satisfies Record<string, Def>;

export type IconName = keyof typeof ICONS;

/** The app's one icon set: 24px outline glyphs that take their colour from the caller. */
export function Icon({ name, color, size = 24, strokeWidth = 1.8, filled = false }: { name: IconName; color: string; size?: number; strokeWidth?: number; filled?: boolean }) {
  const def: Def = ICONS[name];
  return (
    // position: relative so that on web an icon drawn over a gradient (absolutely positioned) is not painted underneath it.
    <Svg style={{ position: 'relative' }} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {def.d.map((d, i) => (
        <Path key={i} d={d} fill={filled && i === 0 ? color : 'none'} strokeDasharray={def.dash && i === 1 ? def.dash : undefined} />
      ))}
      {def.circles?.map(([cx, cy, r], i) => <Circle key={i} cx={cx} cy={cy} r={r} fill="none" />)}
    </Svg>
  );
}
