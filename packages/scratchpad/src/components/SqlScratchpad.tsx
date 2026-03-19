import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Paper, Typography, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import TableChartIcon from '@mui/icons-material/TableChart';
import CodeIcon from '@mui/icons-material/Code';
import Editor from '@monaco-editor/react';
import { Parser } from 'node-sql-parser';
import type { OnMount } from '@monaco-editor/react';
import type { editor, languages, IDisposable } from 'monaco-editor';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { DatasourcePicker } from './DatasourcePicker';
import { SchemaExplorer } from './SchemaExplorer';
import { ResultsGrid } from './ResultsGrid';
import { SaveQueryDialog, type ExportMode } from './SaveQueryDialog';
import { ScratchTabs } from './ScratchTabs';
import { NlBar } from './NlBar';
import { useDatasources } from '../hooks/useDatasources';
import { useMappings } from '../hooks/useMappings';
import { useQuery } from '../hooks/useQuery';
import { useLocalStorage, useScratches } from '../hooks/useLocalStorage';
import type { TableFields } from '../hooks/useSchemaFields';
import { colors } from '../theme';

const DEFAULT_QUERY = `-- Write your SQL query here
SELECT * FROM customers LIMIT 10;

SELECT * FROM orders LIMIT 10;`;

// SQL keywords for autocomplete
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
  'IS', 'NULL', 'TRUE', 'FALSE', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT',
  'OFFSET', 'GROUP', 'HAVING', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
  'FULL', 'CROSS', 'ON', 'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN',
  'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL', 'INSERT',
  'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP',
  'ALTER', 'INDEX', 'VIEW', 'WITH', 'RECURSIVE', 'EXISTS', 'COALESCE',
  'NULLIF', 'CAST', 'CONVERT', 'SUBSTRING', 'TRIM', 'UPPER', 'LOWER',
];

interface StatementRange {
  startLine: number;
  endLine: number;
  text: string;
}

// SQL statement starters (case insensitive)
const SQL_STARTERS = /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|EXPLAIN|TRUNCATE|GRANT|REVOKE)\b/i;

// Find the SQL statement at the cursor position
function findStatementAtCursor(
  model: editor.ITextModel,
  cursorLineNumber: number
): StatementRange | null {
  const lines = model.getLinesContent();

  // First, identify which lines belong to which statement
  // A new statement starts when:
  // 1. Previous non-blank line ended with semicolon, OR
  // 2. This line starts with a SQL keyword and previous content line didn't end with a keyword expecting continuation

  const lineToStatement: (number | null)[] = new Array(lines.length).fill(null);
  const statements: StatementRange[] = [];

  let currentStatementStart = -1;
  let currentStatementLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines and comments - they don't belong to any statement directly
    if (!trimmed || trimmed.startsWith('--')) {
      // If we have accumulated a statement and hit blank/comment,
      // check if this is a boundary
      if (currentStatementLines.length > 0) {
        // Look ahead - if next content line starts with SQL keyword, end current statement
        let nextContentLine = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrimmed = lines[j].trim();
          if (nextTrimmed && !nextTrimmed.startsWith('--')) {
            nextContentLine = nextTrimmed;
            break;
          }
        }

        if (SQL_STARTERS.test(nextContentLine)) {
          // End current statement
          const stmtText = currentStatementLines.map(idx => lines[idx]).join('\n').trim();
          statements.push({
            startLine: currentStatementStart + 1,
            endLine: currentStatementLines[currentStatementLines.length - 1] + 1,
            text: stmtText.replace(/;$/, ''),
          });
          currentStatementStart = -1;
          currentStatementLines = [];
        }
      }
      continue;
    }

    // This is a content line
    const startsWithKeyword = SQL_STARTERS.test(trimmed);
    const endsWithSemicolon = trimmed.endsWith(';');

    // Start new statement if:
    // - No current statement, OR
    // - This line starts with SQL keyword and we're not continuing
    if (currentStatementStart === -1 || (startsWithKeyword && currentStatementLines.length > 0)) {
      // If starting new but have old, save old first
      if (currentStatementLines.length > 0) {
        const stmtText = currentStatementLines.map(idx => lines[idx]).join('\n').trim();
        statements.push({
          startLine: currentStatementStart + 1,
          endLine: currentStatementLines[currentStatementLines.length - 1] + 1,
          text: stmtText.replace(/;$/, ''),
        });
      }
      currentStatementStart = i;
      currentStatementLines = [i];
    } else {
      currentStatementLines.push(i);
    }

    // Mark this line
    lineToStatement[i] = statements.length;

    // If ends with semicolon, close statement
    if (endsWithSemicolon) {
      const stmtText = currentStatementLines.map(idx => lines[idx]).join('\n').trim();
      statements.push({
        startLine: currentStatementStart + 1,
        endLine: i + 1,
        text: stmtText.replace(/;$/, ''),
      });
      currentStatementStart = -1;
      currentStatementLines = [];
    }
  }

  // Don't forget the last statement if no semicolon
  if (currentStatementLines.length > 0) {
    const stmtText = currentStatementLines.map(idx => lines[idx]).join('\n').trim();
    statements.push({
      startLine: currentStatementStart + 1,
      endLine: currentStatementLines[currentStatementLines.length - 1] + 1,
      text: stmtText.replace(/;$/, ''),
    });
  }

  // Find which statement contains the cursor
  for (const stmt of statements) {
    if (cursorLineNumber >= stmt.startLine && cursorLineNumber <= stmt.endLine) {
      return stmt;
    }
  }

  // Cursor on blank line - find nearest statement
  if (statements.length > 0) {
    let closest = statements[0];
    let minDist = Infinity;

    for (const stmt of statements) {
      const dist = cursorLineNumber < stmt.startLine
        ? stmt.startLine - cursorLineNumber
        : cursorLineNumber > stmt.endLine
        ? cursorLineNumber - stmt.endLine
        : 0;

      if (dist < minDist) {
        minDist = dist;
        closest = stmt;
      }
    }
    return closest;
  }

  return null;
}

