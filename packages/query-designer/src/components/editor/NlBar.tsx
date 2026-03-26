import { useCallback, useState } from 'react'
import { Loader2, Sparkles, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { generateId } from '@/lib/utils'
import type {
  DatasourceColumn,
  DatasourceInfo,
  DatasourceTable,
  QueryDefinition,
  QueryField,
  CriteriaGroup,
  CriteriaNode,
  QueryJoin,
  SortLimit,
} from '@/types/query'

interface NlBarProps {
  datasource: DatasourceInfo | null
  tables: DatasourceTable[]
  definition: QueryDefinition
  sourceColumns: DatasourceColumn[]
  onApplyDefinition: (merged: QueryDefinition) => void
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

// ── Parse & patch helpers ─────────────────────────────────────────────────

function tryParseJsonPatch(text: string): Partial<QueryDefinition> | null {
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()) } catch { /* */ }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.fields || parsed.criteria || parsed.joins || parsed.sortLimit) return parsed
    } catch { /* */ }
  }
  return null
}

function ensureFieldIds(fields: QueryField[]): QueryField[] {
  return fields.map(f => ({ ...f, id: f.id || generateId() }))
}

function ensureCriteriaIds(node: CriteriaNode): CriteriaNode {
  if (node.type === 'group') {
    return { ...node, id: node.id || generateId(), conditions: node.conditions.map(ensureCriteriaIds) }
  }
  return { ...node, id: node.id || generateId() }
}

function ensureGroupIds(group: CriteriaGroup): CriteriaGroup {
  return { ...group, id: group.id || generateId(), conditions: group.conditions.map(ensureCriteriaIds) }
}

function ensureJoinIds(joins: QueryJoin[]): QueryJoin[] {
  return joins.map(j => ({ ...j, id: j.id || generateId() }))
}

/**
 * Build a case-insensitive lookup from known column names so we can fix
 * whatever casing the AI returns (e.g. "city" → "City").
 */
function buildColumnFixMap(columns: DatasourceColumn[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const col of columns) {
    map.set(col.name.toLowerCase(), col.name)
  }
  return map
}

function fixColumnName(name: string, fixMap: Map<string, string>): string {
  return fixMap.get(name.toLowerCase()) ?? name
}

function fixFieldColumns(fields: QueryField[], fixMap: Map<string, string>): QueryField[] {
  return fields.map(f => ({
    ...f,
    column: fixColumnName(f.column, fixMap),
    reference: f.reference
      ? { ...f.reference, column: fixColumnName(f.reference.column, fixMap) }
      : f.reference,
  }))
}

function fixCriteriaColumns(node: CriteriaNode, fixMap: Map<string, string>): CriteriaNode {
  if (node.type === 'group') {
    return { ...node, conditions: node.conditions.map(c => fixCriteriaColumns(c, fixMap)) }
  }
  return {
    ...node,
    field: fixColumnName(node.field, fixMap),
    fieldRef: node.fieldRef
      ? { ...node.fieldRef, column: fixColumnName(node.fieldRef.column, fixMap) }
      : node.fieldRef,
  }
}

function fixGroupColumns(group: CriteriaGroup, fixMap: Map<string, string>): CriteriaGroup {
  return { ...group, conditions: group.conditions.map(c => fixCriteriaColumns(c, fixMap)) }
}

function applyPatch(current: QueryDefinition, patch: Partial<QueryDefinition>, columns: DatasourceColumn[]): QueryDefinition {
  const merged = { ...current }
  const fixMap = buildColumnFixMap(columns)

  if (patch.fields) merged.fields = fixFieldColumns(ensureFieldIds(patch.fields), fixMap)
  if (patch.criteria) merged.criteria = fixGroupColumns(ensureGroupIds(patch.criteria), fixMap)
  if (patch.joins) merged.joins = ensureJoinIds(patch.joins)
  if (patch.sortLimit) merged.sortLimit = patch.sortLimit as SortLimit
  if (patch.name !== undefined) merged.name = patch.name
  if (patch.description !== undefined) merged.description = patch.description
  return merged
}

// ── Schema reference for the AI ───────────────────────────────────────────

