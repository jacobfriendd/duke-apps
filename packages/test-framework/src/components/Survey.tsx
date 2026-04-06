import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import type { Answer, SurveyResponse, SectionResponse } from '@/types'
import { surveySections } from '@/data/sections'
import { ProgressBar } from './ProgressBar'
import { SectionView } from './SectionView'
import { ChevronLeft, ChevronRight, CheckCircle2, Send, AlertCircle } from 'lucide-react'

const STORAGE_KEY = 'qd-test-framework-response'

function generateId(): string {
  return `resp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function loadFromStorage(): SurveyResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SurveyResponse
  } catch {
    // ignore corrupt data
  }
  return null
}

function saveToStorage(response: SurveyResponse) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response))
  } catch {
    // storage full or unavailable
  }
}

export function Survey() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set())
  const [response, setResponse] = useState<SurveyResponse>(() => {
    const saved = loadFromStorage()
    if (saved) {
      return saved
    }
    return {
      id: generateId(),
      startedAt: new Date().toISOString(),
      sections: {},
    }
  })
  const [animating, setAnimating] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const contentRef = useRef<HTMLDivElement>(null)

  // Restore completed sections from saved response
  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) {
      const completed = new Set<string>()
      for (const sectionId of Object.keys(saved.sections)) {
        const sectionResp = saved.sections[sectionId]
        if (sectionResp && Object.keys(sectionResp.answers).length > 0) {
          completed.add(sectionId)
        }
      }
      if (saved.completedAt) {
        // If already completed, go to thank-you
        setCurrentIndex(surveySections.length - 1)
        surveySections.forEach((s) => completed.add(s.id))
      }
      setCompletedSections(completed)
    }
  }, [])

  // Auto-save on response changes
  useEffect(() => {
    saveToStorage(response)
  }, [response])

  const currentSection = surveySections[currentIndex]

  const getSectionAnswers = useCallback(
    (sectionId: string): Record<string, Answer> => {
      return response.sections[sectionId]?.answers ?? {}
    },
    [response],
  )

  const handleAnswer = useCallback(
    (questionId: string, answer: Answer) => {
      setValidationError(null)
      setResponse((prev) => {
        const sectionId = currentSection.id
        const existing: SectionResponse = prev.sections[sectionId] ?? { answers: {} }
        return {
          ...prev,
          sections: {
            ...prev.sections,
            [sectionId]: {
              answers: {
                ...existing.answers,
                [questionId]: answer,
              },
            },
          },
        }
      })
    },
    [currentSection.id],
  )

  // Check if all required questions in the current section are answered
  const getUnansweredQuestions = useCallback(() => {
    const answers = getSectionAnswers(currentSection.id)
    const unanswered: string[] = []
    for (const q of currentSection.questions) {
      if (q.type === 'instructions') continue
      // Treat all non-instruction questions as required unless explicitly optional
      const isRequired = q.required !== false
      if (!isRequired) continue
      const answer = answers[q.id]
      if (!answer) {
        unanswered.push(q.label)
        continue
      }
      // Check for empty values
      if (answer.type === 'text' && !answer.value.trim()) {
        unanswered.push(q.label)
      } else if (answer.type === 'multi-choice' && answer.value.length === 0) {
        unanswered.push(q.label)
      }
    }
    return unanswered
  }, [currentSection, getSectionAnswers])

  const navigateTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= surveySections.length || index === currentIndex) return
      setAnimating(true)
      setTimeout(() => {
        setCurrentIndex(index)
        contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        setTimeout(() => setAnimating(false), 50)
      }, 150)
    },
    [currentIndex],
  )

  const goNext = useCallback(() => {
    const unanswered = getUnansweredQuestions()
    if (unanswered.length > 0) {
      setValidationError(`Please answer: ${unanswered.join(', ')}`)
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setValidationError(null)
    setCompletedSections((prev) => new Set([...prev, currentSection.id]))
    navigateTo(currentIndex + 1)
  }, [currentIndex, currentSection.id, navigateTo, getUnansweredQuestions])

  const goPrev = useCallback(() => {
    setValidationError(null)
    navigateTo(currentIndex - 1)
  }, [currentIndex, navigateTo])

  const handleSubmit = useCallback(() => {
    const unanswered = getUnansweredQuestions()
    if (unanswered.length > 0) {
      setValidationError(`Please answer: ${unanswered.join(', ')}`)
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setValidationError(null)
    const completedAt = new Date().toISOString()
    setResponse((prev) => {
      const updated = { ...prev, completedAt }
      // Submit to server
      fetch('/api/_server/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch((err) => console.warn('Server submit failed, localStorage backup retained', err))
      return updated
    })
    setCompletedSections((prev) => {
      const next = new Set(prev)
      next.add(currentSection.id)
      return next
    })
    navigateTo(surveySections.length - 1)
  }, [currentSection.id, navigateTo, getUnansweredQuestions])

  const isFirstSection = currentIndex === 0
  const isThankYouSection = currentSection.id === 'thank-you'
  const isLastContentSection = currentIndex === surveySections.length - 2 // open-ended is last content section
  const isCompleted = !!response.completedAt

  return (
    <div className="flex flex-col min-h-screen">
      <ProgressBar
        currentIndex={currentIndex}
        completedSections={completedSections}
        onSectionClick={navigateTo}
      />

      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Section content with transition */}
          <div
            className={[
              'transition-all duration-200',
              animating ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0',
            ].join(' ')}
          >
            <SectionView
              section={currentSection}
              answers={getSectionAnswers(currentSection.id)}
              onAnswer={handleAnswer}
            />
          </div>

          {/* Validation error */}
          {validationError && (
            <div className="flex items-start gap-2.5 mt-6 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Navigation */}
          {!isThankYouSection && (
            <div className="flex items-center justify-between mt-8 pb-8">
              <div>
                {!isFirstSection && (
                  <button
                    type="button"
                    onClick={goPrev}
                    className={[
                      'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border',
                      'text-sm font-medium text-foreground bg-card',
                      'transition-all duration-150',
                      'hover:bg-secondary hover:border-border/80',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                )}
              </div>

              <div>
                {isLastContentSection ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isCompleted}
                    className={[
                      'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg',
                      'text-sm font-semibold text-primary-foreground',
                      'transition-all duration-150',
                      isCompleted
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                  >
                    <Send className="h-4 w-4" />
                    Submit Feedback
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    className={[
                      'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg',
                      'text-sm font-medium text-primary-foreground bg-primary',
                      'transition-all duration-150',
                      'hover:bg-primary/90 shadow-sm hover:shadow-md',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ].join(' ')}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Thank-you navigation back */}
          {isThankYouSection && (
            <div className="flex justify-center mt-8 pb-8">
              <button
                type="button"
                onClick={() => navigateTo(0)}
                className={[
                  'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border',
                  'text-sm font-medium text-foreground bg-card',
                  'transition-all duration-150',
                  'hover:bg-secondary',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                ].join(' ')}
              >
                <CheckCircle2 className="h-4 w-4 text-success" />
                Review My Responses
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Query Designer Test Framework
          </span>
          <span className="text-xs text-muted-foreground">
            Responses saved
          </span>
        </div>
      </div>
    </div>
  )
}
