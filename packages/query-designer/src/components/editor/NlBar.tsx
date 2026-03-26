import { useCallback, useRef, useState } from 'react'
import { Loader2, Sparkles, Send } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { DatasourceInfo, DatasourceTable } from '@/types/query'

interface NlBarProps {
  datasource: DatasourceInfo | null
  tables: DatasourceTable[]
  onInsertSql: (sql: string) => void
}

export function NlBar({ datasource, tables, onInsertSql }: NlBarProps) {
  const datasourceId = datasource?.id ?? null
  const [input, setInput] = useState('')
  const [settled, setSettled] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const datasourceIdRef = useRef(datasourceId)
  datasourceIdRef.current = datasourceId
  const onInsertSqlRef = useRef(onInsertSql)
  onInsertSqlRef.current = onInsertSql
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToolOutputRef = useRef<((opts: { tool: string; toolCallId: string; output: any }) => void) | null>(null)

  const tableList = tables.map(t => t.mappingId).join(', ')
  const dbType = datasource?.type || 'SQL'

  const tools = {
    searchSchema: {
      description: 'Search tables, fields, and relationships by keyword. ALWAYS call this first to discover exact field names — never guess.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Keyword to search for' },
        },
        required: ['query'],
      },
    },
    testSql: {
      description: 'Test a SQL query by running it with LIMIT 1. Returns column names on success or an error message on failure. If it fails, fix the query and call testSql again.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          sql: { type: 'string', description: 'SQL query to test (LIMIT 1 will be enforced)' },
        },
        required: ['sql'],
      },
    },
    setSql: {
      description: 'Deliver the final validated SQL query to the user. Call this ONLY after testSql succeeds.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          sql: { type: 'string', description: 'The final SQL query to insert into the editor' },
        },
        required: ['sql'],
      },
    },
    notifyUser: {
      description: 'Show a short message to the user. Use ONLY if you cannot produce a query (e.g. no matching tables found). Never use this to ask questions — just explain what went wrong.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          message: { type: 'string', description: 'Short message to display (one sentence)' },
        },
        required: ['message'],
      },
    },
  }

  const { sendMessage, addToolOutput, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/models/go_everyday/_chat',
      body: {
        tools,
        system: [
          `You are a SQL generator for a ${dbType} database. Your ONLY job is to produce a working SQL query. You MUST use tools — never respond with plain text.`,
          '',
          'Workflow:',
          '1. searchSchema — find exact table and field names. Never guess or invent names.',
          `2. Write SQL using only discovered names. Quote identifiers correctly for ${dbType}.`,
          '3. testSql — validate with LIMIT 1. If it errors, fix and re-test (max 3 attempts).',
          '4. setSql — deliver the final query (without the test LIMIT).',
          '',
          'If the request is vague, make your best guess and write the most useful query you can. Include all relevant columns. NEVER ask the user to clarify — just write the query.',
          'If you truly cannot proceed (e.g. no matching tables exist), call notifyUser with a short explanation.',
          'NEVER respond with plain text. ALWAYS end by calling either setSql or notifyUser.',
        ].join('\n'),
      },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      const emit = addToolOutputRef.current!
      const dsId = datasourceIdRef.current
      if (!dsId) {
        emit({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: { error: 'No datasource selected' } })
        return
      }

      if (toolCall.toolName === 'searchSchema') {
        const args = toolCall.input as { query: string }
        const res = await fetch(`/api/datasources/${encodeURIComponent(dsId)}/_search-metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query }),
        })
        const data = await res.json()
        emit({ tool: 'searchSchema', toolCallId: toolCall.toolCallId, output: data })
      } else if (toolCall.toolName === 'testSql') {
        const args = toolCall.input as { sql: string }
        try {
          const res = await fetch(`/api/datasources/${encodeURIComponent(dsId)}/_query?output=json&limit=1`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: 'sql', payload: args.sql }),
          })
          const data = await res.json()
          const errMsg = !res.ok
            ? (data.message || data.error || res.statusText)
            : (data.error || data.message)
          if (errMsg) {
            emit({ tool: 'testSql', toolCallId: toolCall.toolCallId, output: { error: errMsg } })
          } else {
            const records = Array.isArray(data) ? data : data.records || data.data || []
            emit({
              tool: 'testSql',
              toolCallId: toolCall.toolCallId,
              output: { success: true, columns: records.length > 0 ? Object.keys(records[0]) : [] },
            })
          }
        } catch (err: unknown) {
          emit({ tool: 'testSql', toolCallId: toolCall.toolCallId, output: { error: err instanceof Error ? err.message : 'Unknown error' } })
        }
      } else if (toolCall.toolName === 'setSql') {
        const args = toolCall.input as { sql: string }
        onInsertSqlRef.current(args.sql)
        setInput('')
        setSettled(true)
        setInfo(null)
        emit({ tool: 'setSql', toolCallId: toolCall.toolCallId, output: { success: true } })
      } else if (toolCall.toolName === 'notifyUser') {
        const args = toolCall.input as { message: string }
        setInfo(args.message)
        setSettled(true)
        emit({ tool: 'notifyUser', toolCallId: toolCall.toolCallId, output: { acknowledged: true } })
      }
    },
  })

  addToolOutputRef.current = addToolOutput

  const handleSubmit = useCallback(() => {
    const prompt = input.trim()
    if (!prompt || !datasourceId) return

    setSettled(false)
    setInfo(null)

    const parts: string[] = []
    if (tableList) parts.push(`Available tables: ${tableList}`)
    parts.push(prompt)

    sendMessage({
      parts: [{ type: 'text', text: parts.join('\n\n') }],
    })
  }, [input, datasourceId, tableList, sendMessage])

  const isLoading = (status === 'submitted' || status === 'streaming') && !settled

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-violet-50/60 to-sky-50/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
        <div className="relative flex-1">
          <Input
            placeholder={datasourceId ? 'Describe what you want to query in plain English...' : 'Choose a datasource first'}
            disabled={!datasourceId || isLoading}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className="h-8 border-violet-200/60 bg-white/80 pr-8 text-sm placeholder:text-slate-400 focus-visible:ring-violet-300"
          />
          {isLoading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 shrink-0 rounded-md p-0 text-violet-600 hover:bg-violet-100/60"
          onClick={handleSubmit}
          disabled={!input.trim() || !datasourceId || isLoading}
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
