const STROKE_COLORS = ['#ffffff', '#e03131', '#2f9e44', '#1971c2', '#f08c00', '#ae3ec9']
const BG_COLORS     = ['transparent', '#ffa8a8', '#b2f2bb', '#a5d8ff', '#ffec99', '#e8d5fb']

const STROKE_WIDTHS = [
  { label: 'S', value: 1 },
  { label: 'M', value: 3 },
  { label: 'L', value: 6 },
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

type Props = {
  strokeColor: string
  setStrokeColor: (c: string) => void
  bgColor: string
  setBgColor: (c: string) => void
  strokeWidth: number
  setStrokeWidth: (w: number) => void
  opacity: number
  setOpacity: (o: number) => void
}

export const PropertiesPanel = ({
  strokeColor, setStrokeColor,
  bgColor, setBgColor,
  strokeWidth, setStrokeWidth,
  opacity, setOpacity,
}: Props) => {
  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-52 bg-[#232329] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 z-10">

      {/* Stroke */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400 font-medium">Stroke</span>
        <div className="flex flex-wrap gap-1.5">
          {STROKE_COLORS.map(c => (
            <Swatch key={c} color={c} selected={strokeColor === c} onClick={() => setStrokeColor(c)} />
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-white/10" />

      {/* Background */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-400 font-medium">Background</span>
        <div className="flex flex-wrap gap-1.5">
          {BG_COLORS.map(c => (
            <Swatch key={c} color={c} selected={bgColor === c} onClick={() => setBgColor(c)} />
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-white/10" />

      {/* Stroke width */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-gray-400 font-medium">Stroke width</span>
        <div className="flex gap-1.5">
          {STROKE_WIDTHS.map(w => (
            <button
              key={w.value}
              onClick={() => setStrokeWidth(w.value)}
              className={`flex-1 py-1 rounded-md text-xs font-bold border cursor-pointer transition-colors
                ${strokeWidth === w.value
                  ? 'bg-[#403e6a] text-white border-violet-500'
                  : 'text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-white/10" />

      {/* Opacity */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-xs text-gray-400 font-medium">Opacity</span>
          <span className="text-xs text-gray-500">{opacity}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={e => setOpacity(Number(e.target.value))}
          className="w-full accent-violet-500 cursor-pointer"
        />
      </div>

    </div>
  )
}