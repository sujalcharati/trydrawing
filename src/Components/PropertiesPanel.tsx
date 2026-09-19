import type { ReactNode } from 'react'

export type StrokeStyle = 'solid' | 'dashed' | 'dotted'
export type FontFamily  = 'hand' | 'sans' | 'mono'
export type TextAlign   = 'left' | 'center' | 'right'

export type Style = {
  strokeColor: string
  backgroundColor: string
  strokeWidth: number
  strokeStyle: StrokeStyle
  opacity: number
  fontSize: number
  fontFamily: FontFamily
  textAlign: TextAlign
}

export const DEFAULT_STYLE: Style = {
  strokeColor: '#ffffff',
  backgroundColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 100,
  fontSize: 20,
  fontFamily: 'sans',
  textAlign: 'left',
}

export const FONT_STACKS: Record<FontFamily, string> = {
  hand: '"Segoe Print", "Comic Sans MS", cursive',
  sans: 'sans-serif',
  mono: 'Consolas, "Courier New", monospace',
}

export type Field = 'stroke' | 'background' | 'strokeWidth' | 'strokeStyle' | 'opacity' | 'fontFamily' | 'fontSize' | 'textAlign'

// Which properties each element type exposes (mirrors Excalidraw)
export function fieldsFor(type: string | null): Field[] {
  switch (type) {
    case 'rectangle': case 'diamond': case 'ellipse':
      return ['stroke', 'background', 'strokeWidth', 'strokeStyle', 'opacity']
    case 'line': case 'arrow':
      return ['stroke', 'strokeWidth', 'strokeStyle', 'opacity']
    case 'pen':
      return ['stroke', 'strokeWidth', 'opacity']
    case 'text':
      return ['stroke', 'fontFamily', 'fontSize', 'textAlign', 'opacity']
    default:
      return []
  }
}

const STROKE_COLORS = ['#ffffff', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#ae3ec9']
const BG_COLORS     = ['transparent', '#ffa8a8', '#b2f2bb', '#a5d8ff', '#ffec99', '#e8d5fb']

const STROKE_WIDTHS = [
  { label: 'Thin', value: 1 },
  { label: 'Bold', value: 2 },
  { label: 'Extra', value: 4 },
]

const STROKE_STYLES: { value: StrokeStyle; dash: string }[] = [
  { value: 'solid',  dash: '' },
  { value: 'dashed', dash: '6 4' },
  { value: 'dotted', dash: '1 4' },
]

const FONT_SIZES = [
  { label: 'S', value: 16 },
  { label: 'M', value: 20 },
  { label: 'L', value: 28 },
  { label: 'XL', value: 36 },
]

const FONT_FAMILIES: { value: FontFamily; label: string }[] = [
  { value: 'hand', label: 'Draw' },
  { value: 'sans', label: 'Normal' },
  { value: 'mono', label: 'Code' },
]

const ALIGNS: { value: TextAlign; lines: [number, number][] }[] = [
  { value: 'left',   lines: [[2, 12], [2, 8], [2, 12], [2, 8]] },
  { value: 'center', lines: [[2, 12], [4, 10], [2, 12], [4, 10]] },
  { value: 'right',  lines: [[2, 12], [6, 12], [2, 12], [6, 12]] },
]

const Swatch = ({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{ background: color === 'transparent' ? undefined : color }}
    className={`w-6 h-6 rounded-md border-2 cursor-pointer transition-all
      ${color === 'transparent' ? 'bg-transparent border-dashed border-gray-500 hover:border-gray-300' : ''}
      ${selected ? 'border-white scale-110' : 'border-transparent hover:border-gray-400'}
      ${color === '#ffffff' && !selected ? 'border-gray-500' : ''}
    `}
  />
)

const OptionButton = ({ selected, onClick, children, style }: {
  selected: boolean; onClick: () => void; children: ReactNode; style?: React.CSSProperties
}) => (
  <button
    onClick={onClick}
    style={style}
    className={`flex-1 py-1 rounded-md text-xs font-bold border cursor-pointer transition-colors flex items-center justify-center
      ${selected
        ? 'bg-[#403e6a] text-white border-violet-500'
        : 'text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
      }`}
  >
    {children}
  </button>
)

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs text-gray-400 font-medium">{title}</span>
    {children}
  </div>
)

