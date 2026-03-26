import { useCallback, useRef, useState } from 'react'
import { Loader2, MessageSquare, Send, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { generateId } from '@/lib/utils'
import type {
  DatasourceInfo,
  DatasourceTable,
  QueryDefinition,
  QueryField,
  CriteriaGroup,
  CriteriaNode,
  QueryJoin,
  SortLimit,
} from '@/types/query'

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
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (blockMatch) {
    try {
      return JSON.parse(blockMatch[1].trim())
    } catch { /* not valid JSON */ }
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.fields || parsed.criteria || parsed.joins || parsed.sortLimit || parsed.table) {
        return parsed
      }
    } catch { /* not valid JSON */ }
  }

  return null
}

// ── Ensure every entity in the patch has an `id` ──────────────────────────

function ensureFieldIds(fields: QueryField[]): QueryField[] {
  return fields.map(f => ({ ...f, id: f.id || generateId() }))
}

function ensureCriteriaIds(node: CriteriaNode): CriteriaNode {
  if (node.type === 'group') {
    return {
      ...node,
      id: node.id || generateId(),
      conditions: node.conditions.map(ensureCriteriaIds),
    }
  }
  return { ...node, id: node.id || generateId() }
}

function ensureGroupIds(group: CriteriaGroup): CriteriaGroup {
  return {
    ...group,
    id: group.id || generateId(),
    conditions: group.conditions.map(ensureCriteriaIds),
  }
}

function ensureJoinIds(joins: QueryJoin[]): QueryJoin[] {
  return joins.map(j => ({ ...j, id: j.id || generateId() }))
}

/**
 * Takes the AI's raw patch and the current definition, produces a merged
 * QueryDefinition that the ribbon/compiler can understand.
 *
 * Strategy per key:
 *  - fields: replace with patch (AI returns full desired field list)
 *  - criteria: replace with patch (AI returns full criteria tree)
 *  - joins: replace with patch (AI returns full join list)
 *  - sortLimit: replace with patch
 *  - scalar props (name, description, etc.): overwrite
 */
function applyPatch(
  current: QueryDefinition,
  patch: Partial<QueryDefinition>,
): QueryDefinition {
  const merged = { ...current }

  if (patch.fields) {
    merged.fields = ensureFieldIds(patch.fields)
  }
  if (patch.criteria) {
    merged.criteria = ensureGroupIds(patch.criteria)
  }
  if (patch.joins) {
    merged.joins = ensureJoinIds(patch.joins)
  }
  if (patch.sortLimit) {
    merged.sortLimit = patch.sortLimit as SortLimit
  }
  if (patch.name !== undefined) merged.name = patch.name
  if (patch.description !== undefined) merged.description = patch.description

  return merged
}

// ── System prompt schema reference ────────────────────────────────────────

const SCHEMA_REFERENCE = `
## QueryDefinition JSON Schema

You modify the query by returning a JSON patch. The patch is merged into the current definition.
Return ONLY the keys you want to change. Every array you return REPLACES the existing array entirely,
so always include existing items you want to keep.

### fields (array of QueryField)
Each field represents a column in the SELECT clause and appears in the ribbon's Columns tab.
{
  "column": "column_name",          // actual DB column name
  "alias": "Display Name",          // shown in UI and used as output header
  "aggregate": "none",              // "none"|"sum"|"count"|"avg"|"min"|"max"|"count_distinct"
  "reference": {
    "relation": "source",           // "source" = main table, "join" = joined table
    "relationId": "",               // empty for source, join id for joined tables
    "column": "column_name"         // same as column above
  }
}

### criteria (CriteriaGroup — the WHERE clause, shown in the ribbon's Filters tab)
{
  "type": "group",
  "operator": "AND",                // "AND" | "OR"
  "conditions": [                   // array of conditions or nested groups
    {
      "type": "condition",
      "field": "column_name",       // the column to filter on
      "fieldRef": { "relation": "source", "column": "column_name" },
      "operator": "equals",         // operators: equals, not_equals, greater_than, less_than,
                                    //   greater_equal, less_equal, contains, not_contains,
                                    //   starts_with, ends_with, is_null, is_not_null, in, not_in, between
      "valueType": "literal",       // "literal" | "field" | "input"
      "value": "Berlin"             // the filter value (string always)
    }
  ]
}

### joins (array of QueryJoin — shown in the ribbon's Joins tab)
{
  "table": "table_name",            // the table to join
  "schema": "schema_name",          // schema of the joined table
  "tableId": "schema+table_name",   // restId format
  "alias": "short_alias",           // unique alias for this join
  "type": "inner",                  // "inner"|"left"|"right"|"full"
  "conditions": [
    { "left": "source_column", "right": "joined_column" }
  ]
}

### sortLimit (shown in the ribbon's Sort & Limit tab)
{
  "sorts": [
    { "field": "column_name", "direction": "asc", "reference": { "relation": "source", "column": "column_name" } }
  ],
  "limit": 100,                     // optional
  "offset": 0                       // optional
}

IMPORTANT RULES:
- Do NOT include "id" fields — they are auto-generated.
- Return the FULL array for any key you modify (fields, criteria.conditions, joins, sorts).
  For example, to ADD a filter, return the entire criteria object including existing conditions plus the new one.
- To REMOVE something, return the array without that item.
- Do NOT write SQL. Only return QueryDefinition JSON patches.
- Wrap the JSON in a \`\`\`json code block.
`.trim()

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
      const keywords = prompt.split(/\s+/).slice(0, 5).join(' ')
      const metadata = await searchMetadata(datasourceId, keywords)

      const history = messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')

      // Send the full current definition so the AI can see existing fields/criteria/joins
      const currentDef = JSON.stringify({
        schema: definition.schema,
        table: definition.table,
        tableId: definition.tableId,
        fields: definition.fields.map(f => ({
          column: f.column,
          alias: f.alias,
          aggregate: f.aggregate,
          reference: f.reference,
          expression: f.expression,
        })),
        criteria: definition.criteria,
        joins: definition.joins.map(j => ({
          table: j.table,
          schema: j.schema,
          tableId: j.tableId,
          type: j.type,
          alias: j.alias,
          conditions: j.conditions,
        })),
        sortLimit: definition.sortLimit,
      }, null, 2)

      const fullPrompt = [
        `You are a query design assistant for a visual query builder. Users describe what they want in plain English and you modify the query by returning a QueryDefinition JSON patch.`,
        '',
        SCHEMA_REFERENCE,
        '',
        `## Current context`,
        `Database type: ${datasource?.type || 'SQL'}`,
        `Available tables: ${tableList || 'none loaded yet'}`,
        '',
        `Schema metadata (columns, types, relationships):`,
        metadata,
        '',
        `Current query definition:`,
        '```json',
        currentDef,
        '```',
        '',
        history ? `Conversation so far:\n${history}\n` : '',
        `User: ${prompt}`,
        '',
        `Respond with a brief explanation of what you're changing, then a \`\`\`json code block with the patch. If the user is just asking a question, answer without JSON.`,
      ].join('\n')

      const response = await callCompletion(fullPrompt)

      const patch = tryParseJsonPatch(response)
      if (patch) {
        const merged = applyPatch(definition, patch)
        onApplyDefinition(merged)
      }

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
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
            <Sparkles className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-800">AI Assistant</span>
          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-600">Beta</span>
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
              Try: "Only show rows where city is Berlin" or "Add a count of orders grouped by customer"
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
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
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
            className="h-8 w-8 shrink-0 rounded-md bg-sky-600 p-0 text-white hover:bg-sky-700"
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
