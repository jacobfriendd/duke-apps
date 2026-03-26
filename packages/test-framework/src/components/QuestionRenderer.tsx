import type { Question, Answer } from '@/types'
import { LikertScale } from './LikertScale'
import { ListChecks } from 'lucide-react'

interface QuestionRendererProps {
  question: Question
  answer: Answer | undefined
  onAnswer: (answer: Answer) => void
}

export function QuestionRenderer({ question, answer, onAnswer }: QuestionRendererProps) {
  switch (question.type) {
    case 'text':
      return (
        <div className="space-y-2">
          <label htmlFor={question.id} className="block text-sm font-medium text-foreground">
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <input
            id={question.id}
            type="text"
            placeholder={question.placeholder}
            value={answer?.type === 'text' ? answer.value : ''}
            onChange={(e) => onAnswer({ type: 'text', value: e.target.value })}
            className={[
              'w-full rounded-lg border border-input bg-card px-4 py-2.5 text-sm',
              'text-foreground placeholder:text-muted-foreground/60',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            ].join(' ')}
          />
        </div>
      )

    case 'textarea':
      return (
        <div className="space-y-2">
          <label htmlFor={question.id} className="block text-sm font-medium text-foreground">
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <textarea
            id={question.id}
            placeholder={question.placeholder}
            value={answer?.type === 'text' ? answer.value : ''}
            onChange={(e) => onAnswer({ type: 'text', value: e.target.value })}
            rows={3}
            className={[
              'w-full rounded-lg border border-input bg-card px-4 py-2.5 text-sm',
              'text-foreground placeholder:text-muted-foreground/60',
              'transition-colors duration-150 resize-y min-h-[80px]',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            ].join(' ')}
          />
        </div>
      )

    case 'rating':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </label>
          {question.description && (
            <p className="text-xs text-muted-foreground">{question.description}</p>
          )}
          <LikertScale
            name={question.id}
            value={answer?.type === 'rating' ? answer.value : null}
            onChange={(value) => onAnswer({ type: 'rating', value })}
            lowLabel={question.description?.includes('Disagree') ? 'Strongly Disagree' : question.description?.includes('Difficult') ? 'Very Difficult' : question.description?.includes('Confusing') ? 'Very Confusing' : question.description?.includes('Unclear') ? 'Very Unclear' : question.description?.includes('Inconvenient') ? 'Very Inconvenient' : question.description?.includes('Poor') ? 'Very Poor' : question.description?.includes('Not') ? question.description.split(',')[0].replace(/1\s*=\s*/, '').trim() : 'Low'}
            highLabel={question.description?.includes('Agree') ? 'Strongly Agree' : question.description?.includes('Easy') ? 'Very Easy' : question.description?.includes('Intuitive') ? 'Very Intuitive' : question.description?.includes('Clear') ? 'Very Clear' : question.description?.includes('Convenient') ? 'Very Convenient' : question.description?.includes('Excellent') ? 'Excellent' : question.description?.includes('Useful') ? 'Extremely Useful' : question.description?.includes('Helpful') ? 'Very Helpful' : question.description?.includes('Perfectly') ? 'Understood Perfectly' : 'High'}
          />
        </div>
      )

    case 'choice':
      return (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <div className="flex flex-col gap-2">
            {question.options.map((option) => {
              const isSelected = answer?.type === 'choice' && answer.value === option
              return (
                <label
                  key={option}
                  className={[
                    'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer',
                    'transition-all duration-150',
                    'hover:border-primary/40 hover:bg-accent/50',
                    isSelected
                      ? 'border-primary bg-accent shadow-sm'
                      : 'border-input bg-card',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={isSelected}
                    onChange={() => onAnswer({ type: 'choice', value: option })}
                    className="sr-only"
                  />
                  <div
                    className={[
                      'h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      'transition-all duration-150',
                      isSelected ? 'border-primary' : 'border-muted-foreground/40',
                    ].join(' ')}
                  >
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className="text-sm text-foreground">{option}</span>
                </label>
              )
            })}
          </div>
        </div>
      )

    case 'multi-choice':
      return (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            {question.label}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </label>
          <div className="flex flex-col gap-2">
            {question.options.map((option) => {
              const selectedValues = answer?.type === 'multi-choice' ? answer.value : []
              const isChecked = selectedValues.includes(option)
              return (
                <label
                  key={option}
                  className={[
                    'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer',
                    'transition-all duration-150',
                    'hover:border-primary/40 hover:bg-accent/50',
                    isChecked
                      ? 'border-primary bg-accent shadow-sm'
                      : 'border-input bg-card',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      const newValues = isChecked
                        ? selectedValues.filter((v) => v !== option)
                        : [...selectedValues, option]
                      onAnswer({ type: 'multi-choice', value: newValues })
                    }}
                    className="sr-only"
                  />
                  <div
                    className={[
                      'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0',
                      'transition-all duration-150',
                      isChecked
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/40 bg-card',
                    ].join(' ')}
                  >
                    {isChecked && (
                      <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-foreground">{option}</span>
                </label>
              )
            })}
          </div>
        </div>
      )

    case 'instructions':
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{question.label}</span>
          </div>
          <div className="rounded-lg border border-accent bg-accent/30 p-4">
            <ol className="space-y-2.5">
              {question.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground/90">
                  <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )

    default:
      return null
  }
}
