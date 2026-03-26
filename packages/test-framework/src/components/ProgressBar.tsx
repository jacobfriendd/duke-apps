import { surveySections } from '@/data/sections'

interface ProgressBarProps {
  currentIndex: number
  completedSections: Set<string>
  onSectionClick: (index: number) => void
}

export function ProgressBar({ currentIndex, completedSections, onSectionClick }: ProgressBarProps) {
  const total = surveySections.length
  const progressPercent = total > 1 ? (currentIndex / (total - 1)) * 100 : 0

  return (
    <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            Query Designer Test Framework
          </h1>
          <span className="text-xs text-muted-foreground">
            Section {currentIndex + 1} of {total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Section pills */}
        <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1 -mx-1 px-1">
          {surveySections.map((section, index) => {
            const isActive = index === currentIndex
            const isCompleted = completedSections.has(section.id)
            const isPast = index < currentIndex

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionClick(index)}
                className={[
                  'px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all duration-150',
                  'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : isCompleted
                      ? 'bg-accent text-accent-foreground font-medium'
                      : isPast
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50',
                ].join(' ')}
              >
                {section.title}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
