import { useCallback, useRef, useState } from 'react'
import { Loader2, MessageSquare, Send, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { DatasourceInfo, DatasourceTable, QueryDefinition } from '@/types/query'

interface ChatSidebarProps {
  open: boolean
  onClose: () => void
  datasource: DatasourceInfo | null
  tables: DatasourceTable[]
  definition: QueryDefinition
  onApplyDefinition: (patch: Partial<QueryDefinition>) => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
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
  const parts: string[] = []
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    try {
      const event = JSON.parse(line.slice(6))
      if (event.type === 'text-delta' && event.delta) {
        parts.push(event.delta)
      }
    } catch { /* skip */ }
  }
  return parts.join('')
}

function tryParseJsonPatch(text: string): Partial<QueryDefinition> | null {
  // Look for JSON block in the response
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (blockMatch) {
    try {
      return JSON.parse(blockMatch[1].trim())
    } catch { /* not valid JSON */ }
  }

  // Try to find a raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      // Only treat as a patch if it has query-like keys
      if (parsed.fields || parsed.criteria || parsed.joins || parsed.sortLimit || parsed.table) {
        return parsed
      }
    } catch { /* not valid JSON */ }
  }

  return null
}

export function ChatSidebar({ open, onClose, datasource, tables, definition, onApplyDefinition }: ChatSidebarProps) {
  const datasourceId = datasource?.id ?? null
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const tableList = tables.map(t => `${t.schemaId}.${t.mappingId}`).join(', ')

  const handleSubmit = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt || !datasourceId) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })

    try {
      // Search metadata using keywords from the user's message
      const keywords = prompt.split(/\s+/).slice(0, 5).join(' ')
      const metadata = await searchMetadata(datasourceId, keywords)

      // Build conversation history for context
      const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')

      const currentDef = JSON.stringify({
        datasource: definition.datasource,
        schema: definition.schema,
        table: definition.table,
        fields: definition.fields.map(f => ({ column: f.column, alias: f.alias, aggregate: f.aggregate })),
        criteria: definition.criteria,
        joins: definition.joins.map(j => ({ table: j.table, schema: j.schema, type: j.type, alias: j.alias })),
        sortLimit: definition.sortLimit,
      })

      const fullPrompt = [
        `You are a query design assistant that helps users build queries through a visual query builder.`,
        `You work with a QueryDefinition JSON structure that has: fields, criteria, joins, sortLimit.`,
        '',
        `Connected to a ${datasource?.type || 'SQL'} database. Available tables: ${tableList || 'none loaded yet'}.`,
        '',
        `Schema metadata:`,
        metadata,
        '',
        `Current query definition: ${currentDef}`,
        '',
        history ? `Conversation so far:\n${history}\n` : '',
        `User: ${prompt}`,
        '',
        `Instructions:`,
        `- If the user wants to modify the query, respond with a brief explanation followed by a JSON code block with the partial QueryDefinition patch.`,
        `- When adding fields, each needs: column (name), alias (display label), aggregate ("none"|"count"|"sum"|"avg"|"min"|"max"|"count_distinct"), and reference: { relation: "source", column: "fieldname" }.`,
        `- When adding criteria, use: type: "condition", field, operator (equals|not_equals|contains|is_null|is_not_null|in|between|greater_than|less_than), valueType: "literal", value.`,
        `- If the user is just asking a question, respond with a helpful answer (no JSON needed).`,
        `- Keep responses concise.`,
      ].join('\n')

      const response = await callCompletion(fullPrompt)

      // Check if response contains a query patch
      const patch = tryParseJsonPatch(response)
      if (patch) {
        onApplyDefinition(patch)
      }

      // Clean the response for display (remove JSON blocks)
      const displayText = response
        .replace(/```(?:json)?\s*\n?[\s\S]*?```/g, '')
        .trim() || (patch ? 'Applied changes to your query.' : response.trim())

      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: displayText }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      }
      setMessages(prev => [...prev, errorMsg])
    } finally {
      setLoading(false)
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }, [input, datasourceId, datasource?.type, tableList, messages, definition, onApplyDefinition])

  if (!open) return null

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">AI Assistant</span>
          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-600">Beta</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <MessageSquare className="mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Ask me to build your query</p>
            <p className="mt-1 text-xs text-slate-400">
              Try: "Show me all customers with orders over $100" or "Add a filter for active users"
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                <span className="text-xs text-slate-500">Thinking...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder={datasourceId ? 'Describe what to build...' : 'Choose a datasource first'}
            disabled={!datasourceId || loading}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="h-8 w-8 shrink-0 rounded-md bg-violet-600 p-0 text-white hover:bg-violet-700"
            onClick={() => void handleSubmit()}
            disabled={!input.trim() || !datasourceId || loading}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
