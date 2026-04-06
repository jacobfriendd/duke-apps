export interface SurveyResponse {
  id: string
  startedAt: string
  completedAt?: string
  sections: Record<string, SectionResponse>
  sessionData?: unknown
}

export interface SectionResponse {
  answers: Record<string, Answer>
}

export type Answer =
  | { type: 'text'; value: string }
  | { type: 'rating'; value: number }
  | { type: 'choice'; value: string }
  | { type: 'multi-choice'; value: string[] }

export interface SurveySection {
  id: string
  title: string
  description: string
  questions: Question[]
}

export type Question =
  | { id: string; type: 'text'; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: 'textarea'; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: 'rating'; label: string; description?: string; required?: boolean }
  | { id: string; type: 'choice'; label: string; options: string[]; required?: boolean }
  | { id: string; type: 'multi-choice'; label: string; options: string[]; required?: boolean }
  | { id: string; type: 'instructions'; label: string; steps: string[] }
