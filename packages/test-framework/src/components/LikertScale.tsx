import { useState } from 'react'

interface LikertScaleProps {
  name: string
  value: number | null
  onChange: (value: number) => void
  lowLabel?: string
  highLabel?: string
  scale?: number
}

const POINT_LABELS: Record<number, string[]> = {
  5: ['1', '2', '3', '4', '5'],
}

export function LikertScale({
  name,
  value,
  onChange,
  lowLabel = 'Strongly Disagree',
  highLabel = 'Strongly Agree',
  scale = 5,
}: LikertScaleProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const points = Array.from({ length: scale }, (_, i) => i + 1)
  const labels = POINT_LABELS[scale] ?? points.map(String)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{lowLabel}</span>
        <span className="text-xs text-muted-foreground">{highLabel}</span>
      </div>
      <div
        className="flex items-center justify-between gap-2"
        role="radiogroup"
        aria-label={name}
      >
        {points.map((point, idx) => {
          const isSelected = value === point
          const isHovered = hoveredPoint === point

          return (
            <button
              key={`${name}-${point}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${point} out of ${scale}`}
              onClick={() => onChange(point)}
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseLeave={() => setHoveredPoint(null)}
              onFocus={() => setHoveredPoint(point)}
              onBlur={() => setHoveredPoint(null)}
              className={[
                'flex-1 h-11 rounded-lg border-2 font-semibold text-sm',
                'transition-all duration-150 cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-md scale-105'
                  : isHovered
                    ? 'border-primary/50 bg-accent text-accent-foreground scale-102'
                    : 'border-input bg-card text-muted-foreground hover:border-primary/30',
              ].join(' ')}
            >
              {labels[idx]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
