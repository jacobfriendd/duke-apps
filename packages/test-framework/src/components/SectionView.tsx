import type { SurveySection, Answer } from '@/types'
import { QuestionRenderer } from './QuestionRenderer'
import { CheckCircle2, ClipboardList } from 'lucide-react'

interface SectionViewProps {
  section: SurveySection
  answers: Record<string, Answer>
  onAnswer: (questionId: string, answer: Answer) => void
}

export function SectionView({ section, answers, onAnswer }: SectionViewProps) {
  const isThankYou = section.id === 'thank-you'
  const isWelcome = section.id === 'welcome'

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Section header */}
      <div className={[
        'px-6 py-6 border-b border-border/60',
        isThankYou ? 'text-center' : '',
      ].join(' ')}>
        {isThankYou && (
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </div>
        )}
        {isWelcome && (
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-8 w-8 text-primary" />
            </div>
          </div>
        )}
        <h2 className={[
          'font-bold text-foreground',
          isThankYou || isWelcome ? 'text-2xl text-center' : 'text-xl',
        ].join(' ')}>
          {section.title}
        </h2>
        <p className={[
          'mt-2 text-sm text-muted-foreground leading-relaxed',
          isThankYou || isWelcome ? 'text-center text-base' : '',
        ].join(' ')}>
          {section.description}
        </p>
      </div>

      {/* Questions */}
      {section.questions.length > 0 && (
        <div className="px-6 py-6 space-y-8">
          {section.questions.map((question) => (
            <QuestionRenderer
              key={question.id}
              question={question}
              answer={answers[question.id]}
              onAnswer={(answer) => onAnswer(question.id, answer)}
            />
          ))}
        </div>
      )}

      {/* Comparison section note */}
      {section.id === 'comparison' && (
        <div className="mx-6 -mt-2 mb-6 rounded-lg bg-accent/50 border border-accent p-3">
          <p className="text-xs text-accent-foreground">
            If you haven't used the old Informer Query Designer, feel free to skip the comparison questions and proceed to the next section.
          </p>
        </div>
      )}
    </div>
  )
}
