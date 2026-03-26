import { useState, useEffect } from 'react'
import { Survey } from '@/components/Survey'
import { surveySections } from '@/data/sections'
import type { SurveyResponse, Answer } from '@/types'
import { ChevronLeft, ChevronDown, ChevronRight, Users, CheckCircle2, Clock, Download } from 'lucide-react'

function getRoute(): string {
  return window.location.hash.replace('#', '') || '/'
}

export default function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const onHash = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route === '/admin') return <AdminView />
  return <Survey />
}

// ─── Admin View ──────────────────────────────────────────────────────────────

interface StoredResponse {
  id: number
  response_id: string
  name: string | null
  role: string | null
  started_at: string
  completed_at: string | null
  sections: Record<string, { answers: Record<string, Answer> }>
  created_at: string
  updated_at: string
}

function AdminView() {
  const [responses, setResponses] = useState<StoredResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/_server/responses')
      .then(res => res.json())
      .then(setResponses)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const completedCount = responses.filter(r => r.completed_at).length

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function formatAnswer(answer: Answer): string {
    if (answer.type === 'rating') return `${answer.value} / 5`
    if (answer.type === 'multi-choice') return answer.value.join(', ')
    return answer.value
  }

  function exportCsv() {
    // Build header: fixed columns + one column per question
    const questionCols: { sectionId: string; questionId: string; label: string }[] = []
    for (const section of surveySections) {
      for (const q of section.questions) {
        if (q.type === 'instructions') continue
        questionCols.push({ sectionId: section.id, questionId: q.id, label: `${section.title}: ${q.label}` })
      }
    }

    const headers = ['Name', 'Role', 'Started', 'Completed', ...questionCols.map(c => c.label)]
    const rows = responses.map(r => {
      const fixed = [r.name ?? '', r.role ?? '', r.started_at, r.completed_at ?? '']
      const answers = questionCols.map(col => {
        const answer = r.sections?.[col.sectionId]?.answers?.[col.questionId]
        if (!answer) return ''
        return formatAnswer(answer)
      })
      return [...fixed, ...answers]
    })

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `survey-responses-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="#/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </a>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Survey Responses</h1>
              <p className="text-sm text-muted-foreground">Query Designer Test Framework</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {responses.length} total
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {completedCount} completed
              </span>
            </div>
            {responses.length > 0 && (
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            Loading responses...
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && responses.length === 0 && (
          <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No responses yet</p>
            <p className="text-xs text-muted-foreground">Responses will appear here after people complete the survey.</p>
          </div>
        )}

        {!loading && responses.length > 0 && (
          <div className="space-y-2">
            {responses.map(r => (
              <div key={r.response_id} className="border border-border rounded-lg bg-card overflow-hidden">
                {/* Row header */}
                <button
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                  onClick={() => setExpandedId(expandedId === r.response_id ? null : r.response_id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${r.completed_at ? 'bg-success' : 'bg-amber-400'}`} />
                    <span className="text-sm font-medium text-foreground truncate">
                      {r.name || 'Anonymous'}
                    </span>
                    {r.role && (
                      <span className="text-xs text-muted-foreground truncate">
                        — {r.role}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(r.completed_at || r.started_at)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      r.completed_at
                        ? 'bg-success/10 text-success'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.completed_at ? 'Completed' : 'In Progress'}
                    </span>
                    {expandedId === r.response_id
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />
                    }
                  </div>
                </button>

                {/* Expanded detail */}
                {expandedId === r.response_id && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    {surveySections.filter(s => s.questions.length > 0).map(section => {
                      const sectionAnswers = r.sections?.[section.id]?.answers ?? {}
                      const answered = Object.keys(sectionAnswers).filter(k => {
                        const q = section.questions.find(q => q.id === k)
                        return q && q.type !== 'instructions'
                      })
                      if (answered.length === 0) return null
                      return (
                        <div key={section.id}>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            {section.title}
                          </h3>
                          <div className="space-y-1.5">
                            {section.questions.map(q => {
                              if (q.type === 'instructions') return null
                              const answer = sectionAnswers[q.id]
                              if (!answer) return null
                              return (
                                <div key={q.id} className="flex gap-3 text-sm">
                                  <span className="text-muted-foreground min-w-0 flex-1 truncate" title={q.label}>
                                    {q.label}
                                  </span>
                                  <span className={`shrink-0 font-medium ${
                                    answer.type === 'rating'
                                      ? answer.value >= 4 ? 'text-success' : answer.value <= 2 ? 'text-destructive' : 'text-foreground'
                                      : 'text-foreground'
                                  }`}>
                                    {formatAnswer(answer)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
