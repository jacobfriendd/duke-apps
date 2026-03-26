import { useCallback, useRef, useState } from 'react'
import { Loader2, MessageSquare, Send, X, Sparkles } from 'lucide-react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
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

export function ChatSidebar({ open, onClose, datasource, tables, definition, onApplyDefinition }: ChatSidebarProps) {
  const datasourceId = datasource?.id ?? null
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [settled, setSettled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const datasourceIdRef = useRef(datasourceId)
  datasourceIdRef.current = datasourceId
  const definitionRef = useRef(definition)
  definitionRef.current = definition
  const onApplyRef = useRef(onApplyDefinition)
  onApplyRef.current = onApplyDefinition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToolOutputRef = useRef<((opts: { tool: string; toolCallId: string; output: any }) => void) | null>(null)

  const tableList = tables.map(t => `${t.schemaId}.${t.mappingId}`).join(', ')

  const tools = {
    searchSchema: {
      description: 'Search tables, fields, and relationships by keyword. ALWAYS call this first to discover exact field names.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Keyword to search for' },
        },
        required: ['query'],
      },
    },
    applyQueryDesign: {
      description: 'Apply changes to the visual query builder. Provide a partial QueryDefinition JSON object with only the fields you want to change. The user will review and can tweak before running.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          patch: { type: 'object', description: 'Partial QueryDefinition JSON to merge into the current design' },
          explanation: { type: 'string', description: 'Brief explanation of what was changed' },
        },
        required: ['patch', 'explanation'],
      },
    },
    respondToUser: {
      description: 'Send a text response to the user. Use this to explain what you did or ask for clarification.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          message: { type: 'string', description: 'Message to display to the user' },
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
          'You are a query design assistant that helps users build queries through the visual query builder.',
          'You work with a QueryDefinition JSON structure that has: fields, criteria, joins, sortLimit, inputs, and subqueries.',
          '',
          `Connected to a ${datasource?.type || 'SQL'} database. Available tables: ${tableList || 'none loaded yet'}.`,
          '',
          `Current query definition: ${JSON.stringify({
            datasource: definition.datasource,
            schema: definition.schema,
            table: definition.table,
            fields: definition.fields.map(f => ({ column: f.column, alias: f.alias, aggregate: f.aggregate })),
            criteria: definition.criteria,
            joins: definition.joins.map(j => ({ table: j.table, schema: j.schema, type: j.type, alias: j.alias })),
            sortLimit: definition.sortLimit,
          })}`,
          '',
          'Workflow:',
          '1. searchSchema to discover exact field/table names.',
          '2. applyQueryDesign to modify the visual builder with a partial QueryDefinition patch.',
          '3. respondToUser to explain what you changed.',
          '',
          'When adding fields, each field needs: column (name), alias (display label), aggregate ("none"|"count"|"sum"|"avg"|"min"|"max"|"count_distinct"), and optionally reference: { relation: "source"|"join", column: "..." }.',
          'When adding criteria conditions, each needs: type: "condition", field, operator (equals|not_equals|contains|starts_with|ends_with|greater_than|less_than|is_null|is_not_null|in|between), valueType: "literal"|"field"|"input", value.',
          'When adding joins, each needs: table, schema, alias, type (inner|left|right|full), conditions: [{ left, right, leftRef, rightRef }].',
          '',
          'IMPORTANT: Always use searchSchema first to find exact names. Never guess column or table names.',
          'Always call respondToUser at the end to explain what was changed.',
        ].join('\n'),
      },
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    async onToolCall({ toolCall }) {
      const emit = addToolOutputRef.current!
      const dsId = datasourceIdRef.current

      if (toolCall.toolName === 'searchSchema') {
        if (!dsId) {
          emit({ tool: 'searchSchema', toolCallId: toolCall.toolCallId, output: { error: 'No datasource selected' } })
          return
        }
        const args = toolCall.input as { query: string }
        const res = await fetch(`/api/datasources/${encodeURIComponent(dsId)}/_search-metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query }),
        })
        const data = await res.json()
        emit({ tool: 'searchSchema', toolCallId: toolCall.toolCallId, output: data })
      } else if (toolCall.toolName === 'applyQueryDesign') {
        const args = toolCall.input as { patch: Partial<QueryDefinition>; explanation: string }
        onApplyRef.current(args.patch)
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: args.explanation,
        }])
        setSettled(true)
        emit({ tool: 'applyQueryDesign', toolCallId: toolCall.toolCallId, output: { success: true } })
      } else if (toolCall.toolName === 'respondToUser') {
        const args = toolCall.input as { message: string }
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: args.message,
        }])
        setSettled(true)
        emit({ tool: 'respondToUser', toolCallId: toolCall.toolCallId, output: { acknowledged: true } })
      }
    },
  })

  addToolOutputRef.current = addToolOutput

  const handleSubmit = useCallback(() => {
    const prompt = input.trim()
    if (!prompt) return

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
    }])
    setInput('')
    setSettled(false)

    sendMessage({
      parts: [{ type: 'text', text: prompt }],
    })

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [input, sendMessage])

  const isLoading = (status === 'submitted' || status === 'streaming') && !settled

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
          {isLoading && (
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
            disabled={!datasourceId || isLoading}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="h-8 w-8 shrink-0 rounded-md bg-violet-600 p-0 text-white hover:bg-violet-700"
            onClick={handleSubmit}
            disabled={!input.trim() || !datasourceId || isLoading}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
