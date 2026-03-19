import { useCallback, useRef, useState } from 'react';
import { Box, TextField, CircularProgress, InputAdornment, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { colors } from '../theme';
import type { Datasource, Mapping } from '../types';

interface NlBarProps {
  datasource: Datasource | null;
  mappings: Mapping[];
  selectedSql: string;
  onInsertSql: (sql: string) => void;
}

export function NlBar({ datasource, mappings, selectedSql, onInsertSql }: NlBarProps) {
  const datasourceId = datasource?.id ?? null;
  const [input, setInput] = useState('');
  const [settled, setSettled] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Refs for values needed inside onToolCall (captured at hook init time)
  const datasourceIdRef = useRef(datasourceId);
  datasourceIdRef.current = datasourceId;
  const onInsertSqlRef = useRef(onInsertSql);
  onInsertSqlRef.current = onInsertSql;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addToolOutputRef = useRef<((opts: { tool: string; toolCallId: string; output: any }) => void) | null>(null);

  const tableList = mappings.map((m) => m.mappingId).join(', ');
  const dbType = datasource?.typeName || datasource?.type || 'SQL';

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
  };

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
          `2. Write SQL using only discovered names. Quote identifiers correctly for ${dbType} (PostgreSQL: double-quote mixed-case names; MySQL: backticks).`,
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
      const emit = addToolOutputRef.current!;
      const dsId = datasourceIdRef.current;
      if (!dsId) {
        emit({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output: { error: 'No datasource selected' } });
        return;
      }

      if (toolCall.toolName === 'searchSchema') {
        const args = toolCall.input as { query: string };
        const res = await fetch(`/api/datasources/${dsId}/_search-metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query }),
        });
        const data = await res.json();
        emit({ tool: 'searchSchema', toolCallId: toolCall.toolCallId, output: data });
      } else if (toolCall.toolName === 'testSql') {
        const args = toolCall.input as { sql: string };
        try {
          const res = await fetch(`/api/datasources/${dsId}/_query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: 'sql', payload: args.sql, limit: 1, options: {} }),
          });
          const data = await res.json();
          // Extract error from any level — API may return 200 with error in body
          const errMsg = !res.ok
            ? (data.message || data.error || res.statusText)
            : (data.error || data.message);
          if (errMsg) {
            emit({ tool: 'testSql', toolCallId: toolCall.toolCallId, output: { error: errMsg } });
          } else {
            const records = Array.isArray(data) ? data : data.records || data.data || [];
            emit({
              tool: 'testSql',
              toolCallId: toolCall.toolCallId,
              output: { success: true, columns: records.length > 0 ? Object.keys(records[0]) : [] },
            });
          }
        } catch (err: any) {
          emit({ tool: 'testSql', toolCallId: toolCall.toolCallId, output: { error: err.message } });
        }
      } else if (toolCall.toolName === 'setSql') {
        const args = toolCall.input as { sql: string };
        onInsertSqlRef.current(args.sql);
        setInput('');
        setSettled(true);
        setInfo(null);
        emit({ tool: 'setSql', toolCallId: toolCall.toolCallId, output: { success: true } });
      } else if (toolCall.toolName === 'notifyUser') {
        const args = toolCall.input as { message: string };
        setInfo(args.message);
        setSettled(true);
        emit({ tool: 'notifyUser', toolCallId: toolCall.toolCallId, output: { acknowledged: true } });
      }
    },
  });

  // Keep ref in sync with the hook's addToolOutput
  addToolOutputRef.current = addToolOutput;

  const handleSubmit = useCallback(() => {
    const prompt = input.trim();
    if (!prompt || !datasourceId) return;

    setSettled(false);
    setInfo(null);

    const parts: string[] = [];
    if (tableList) parts.push(`Available tables: ${tableList}`);
    if (selectedSql) parts.push(`Current SQL (selected in editor):\n\`\`\`sql\n${selectedSql}\n\`\`\``);
    parts.push(prompt);

    sendMessage({
      parts: [{ type: 'text', text: parts.join('\n\n') }],
    });
  }, [input, datasourceId, tableList, selectedSql, sendMessage]);

  const isLoading = (status === 'submitted' || status === 'streaming') && !settled;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 0.75,
        borderBottom: `1px solid ${colors.border}`,
        bgcolor: colors.surface,
      }}
    >
      <TextField
        fullWidth
        size="small"
        placeholder={datasourceId ? 'Describe what you want to query...' : 'Select a datasource first'}
        disabled={!datasourceId || isLoading}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <AutoAwesomeIcon sx={{ fontSize: 18, color: colors.accent }} />
            </InputAdornment>
          ),
          endAdornment: isLoading ? (
            <InputAdornment position="end">
              <CircularProgress size={16} />
            </InputAdornment>
          ) : null,
          sx: {
            fontSize: '0.875rem',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.border,
            },
          },
        }}
      />
      {info && (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 0.5, color: colors.textSecondary, fontSize: '0.75rem' }}
        >
          {info}
        </Typography>
      )}
    </Box>
  );
}