export function SqlScratchpad() {
  const { datasources, loading: loadingDatasources, error: datasourcesError } = useDatasources();
  const { result, loading: executing, error: queryError, execute } = useQuery();

  // Persist selected datasource
  const [selectedDatasourceId, setSelectedDatasourceId] = useLocalStorage<string | null>('selectedDatasourceId', null);
  const currentStatementRef = useRef<string>('');
  const [currentStatementDisplay, setCurrentStatementDisplay] = useState<string>('');
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>('dataset');
  const [exportMenuAnchor, setExportMenuAnchor] = useState<HTMLElement | null>(null);

  // Scratches management
  const {
    scratches,
    activeScratch,
    activeScratchId,
    setActiveScratchId,
    createScratch,
    updateScratch,
    deleteScratch,
  } = useScratches();

  // Persist unsaved editor content (for when no scratch is active)
  const [unsavedContent, setUnsavedContent] = useLocalStorage<string>('unsavedContent', DEFAULT_QUERY);

  // Fetch mappings for autocomplete (fields loaded lazily via SchemaExplorer)
  const { mappings } = useMappings(selectedDatasourceId);
  const [tableFields, setTableFields] = useState<TableFields[]>([]);

  // Reset accumulated fields when datasource changes
  useEffect(() => {
    setTableFields([]);
  }, [selectedDatasourceId]);

  // Called by SchemaExplorer when a table is expanded and its fields load
  const handleFieldsLoaded = useCallback((entry: TableFields) => {
    setTableFields((prev) => {
      const exists = prev.some((tf) => tf.mapping.id === entry.mapping.id);
      if (exists) return prev;
      return [...prev, entry];
    });
  }, []);

  // Refs to avoid re-renders affecting editor
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const selectedDatasourceIdRef = useRef(selectedDatasourceId);
  const executingRef = useRef(executing);
  const completionProviderRef = useRef<IDisposable | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Track previous scratch to detect switches
  const prevScratchIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    selectedDatasourceIdRef.current = selectedDatasourceId;
  }, [selectedDatasourceId]);

  useEffect(() => {
    executingRef.current = executing;
  }, [executing]);

  // Refs for copilot tool handlers
  const resultRef = useRef(result);
  resultRef.current = result;
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;
  const queryErrorRef = useRef(queryError);
  queryErrorRef.current = queryError;
  const datasourcesRef = useRef(datasources);
  datasourcesRef.current = datasources;

  // Load scratch content into editor when switching scratches
  useEffect(() => {
    if (activeScratchId !== prevScratchIdRef.current) {
      prevScratchIdRef.current = activeScratchId;
      const ed = editorRef.current;
      if (ed) {
        const newContent = activeScratch?.sql ?? unsavedContent;
        const currentContent = ed.getValue();
        if (newContent !== currentContent) {
          ed.setValue(newContent);
        }
        // Also update datasource if scratch has one
        if (activeScratch?.datasourceId) {
          setSelectedDatasourceId(activeScratch.datasourceId);
        }
      }
    }
  }, [activeScratchId, activeScratch, unsavedContent, setSelectedDatasourceId]);

  // Auto-save content on change (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!value) return;

    // Clear pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save
    saveTimeoutRef.current = setTimeout(() => {
      if (activeScratchId && activeScratch) {
        updateScratch(activeScratchId, { sql: value, datasourceId: selectedDatasourceId });
      } else {
        setUnsavedContent(value);
      }
    }, 500);
  }, [activeScratchId, activeScratch, updateScratch, selectedDatasourceId, setUnsavedContent]);

  // SQL parser instance (reused)
  const sqlParserRef = useRef<Parser | null>(null);

  // Parse SQL to extract table aliases using node-sql-parser with regex fallback
  // Returns a map of alias -> table name
  const parseTableAliases = useCallback((sql: string): Map<string, string> => {
    const aliases = new Map<string, string>();

    // First try the SQL parser
    if (!sqlParserRef.current) {
      sqlParserRef.current = new Parser();
    }

    let parserSucceeded = false;
    try {
      // Try parsing with different dialects if one fails
      let ast;
      for (const dialect of ['postgresql', 'mysql', 'transactsql', 'sqlite'] as const) {
        try {
          ast = sqlParserRef.current.astify(sql, { database: dialect });
          break;
        } catch {
          // Try next dialect
        }
      }

      if (ast) {
        // Handle both single statement and array of statements
        const statements = Array.isArray(ast) ? ast : [ast];

        for (const stmt of statements) {
          if (!stmt || typeof stmt !== 'object') continue;

          // Extract table references from FROM clause
          const from = (stmt as unknown as Record<string, unknown>).from;
          if (Array.isArray(from)) {
            for (const tableRef of from) {
              if (tableRef && typeof tableRef === 'object') {
                const table = (tableRef as Record<string, unknown>).table as string | undefined;
                const as = (tableRef as Record<string, unknown>).as as string | undefined;

                if (table) {
                  const tableLower = table.toLowerCase();
                  // Map alias to table (or table to itself if no alias)
                  aliases.set((as || table).toLowerCase(), tableLower);
                  parserSucceeded = true;
                }
              }
            }
          }
        }
      }
    } catch {
      // Parser failed
    }

    // Fallback: use regex if parser didn't find anything
    if (!parserSucceeded) {
      // Remove comments and string literals
      const cleaned = sql
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/'[^']*'/g, "''");

      // Match: FROM/JOIN table [AS] alias
      // Handles: FROM table, FROM table alias, FROM table AS alias
      const pattern = /\b(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
      let match;

      while ((match = pattern.exec(cleaned)) !== null) {
        const table = match[1].toLowerCase();
        const alias = match[2]?.toLowerCase();

        // Skip SQL keywords that might be matched as aliases
        const keywords = new Set(['where', 'on', 'and', 'or', 'inner', 'left', 'right', 'outer', 'cross', 'join', 'select', 'order', 'group', 'having', 'limit', 'offset', 'union']);

        if (alias && !keywords.has(alias)) {
          aliases.set(alias, table);
        }
        aliases.set(table, table);
      }
    }

    return aliases;
  }, []);

  // Pre-compute range-independent suggestion templates when mappings/fields change
  // These are stamped with the correct range inside provideCompletionItems
  const suggestionTemplatesRef = useRef<{
    keywords: Omit<languages.CompletionItem, 'range'>[];
    tables: Omit<languages.CompletionItem, 'range'>[];
    fields: Omit<languages.CompletionItem, 'range'>[];
  }>({ keywords: [], tables: [], fields: [] });

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;

    const keywords = SQL_KEYWORDS.map((keyword) => ({
      label: keyword,
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: keyword,
      sortText: '2',
    }));

    const tables = mappings.map((mapping) => ({
      label: mapping.mappingId,
      kind: monaco.languages.CompletionItemKind.Class,
      insertText: mapping.mappingId,
      detail: `Table: ${mapping.name}`,
      documentation: mapping.schemaId ? `Schema: ${mapping.schemaId}` : undefined,
      sortText: '0',
    }));

    const fields: Omit<languages.CompletionItem, 'range'>[] = [];
    tableFields.forEach((tf) => {
      tf.fields.forEach((field) => {
        const fieldName = field.fieldId || field.name;
        fields.push({
          label: fieldName,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: fieldName,
          detail: `${tf.mapping.mappingId}.${fieldName}`,
          documentation: `${field.dataType}${field.description ? ' - ' + field.description : ''}`,
          sortText: '1',
        });
      });
    });

    suggestionTemplatesRef.current = { keywords, tables, fields };
  }, [mappings, tableFields]);

  // Register completion provider once, reads from refs for current data
  useEffect(() => {
    if (!monacoRef.current) return;

    // Dispose old provider
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    const monaco = monacoRef.current;

    completionProviderRef.current = monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Check if user just typed "tablename." - look for dot before current word
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        const dotMatch = textBeforeCursor.match(/(\w+)\.\s*$/);

        if (dotMatch) {
          // User typed "tablename." or "alias." - show fields
          const identifier = dotMatch[1].toLowerCase();

          // Parse the current SQL to find table aliases
          const fullSql = model.getValue();
          const aliasMap = parseTableAliases(fullSql);

          // Resolve alias to actual table name
          const resolvedTable = aliasMap.get(identifier) || identifier;

          // Try to find the table - check mappingId and name
          let tableData = tableFields.find(
            (tf) =>
              tf.mapping.mappingId.toLowerCase() === resolvedTable ||
              tf.mapping.name.toLowerCase() === resolvedTable
          );

          // Fallback: try partial match if exact match fails
          if (!tableData) {
            tableData = tableFields.find(
              (tf) =>
                tf.mapping.mappingId.toLowerCase().includes(resolvedTable) ||
                tf.mapping.name.toLowerCase().includes(resolvedTable) ||
                resolvedTable.includes(tf.mapping.mappingId.toLowerCase()) ||
                resolvedTable.includes(tf.mapping.name.toLowerCase())
            );
          }

          if (tableData) {
            return {
              suggestions: tableData.fields.map((field) => ({
                label: field.fieldId || field.name,
                kind: monaco.languages.CompletionItemKind.Field,
                insertText: field.fieldId || field.name,
                detail: field.dataType,
                documentation: field.description || (field.isPk ? 'Primary Key' : field.isFk ? 'Foreign Key' : undefined),
                range,
                sortText: field.isPk ? '0' : field.isFk ? '1' : '2',
              })),
            };
          }

          return { suggestions: [] };
        }

        // General completions - stamp pre-computed templates with current range
        const { keywords, tables, fields } = suggestionTemplatesRef.current;
        const suggestions = [
          ...keywords.map((s) => ({ ...s, range })),
          ...tables.map((s) => ({ ...s, range })),
          ...fields.map((s) => ({ ...s, range })),
        ] as languages.CompletionItem[];

        return { suggestions };
      },
    });

    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, [mappings, tableFields]);

  // Guard to prevent recursive decoration updates
  const isUpdatingDecorationsRef = useRef(false);

  // Update statement highlighting based on cursor position
  const updateStatementHighlight = useCallback(() => {
    // Prevent recursive calls
    if (isUpdatingDecorationsRef.current) return;

    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;

    const model = ed.getModel();
    const position = ed.getPosition();
    if (!model || !position) return;

    const statement = findStatementAtCursor(model, position.lineNumber);

    isUpdatingDecorationsRef.current = true;
    try {
      const text = statement?.text ?? '';
      currentStatementRef.current = text;

      // Debounce React state update for the toolbar preview
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setCurrentStatementDisplay(text), 150);

      if (statement) {
        // Update decorations to highlight the current statement
        decorationsRef.current = ed.deltaDecorations(decorationsRef.current, [
          {
            range: new monaco.Range(
              statement.startLine,
              1,
              statement.endLine,
              model.getLineMaxColumn(statement.endLine)
            ),
            options: {
              isWholeLine: true,
              className: 'current-statement-highlight',
              overviewRuler: {
                color: colors.accentLight,
                position: monaco.editor.OverviewRulerLane.Full,
              },
            },
          },
        ]);
      } else {
        decorationsRef.current = ed.deltaDecorations(decorationsRef.current, []);
      }
    } finally {
      isUpdatingDecorationsRef.current = false;
    }
  }, []);

  const handleExecute = useCallback(() => {
    if (!selectedDatasourceIdRef.current || executingRef.current) return;

    const ed = editorRef.current;
    if (!ed) return;

    const model = ed.getModel();
    const position = ed.getPosition();
    if (!model || !position) return;

    // If there's a selection, use that
    const selection = ed.getSelection();
    if (selection && !selection.isEmpty()) {
      const selectedText = model.getValueInRange(selection).trim();
      if (selectedText) {
        execute(selectedDatasourceIdRef.current, selectedText);
        return;
      }
    }

    // Otherwise, find and execute the current statement
    const statement = findStatementAtCursor(model, position.lineNumber);
    if (statement && statement.text.trim()) {
      execute(selectedDatasourceIdRef.current, statement.text);
    }
  }, [execute]);

  const handleInsertText = useCallback((text: string) => {
    const ed = editorRef.current;
    if (ed) {
      const selection = ed.getSelection();
      if (selection) {
        ed.executeEdits('schema-explorer', [
          {
            range: selection,
            text: text,
            forceMoveMarkers: true,
          },
        ]);
        ed.focus();
      }
    }
  }, []);

  const handlePreviewTable = useCallback((sql: string) => {
    const ed = editorRef.current;
    if (!ed || !selectedDatasourceIdRef.current) return;

    // Insert the SQL at the end of the editor content
    const model = ed.getModel();
    if (!model) return;

    const lastLine = model.getLineCount();
    const lastCol = model.getLineMaxColumn(lastLine);
    const currentContent = model.getValue().trimEnd();
    const prefix = currentContent ? '\n\n' : '';

    ed.executeEdits('preview-table', [{
      range: {
        startLineNumber: lastLine,
        startColumn: lastCol,
        endLineNumber: lastLine,
        endColumn: lastCol,
      },
      text: `${prefix}${sql}`,
      forceMoveMarkers: true,
    }]);

    // Move cursor to the new statement and execute
    const newLastLine = model.getLineCount();
    ed.setPosition({ lineNumber: newLastLine, column: 1 });
    ed.revealLine(newLastLine);

    execute(selectedDatasourceIdRef.current, sql.replace(/;$/, ''));
  }, [execute]);

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add CSS for statement highlighting
    const style = document.createElement('style');
    style.textContent = `
      .current-statement-highlight {
        background-color: ${colors.accentLight}22;
        border-left: 3px solid ${colors.accent};
      }
    `;
    document.head.appendChild(style);

    // Listen for cursor position changes
    editor.onDidChangeCursorPosition(() => {
      updateStatementHighlight();
    });

    // Track selection changes for NlBar context
    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      const model = editor.getModel();
      if (model && sel && !sel.isEmpty()) {
        setEditorSelection(model.getValueInRange(sel).trim());
      } else {
        setEditorSelection('');
      }
    });

    // Listen for content changes
    editor.onDidChangeModelContent(() => {
      updateStatementHighlight();
    });

    // Initial highlight
    setTimeout(updateStatementHighlight, 100);

    // Add keyboard shortcut for executing query (Ctrl/Cmd + Enter)
    editor.addAction({
      id: 'execute-query',
      label: 'Execute Current Statement',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        if (selectedDatasourceIdRef.current && !executingRef.current) {
          handleExecute();
        }
      },
    });

    editor.focus();
  }, [updateStatementHighlight, handleExecute]);

  // Register copilot tools
  useEffect(() => {
    const informer = window.__INFORMER__;
    if (!informer?.registerTool) return;

    informer.registerTool({
      name: 'getContext',
      description: 'Get current scratchpad state: datasource info, SQL at cursor, last query error, and table count.',
      schema: { type: 'object', properties: {}, additionalProperties: false },
      handler: () => {
        const dsId = selectedDatasourceIdRef.current;
        const ds = dsId ? datasourcesRef.current.find((d) => d.id === dsId) : null;
        return {
          datasourceId: dsId,
          datasourceType: ds?.typeName || ds?.type || null,
          currentSql: currentStatementRef.current,
          fullEditorContent: editorRef.current?.getValue() || '',
          lastError: queryErrorRef.current?.message || null,
          tableCount: mappingsRef.current.length,
          lastResult: resultRef.current
            ? { rowCount: resultRef.current.records.length, truncated: resultRef.current.truncated }
            : null,
        };
      },
    });

    informer.registerTool({
      name: 'searchSchema',
      description: 'Search tables, fields, and relationships by keyword using the datasource metadata index.',
      schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keyword to search for (e.g. "customer", "order date")' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      handler: async (args: { query: string }) => {
        const dsId = selectedDatasourceIdRef.current;
        if (!dsId) return { error: 'No datasource selected' };
        const res = await fetch(`/api/datasources/${dsId}/_search-metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: args.query }),
        });
        return res.json();
      },
    });

    informer.registerTool({
      name: 'getTableFields',
      description: 'Get all fields for a specific table by name.',
      schema: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Table name (mappingId) to get fields for' },
        },
        required: ['table'],
        additionalProperties: false,
      },
      handler: async (args: { table: string }) => {
        const dsId = selectedDatasourceIdRef.current;
        if (!dsId) return { error: 'No datasource selected' };
        const mapping = mappingsRef.current.find(
          (m) => m.mappingId.toLowerCase() === args.table.toLowerCase() || m.name.toLowerCase() === args.table.toLowerCase()
        );
        if (!mapping) return { error: `Table "${args.table}" not found` };
        const res = await fetch(`/api/datasources/${dsId}/mappings/${mapping.restId}/fields-list`);
        return res.json();
      },
    });

    informer.registerTool({
      name: 'runQuery',
      description: 'Execute a SQL query against the current datasource and return results.',
      schema: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'SQL query to execute' },
        },
        required: ['sql'],
        additionalProperties: false,
      },
      handler: async (args: { sql: string }) => {
        const dsId = selectedDatasourceIdRef.current;
        if (!dsId) return { error: 'No datasource selected' };
        try {
          const res = await fetch(`/api/datasources/${dsId}/_query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: 'sql', payload: args.sql, limit: 1000, options: {} }),
          });
          const data = await res.json();
          if (!res.ok) return { error: data.message || data.error || res.statusText };
          if (data.error || data.message) return { error: data.error || data.message };
          const records = Array.isArray(data) ? data : data.records || data.data || [];
          return { records, rowCount: records.length };
        } catch (err: any) {
          return { error: err.message };
        }
      },
    });

    informer.registerTool({
      name: 'insertSql',
      description: 'Insert or replace SQL in the editor.',
      schema: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: 'SQL to insert' },
          replace: { type: 'boolean', description: 'If true, replace entire editor content. Otherwise insert at cursor.' },
        },
        required: ['sql'],
        additionalProperties: false,
      },
      handler: (args: { sql: string; replace?: boolean }) => {
        const ed = editorRef.current;
        if (!ed) return { error: 'Editor not ready' };
        if (args.replace) {
          ed.setValue(args.sql);
        } else {
          handleInsertText(args.sql);
        }
        return { success: true };
      },
    });
  }, [execute, handleInsertText]);

  // "Ask AI" button handler
  const openChat = useCallback(() => {
    const ed = editorRef.current;
    const selection = ed?.getSelection();
    const selectedText = selection && !selection.isEmpty() && ed?.getModel()
      ? ed.getModel()!.getValueInRange(selection).trim()
      : '';

    window.__INFORMER__?.openChat({
      prompt: selectedText ? `Help me with this SQL:\n${selectedText}` : undefined,
      instructions: `You are a SQL copilot for a scratchpad editor. You have these tools:
- report_getContext — current datasource (including type), SQL at cursor, last error, table count
- report_searchSchema — search tables/fields/relationships by keyword
- report_getTableFields — get all fields for a specific table
- report_runQuery — execute SQL and return results
- report_insertSql — insert or replace SQL in the editor

Start by calling report_getContext to understand the current state (especially the datasourceType). Use report_searchSchema to find relevant tables and fields before writing queries. Always quote identifiers correctly for the database type — e.g. for PostgreSQL, double-quote mixed-case or reserved-word identifiers ("FieldName").`,
    });
  }, []);

  // Track selected text in editor for NlBar context
  const [editorSelection, setEditorSelection] = useState('');

  // NlBar: replace selection if present, otherwise append at end
  const handleNlInsertSql = useCallback((sql: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;

    const selection = ed.getSelection();
    if (selection && !selection.isEmpty()) {
      // Replace the selected text
      ed.executeEdits('nl-bar', [{
        range: selection,
        text: sql,
        forceMoveMarkers: true,
      }]);
    } else {
      // Append at end
      const lastLine = model.getLineCount();
      const lastCol = model.getLineMaxColumn(lastLine);
      const currentContent = model.getValue().trimEnd();
      const prefix = currentContent ? '\n\n' : '';

      ed.executeEdits('nl-bar', [{
        range: {
          startLineNumber: lastLine,
          startColumn: lastCol,
          endLineNumber: lastLine,
          endColumn: lastCol,
        },
        text: `${prefix}${sql}`,
        forceMoveMarkers: true,
      }]);

      const newLastLine = model.getLineCount();
      ed.setPosition({ lineNumber: newLastLine, column: 1 });
      ed.revealLine(newLastLine);
    }
    ed.focus();
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        bgcolor: colors.background,
      }}
    >
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: `1px solid ${colors.border}`,
          borderRadius: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img src="./favicon.svg" alt="SQL Scratchpad" width={28} height={28} style={{ borderRadius: 6 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            SQL Scratchpad
          </Typography>
          {activeScratch && (
            <Typography
              variant="body2"
              sx={{
                color: colors.textSecondary,
                bgcolor: colors.surfaceHover,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: '0.8125rem',
              }}
            >
              {activeScratch.name}
            </Typography>
          )}
        </Box>
        <DatasourcePicker
          datasources={datasources}
          selectedId={selectedDatasourceId}
          onChange={setSelectedDatasourceId}
          loading={loadingDatasources}
          error={datasourcesError}
        />
      </Paper>

      {/* Main content */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Schema Explorer Sidebar */}
        <Paper
          elevation={0}
          sx={{
            width: 260,
            borderRight: `1px solid ${colors.border}`,
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 1,
              borderBottom: `1px solid ${colors.border}`,
              bgcolor: colors.surfaceHover,
            }}
          >
            <Typography variant="subtitle2" color="text.secondary">
              Schema
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <SchemaExplorer
              datasourceId={selectedDatasourceId}
              onInsertText={handleInsertText}
              onPreviewTable={handlePreviewTable}
              onFieldsLoaded={handleFieldsLoaded}
            />
          </Box>
        </Paper>

        {/* Editor and Results */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Scratch Tabs */}
          <ScratchTabs
            scratches={scratches}
            activeScratchId={activeScratchId}
            onSelect={setActiveScratchId}
            onCreate={(name) => {
              const ed = editorRef.current;
              const currentSql = ed?.getValue() || '';
              createScratch(name, currentSql, selectedDatasourceId);
            }}
            onRename={(id, name) => updateScratch(id, { name })}
            onDelete={deleteScratch}
            onDuplicate={(scratch) => {
              createScratch(`${scratch.name} (copy)`, scratch.sql, scratch.datasourceId);
            }}
          />

          {/* NL→SQL Input Bar */}
          <NlBar
            datasource={datasources.find((d) => d.id === selectedDatasourceId) ?? null}
            mappings={mappings}
            selectedSql={editorSelection}
            onInsertSql={handleNlInsertSql}
          />

          {/* Query Editor */}
          <Box sx={{ height: '40%', minHeight: 200, p: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                border: `1px solid ${colors.border}`,
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              {/* Toolbar */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderBottom: `1px solid ${colors.border}`,
                  bgcolor: colors.surfaceHover,
                }}
              >
                <Box
                  component="button"
                  onClick={handleExecute}
                  disabled={!selectedDatasourceId || executing}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 2,
                    py: 0.75,
                    border: 'none',
                    borderRadius: 1,
                    bgcolor: executing ? colors.error : colors.success,
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: !selectedDatasourceId ? 'not-allowed' : 'pointer',
                    opacity: !selectedDatasourceId ? 0.5 : 1,
                    '&:hover': {
                      bgcolor: executing ? '#dc2626' : '#059669',
                    },
                  }}
                >
                  {executing ? 'Running...' : 'Run'}
                </Box>
                <Box
                  component="button"
                  onClick={(e) => setExportMenuAnchor(e.currentTarget as HTMLElement)}
                  disabled={!selectedDatasourceId || !currentStatementDisplay}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 2,
                    py: 0.75,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 1,
                    bgcolor: 'transparent',
                    color: colors.textSecondary,
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    cursor: !selectedDatasourceId || !currentStatementDisplay ? 'not-allowed' : 'pointer',
                    opacity: !selectedDatasourceId || !currentStatementDisplay ? 0.5 : 1,
                    '&:hover': {
                      bgcolor: colors.surfaceHover,
                      color: colors.textPrimary,
                    },
                  }}
                >
                  <FileUploadIcon sx={{ fontSize: 18 }} />
                  Export
                </Box>
                <Menu
                  anchorEl={exportMenuAnchor}
                  open={Boolean(exportMenuAnchor)}
                  onClose={() => setExportMenuAnchor(null)}
                >
                  <MenuItem onClick={() => { setExportMode('dataset'); setSaveDialogOpen(true); setExportMenuAnchor(null); }}>
                    <ListItemIcon><TableChartIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Save as Dataset</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => { setExportMode('query'); setSaveDialogOpen(true); setExportMenuAnchor(null); }}>
                    <ListItemIcon><CodeIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Save as Ad-hoc Query</ListItemText>
                  </MenuItem>
                </Menu>
                <Box
                  component="button"
                  onClick={openChat}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 2,
                    py: 0.75,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 1,
                    bgcolor: 'transparent',
                    color: colors.accent,
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: colors.accentLight + '22',
                      borderColor: colors.accent,
                    },
                  }}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 18 }} />
                  Ask AI
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    ml: 'auto',
                    maxWidth: 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                  }}
                  title={currentStatementDisplay}
                >
                  {!selectedDatasourceId
                    ? 'Select a datasource first'
                    : currentStatementDisplay
                    ? `Will run: ${currentStatementDisplay.substring(0, 60)}${currentStatementDisplay.length > 60 ? '...' : ''}`
                    : 'Ctrl+Enter to execute'}
                </Typography>
              </Box>

              {/* Editor */}
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Editor
                  height="100%"
                  language="sql"
                  defaultValue={activeScratch?.sql ?? unsavedContent}
                  onMount={handleEditorDidMount}
                  onChange={handleEditorChange}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    padding: { top: 8, bottom: 8 },
                    suggestOnTriggerCharacters: true,
                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: false,
                    },
                    acceptSuggestionOnEnter: 'on',
                    tabCompletion: 'on',
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Results Grid */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <ResultsGrid result={result} loading={executing} error={queryError} />
          </Box>
        </Box>
      </Box>

      {/* Save Query Dialog */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        sql={currentStatementDisplay}
        datasourceId={selectedDatasourceId || ''}
        mode={exportMode}
      />
    </Box>
  );
}