const SCHEMA_REFERENCE = `
## QueryDefinition JSON Schema

You modify the query by returning a JSON patch. The patch is merged into the current definition.
Return ONLY the keys you want to change. Every array you return REPLACES the existing array entirely,
so always include existing items you want to keep.

### fields (array of QueryField)
Each field represents a column in the SELECT clause.
{
  "column": "column_name",
  "alias": "Display Name",
  "aggregate": "none",              // "none"|"sum"|"count"|"avg"|"min"|"max"|"count_distinct"
  "reference": { "relation": "source", "column": "column_name" }
}

### criteria (CriteriaGroup — the WHERE clause)
{
  "type": "group",
  "operator": "AND",
  "conditions": [
    {
      "type": "condition",
      "field": "column_name",
      "fieldRef": { "relation": "source", "column": "column_name" },
      "operator": "equals",         // equals|not_equals|greater_than|less_than|greater_equal|
                                    // less_equal|contains|not_contains|starts_with|ends_with|
                                    // is_null|is_not_null|in|not_in|between
      "valueType": "literal",
      "value": "Berlin"
    }
  ]
}

### joins (array of QueryJoin)
{
  "table": "table_name",
  "schema": "schema_name",
  "tableId": "schema+table_name",
  "alias": "short_alias",
  "type": "inner",                  // "inner"|"left"|"right"|"full"
  "conditions": [ { "left": "source_col", "right": "joined_col" } ]
}

### sortLimit
{
  "sorts": [ { "field": "column_name", "direction": "asc", "reference": { "relation": "source", "column": "column_name" } } ],
  "limit": 100,
  "offset": 0
}

IMPORTANT RULES:
- Do NOT include "id" fields — they are auto-generated.
- Return the FULL array for any key you modify (include existing items you want to keep).
- Do NOT write SQL. Only return QueryDefinition JSON patches.
- Wrap the JSON in a \`\`\`json code block.
`.trim()

// ── Component ─────────────────────────────────────────────────────────────

export function NlBar({ datasource, tables, definition, sourceColumns, onApplyDefinition }: NlBarProps) {
  const datasourceId = datasource?.id ?? null
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const tableList = tables.map(t => `${t.schemaId}.${t.mappingId}`).join(', ')

  const handleSubmit = useCallback(async () => {
    const prompt = input.trim()
    if (!prompt || !datasourceId) return

    setLoading(true)
    setInfo(null)

    try {
      const keywords = prompt.split(/\s+/).slice(0, 5).join(' ')
      const metadata = await searchMetadata(datasourceId, keywords)

      const currentDef = JSON.stringify({
        schema: definition.schema,
        table: definition.table,
        tableId: definition.tableId,
        fields: definition.fields.map(f => ({
          column: f.column, alias: f.alias, aggregate: f.aggregate, reference: f.reference, expression: f.expression,
        })),
        criteria: definition.criteria,
        joins: definition.joins.map(j => ({
          table: j.table, schema: j.schema, tableId: j.tableId, type: j.type, alias: j.alias, conditions: j.conditions,
        })),
        sortLimit: definition.sortLimit,
      }, null, 2)

      const columnList = sourceColumns.length > 0
        ? sourceColumns.map(c => `${c.name} (${c.dataType})`).join(', ')
        : '(no columns loaded)'

      const fullPrompt = [
        `You are a query design assistant. Users describe changes in plain English and you return a QueryDefinition JSON patch.`,
        '',
        SCHEMA_REFERENCE,
        '',
        `Database type: ${datasource?.type || 'SQL'}`,
        `Available tables: ${tableList || 'none loaded yet'}`,
        '',
        `Source table: ${definition.schema}.${definition.table}`,
        `Exact column names (CASE-SENSITIVE — use these exactly): ${columnList}`,
        '',
        `Schema metadata:`,
        metadata,
        '',
        `Current query definition:`,
        '```json',
        currentDef,
        '```',
        '',
        `User: ${prompt}`,
        '',
        `CRITICAL: Column names are case-sensitive. Use the exact casing from the column list above.`,
        `Return a brief one-line explanation, then a \`\`\`json code block with the patch. No SQL.`,
      ].join('\n')

      const response = await callCompletion(fullPrompt)
      const patch = tryParseJsonPatch(response)

      if (patch) {
        const merged = applyPatch(definition, patch, sourceColumns)
        onApplyDefinition(merged)
        setInput('')
        // Show the explanation text (strip the JSON block)
        const explanation = response.replace(/```(?:json)?\s*\n?[\s\S]*?```/g, '').trim()
        setInfo(explanation || 'Applied changes.')
        setTimeout(() => setInfo(null), 4000)
      } else {
        // No JSON patch — show the response as info
        setInfo(response.trim() || 'Could not understand that request. Try being more specific.')
        setTimeout(() => setInfo(null), 6000)
      }
    } catch (err) {
      setInfo(err instanceof Error ? err.message : 'Failed to process request')
      setTimeout(() => setInfo(null), 5000)
    } finally {
      setLoading(false)
    }
  }, [input, datasourceId, datasource?.type, tableList, definition, onApplyDefinition])

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50/60 to-slate-50/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-sky-500" />
        <div className="relative flex-1">
          <Input
            placeholder={datasourceId ? 'Describe what you want to change... e.g. "only show rows where city is Berlin"' : 'Choose a datasource first'}
            disabled={!datasourceId || loading}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            className="h-8 border-sky-200/60 bg-white/80 pr-8 text-sm placeholder:text-slate-400 focus-visible:ring-sky-300"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 shrink-0 rounded-md p-0 text-sky-600 hover:bg-sky-100/60"
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
