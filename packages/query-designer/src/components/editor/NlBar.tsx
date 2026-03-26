import { useCallback, useState } from 'react'
import { Loader2, Sparkles, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { DatasourceInfo, DatasourceTable } from '@/types/query'

interface NlBarProps {
  datasource: DatasourceInfo | null
  tables: DatasourceTable[]
  onInsertSql: (sql: string) => void
}

async function searchMetadata(datasourceId: string, query: string): Promise<string> {
  try {
    const res = await fetch(`/api/datasources/${encodeURIComponent(datasourceId)}/_search-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return '(metadata search failed)'
    const data = await res.json()
    return JSON.stringify(data, null, 2)
  } catch {
    return '(metadata search unavailable)'
  }
}

async function callCompletion(prompt: string): Promise<string> {
  const res = await fetch('/api/models/go_everyday/_completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw new Error('AI request failed')

  const text = await res.text()
  // Parse SSE response — collect text-delta events
  const parts: string[] = []
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const event = JSON.parse(line.slice(6))
      if (event.type === 'text-delta' && event.delta) {
        parts.push(event.delta)
      }
    } catch { /* skip non-JSON lines */ }
  }
  return parts.join('')
}

function extractSql(text: string): string | null {
  // Try to extract SQL from markdown code blocks first
  const blockMatch = text.match(/```(?:sql)?\s*\n?([\s\S]*?)```/)
  if (blockMatch) return blockMatch[1].trim()

  // Try to find a SELECT/INSERT/UPDATE/DELETE/WITH statement
  const stmtMatch = text.match(/\b(SELECT|INSERT|UPDATE|DELETE|WITH)\b[\s\S]*?;?\s*$/im)
  if (stmtMatch) return stmtMatch[0].replace(/;?\s*$/, '').trim()

  return null
}

export function NlBar({ datasource, tables, onInsertSql }: NlBarProps) {
  const datasourceId = datasource?.id ?? null
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const tableList = tables.map(t => t.mappingId).join(', ')
  const dbType = datasource?.type || 'SQL'

  const handleSubmit = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt || !datasourceId) return

    setLoading(true)
    setInfo(null)

    try {
      // 1. Search schema metadata using the user's query as keywords
      const keywords = prompt.split(/\s+/).slice(0, 5).join(' ')
      const metadata = await searchMetadata(datasourceId, keywords)

      // 2. Build a single prompt with context + metadata + request
      const fullPrompt = [
        `You are a SQL generator for a ${dbType} database.`,
        `Your ONLY job is to produce a working SQL query. Output ONLY the SQL — no explanation, no markdown.`,
        '',
        `Available tables: ${tableList}`,
        '',
        `Schema metadata (from search):`,
        metadata,
        '',
        `User request: ${prompt}`,
        '',
        `Write the SQL query. Use only the table/column names from the metadata above. Quote identifiers correctly for ${dbType}. Output ONLY raw SQL, nothing else.`,
      ].join('\n')

      // 3. Get completion
      const response = await callCompletion(fullPrompt)

      // 4. Extract SQL and insert
      const sql = extractSql(response) || response.trim()
      if (sql) {
        onInsertSql(sql)
        setInput('')
        setInfo(null)
      } else {
        setInfo('Could not generate SQL from that request. Try being more specific.')
      }
    } catch (err) {
      setInfo(err instanceof Error ? err.message : 'Failed to generate query')
    } finally {
      setLoading(false)
    }
  }, [input, datasourceId, tableList, dbType, onInsertSql])

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50/60 to-sky-50/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
        <div className="relative flex-1">
          <Input
            placeholder={datasourceId ? 'Describe what you want to query in plain English...' : 'Choose a datasource first'}
            disabled={!datasourceId || loading}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            className="h-8 border-violet-200/60 bg-white/80 pr-8 text-sm placeholder:text-slate-400 focus-visible:ring-violet-300"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 shrink-0 rounded-md p-0 text-violet-600 hover:bg-violet-100/60"
          onClick={() => void handleSubmit()}
          disabled={!input.trim() || !datasourceId || loading}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
      {info && (
        <p className="mt-1 text-xs text-slate-500">{info}</p>
      )}
    </div>
  )
}