type Props = {
  fields: Field[]
  values: Style
  onChange: (patch: Partial<Style>) => void
}

export const PropertiesPanel = ({ fields, values, onChange }: Props) => {
  if (!fields.length) return null
  const has = (f: Field) => fields.includes(f)

  const sections: ReactNode[] = []

  if (has('stroke')) sections.push(
    <Section key="stroke" title="Stroke">
      <div className="flex flex-wrap gap-1.5">
        {STROKE_COLORS.map(c => (
          <Swatch key={c} color={c} selected={values.strokeColor === c} onClick={() => onChange({ strokeColor: c })} />
        ))}
      </div>
    </Section>
  )

  if (has('background')) sections.push(
    <Section key="background" title="Background">
      <div className="flex flex-wrap gap-1.5">
        {BG_COLORS.map(c => (
          <Swatch key={c} color={c} selected={values.backgroundColor === c} onClick={() => onChange({ backgroundColor: c })} />
        ))}
      </div>
    </Section>
  )

  if (has('strokeWidth')) sections.push(
    <Section key="strokeWidth" title="Stroke width">
      <div className="flex gap-1.5">
        {STROKE_WIDTHS.map(w => (
          <OptionButton key={w.value} selected={values.strokeWidth === w.value} onClick={() => onChange({ strokeWidth: w.value })}>
            {w.label}
          </OptionButton>
        ))}
      </div>
    </Section>
  )

  if (has('strokeStyle')) sections.push(
    <Section key="strokeStyle" title="Stroke style">
      <div className="flex gap-1.5">
        {STROKE_STYLES.map(s => (
          <OptionButton key={s.value} selected={values.strokeStyle === s.value} onClick={() => onChange({ strokeStyle: s.value })}>
            <svg width="28" height="8" viewBox="0 0 28 8">
              <line x1="1" y1="4" x2="27" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={s.dash} />
            </svg>
          </OptionButton>
        ))}
      </div>
    </Section>
  )

  if (has('fontFamily')) sections.push(
    <Section key="fontFamily" title="Font family">
      <div className="flex gap-1.5">
        {FONT_FAMILIES.map(f => (
          <OptionButton
            key={f.value}
            selected={values.fontFamily === f.value}
            onClick={() => onChange({ fontFamily: f.value })}
            style={{ fontFamily: FONT_STACKS[f.value] }}
          >
            {f.label}
          </OptionButton>
        ))}
      </div>
    </Section>
  )

  if (has('fontSize')) sections.push(
    <Section key="fontSize" title="Font size">
      <div className="flex gap-1.5">
        {FONT_SIZES.map(f => (
          <OptionButton key={f.value} selected={values.fontSize === f.value} onClick={() => onChange({ fontSize: f.value })}>
            {f.label}
          </OptionButton>
        ))}
      </div>
    </Section>
  )

  if (has('textAlign')) sections.push(
    <Section key="textAlign" title="Text align">
      <div className="flex gap-1.5">
        {ALIGNS.map(a => (
          <OptionButton key={a.value} selected={values.textAlign === a.value} onClick={() => onChange({ textAlign: a.value })}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              {a.lines.map(([x1, x2], i) => (
                <line key={i} x1={x1} y1={3 + i * 3.3} x2={x2} y2={3 + i * 3.3} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ))}
            </svg>
          </OptionButton>
        ))}
      </div>
    </Section>
  )

  if (has('opacity')) sections.push(
    <Section key="opacity" title="Opacity">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-500 self-end">{values.opacity}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={values.opacity}
          onChange={e => onChange({ opacity: Number(e.target.value) })}
          className="w-full accent-violet-500 cursor-pointer"
        />
      </div>
    </Section>
  )

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-52 bg-[#232329] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 z-10">
      {sections.flatMap((s, i) => i === 0 ? [s] : [<div key={`d${i}`} className="w-full h-px bg-white/10" />, s])}
    </div>
  )
}
