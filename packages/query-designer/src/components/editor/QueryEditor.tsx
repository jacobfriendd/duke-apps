import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowUpDown,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  Code2,
  Columns3,
  Copy,
  Database,
  Download,
  Filter,
  GitMerge,
  GripVertical,
  HelpCircle,
  Layers3,
  Loader2,
  PanelTop,
  PencilLine,
  Play,
  Plus,
  Redo2,
  Search,
  Sigma,
  Sparkles,
  TableProperties,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NlBar } from './NlBar'
import { TabbedResults } from './TabbedResults'
import { useQueryEditor } from '@/hooks/useQueryEditor'
import {
  createQuery,
  executeDatasourceSql,
  getDatasourceColumns,
  getDatasourceRelations,
  getDatasourceTables,
  listDatasources,
  updateQuery,
} from '@/lib/api'
import { emptyGroup, newQueryDefinition } from '@/lib/defaults'
import { compileQuerySql } from '@/lib/sql-compiler'
import { decompileSql } from '@/lib/sql-decompiler'
import { cn, generateId } from '@/lib/utils'
import type {
  AggregateFunction,
  ComparisonOperator,
  CriteriaCondition,
  DatasourceColumn,
  DatasourceInfo,
  DatasourceRelation,
  DatasourceTable,
  JoinType,
  QueryDefinition,
  QueryRecord,
  QueryReference,
  SortField,
  SqlDialect,
  Subquery,
} from '@/types/query'

interface Props {
  record: QueryRecord | null
  onBack: () => void
  onSaved: (record: QueryRecord) => void
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type RibbonTab = 'home' | 'columns' | 'filters' | 'joins' | 'sort' | 'subselects'
type FieldDialogMode = 'column' | 'aggregate' | 'formula'
type StageId = 'main' | string

interface ColumnOption {
  key: string
  label: string
  caption: string
  sourceLabel: string
  reference: QueryReference
  raw: string
}

interface SourceDraft {
  datasource: string
  tableId: string
}

interface FieldForm {
  referenceKey: string
  alias: string
  aggregate: AggregateFunction
  expression: string
}

interface FilterForm {
  fieldKey: string
  operator: ComparisonOperator
  valueType: 'literal' | 'field'
  value: string
  valueKey: string
  value2: string
}

interface JoinForm {
  tableId: string
  type: JoinType
  alias: string
  conditions: Array<{ id: string; leftKey: string; rightKey: string }>
}

interface SortForm {
  fieldKey: string
  direction: 'asc' | 'desc'
  limit: string
}

const AGGREGATES: { value: AggregateFunction; label: string }[] = [
  { value: 'none', label: 'No summary' },
  { value: 'count', label: 'Count rows' },
  { value: 'count_distinct', label: 'Count unique values' },
  { value: 'sum', label: 'Sum values' },
  { value: 'avg', label: 'Average values' },
  { value: 'min', label: 'Lowest value' },
  { value: 'max', label: 'Highest value' },
]

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: 'equals', label: 'is exactly' },
  { value: 'not_equals', label: 'is not' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'greater_equal', label: 'is at least' },
  { value: 'less_than', label: 'is less than' },
  { value: 'less_equal', label: 'is at most' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
  { value: 'between', label: 'is between' },
  { value: 'is_null', label: 'is blank' },
  { value: 'is_not_null', label: 'is not blank' },
]

const NO_VALUE_OPERATORS: ComparisonOperator[] = ['is_null', 'is_not_null']

function normalizeDefinition(record: QueryRecord | null): QueryDefinition {
  const base = newQueryDefinition(record?.name ?? 'Untitled Query')
  const definition = record?.definition

  if (!definition) return base

  return {
    ...base,
    ...definition,
    description: definition.description ?? '',
    datasourceId: definition.datasourceId ?? '',
    datasourceLabel: definition.datasourceLabel ?? '',
    schema: definition.schema ?? '',
    table: definition.table ?? '',
    tableId: definition.tableId ?? '',
    tableLabel: definition.tableLabel ?? '',
    fields: definition.fields ?? [],
    criteria: definition.criteria ?? emptyGroup(),
    joins: definition.joins ?? [],
    sortLimit: definition.sortLimit ?? { sorts: [] },
    inputs: definition.inputs ?? [],
    flowSteps: definition.flowSteps ?? [],
    subqueries: (definition.subqueries ?? []).map(subquery => ({
      ...subquery,
      source: subquery.source ?? 'main',
      fields: subquery.fields ?? [],
      criteria: subquery.criteria ?? emptyGroup(),
      joins: subquery.joins ?? [],
      sortLimit: subquery.sortLimit ?? { sorts: [] },
    })),
  }
}

function getSourceTableId(definition: QueryDefinition) {
  if (definition.tableId) return definition.tableId
  if (definition.schema && definition.table) return `${definition.schema}+${definition.table}`
  return ''
}

function getActiveStage(definition: QueryDefinition, stageId: StageId): Subquery | null {
  if (stageId === 'main') return null
  return definition.subqueries.find(item => item.id === stageId) ?? null
}

function makeOptionKey(reference: QueryReference) {
  return `${reference.relation}:${reference.relationId ?? 'source'}:${reference.column}`
}

function uniqueLabel(base: string, used: string[]) {
  const taken = new Set(used.map(item => item.toLowerCase()))
  const seed = base.trim() || 'Column'
  if (!taken.has(seed.toLowerCase())) return seed

  let index = 2
  while (taken.has(`${seed} ${index}`.toLowerCase())) {
    index += 1
  }

  return `${seed} ${index}`
}

function sourceLabel(definition: QueryDefinition) {
  if (definition.tableLabel) return definition.tableLabel
  if (definition.schema && definition.table) return `${definition.schema}.${definition.table}`
  return 'Choose a table'
}

function buildCacheKey(datasourceId: string, tableId: string) {
  return `${datasourceId}::${tableId}`
}

function emptyFieldForm(): FieldForm {
  return { referenceKey: '', alias: '', aggregate: 'none', expression: '' }
}

function emptyFilterForm(): FilterForm {
  return { fieldKey: '', operator: 'equals', valueType: 'literal', value: '', valueKey: '', value2: '' }
}

function emptyJoinForm(): JoinForm {
  return {
    tableId: '',
    type: 'left',
    alias: '',
    conditions: [{ id: generateId(), leftKey: '', rightKey: '' }],
  }
}

function emptySortForm(limit?: number): SortForm {
  return { fieldKey: '', direction: 'asc', limit: limit ? String(limit) : '' }
}

export function QueryEditor({ record, onBack, onSaved }: Props) {
  const initial = normalizeDefinition(record)
  const { definition, dispatch, setDefinition, setName, undo, redo, canUndo, canRedo } = useQueryEditor(initial)

  const [dbId, setDbId] = useState<number | null>(record?.id ?? null)
  const [activeStageId, setActiveStageId] = useState<StageId>('main')
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('home')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(initial.name)

  const [datasources, setDatasources] = useState<DatasourceInfo[]>([])
  const [datasourcesLoading, setDatasourcesLoading] = useState(false)
  const [tables, setTables] = useState<DatasourceTable[]>([])
  const [, setTablesLoading] = useState(false)
  const [relations, setRelations] = useState<DatasourceRelation[]>([])
  const [sourceColumns, setSourceColumns] = useState<DatasourceColumn[]>([])
  const [, setSourceColumnsLoading] = useState(false)
  const [columnCache, setColumnCache] = useState<Record<string, DatasourceColumn[]>>({})

  const [betaAiEnabled, setBetaAiEnabled] = useState(false)


  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewUpdatedAt, setPreviewUpdatedAt] = useState<string>('')
  const [sqlPanelOpen, setSqlPanelOpen] = useState(true)
  const [sqlDraft, setSqlDraft] = useState('')
  const [sqlEditing, setSqlEditing] = useState(false)
  const [sqlParseError, setSqlParseError] = useState<string | null>(null)

  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [sourceDraft, setSourceDraft] = useState<SourceDraft>({ datasource: '', tableId: '' })
  const [sourceDraftTables, setSourceDraftTables] = useState<DatasourceTable[]>([])
  const [sourceDraftLoading, setSourceDraftLoading] = useState(false)

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false)
  const [fieldDialogMode, setFieldDialogMode] = useState<FieldDialogMode>('column')
  const [fieldForm, setFieldForm] = useState<FieldForm>(emptyFieldForm())

  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [columnPickerSearch, setColumnPickerSearch] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [filterForm, setFilterForm] = useState<FilterForm>(emptyFilterForm())
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null)

  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [joinForm, setJoinForm] = useState<JoinForm>(emptyJoinForm())

  const [sortDialogOpen, setSortDialogOpen] = useState(false)
  const [sortForm, setSortForm] = useState<SortForm>(emptySortForm())

  const [subqueryDialogOpen, setSubqueryDialogOpen] = useState(false)
  const [subqueryAlias, setSubqueryAlias] = useState('')

  const previewRequest = useRef(0)

  const activeSubquery = getActiveStage(definition, activeStageId)
  const isMainStage = activeStageId === 'main'
  const activeFields = useMemo(
    () => (isMainStage ? definition.fields : activeSubquery?.fields ?? []),
    [activeSubquery?.fields, definition.fields, isMainStage]
  )
  const activeCriteria = useMemo(
    () => (isMainStage ? definition.criteria : activeSubquery?.criteria ?? emptyGroup()),
    [activeSubquery?.criteria, definition.criteria, isMainStage]
  )
  const activeJoins = useMemo(
    () => (isMainStage ? definition.joins : activeSubquery?.joins ?? []),
    [activeSubquery?.joins, definition.joins, isMainStage]
  )
  const activeSortLimit = useMemo(
    () => (isMainStage ? definition.sortLimit : activeSubquery?.sortLimit ?? { sorts: [] }),
    [activeSubquery?.sortLimit, definition.sortLimit, isMainStage]
  )
  const target = activeStageId
  const selectedSourceTableId = getSourceTableId(definition)

  useEffect(() => {
    const validStageIds = new Set(['main', ...definition.subqueries.map(item => item.id)])
    if (!validStageIds.has(activeStageId)) {
      setActiveStageId('main')
    }
  }, [activeStageId, definition.subqueries])

  useEffect(() => {
    setNameInput(definition.name)
  }, [definition.name])

  // ── Auto-save on definition change (debounced 1.2s) ─────────────────
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isSaving = useRef(false)

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return
      if (event.key === 'z' && !event.shiftKey) { event.preventDefault(); undo() }
      if (event.key === 'z' && event.shiftKey) { event.preventDefault(); redo() }
      if (event.key === 'y') { event.preventDefault(); redo() }
      if (event.key === 's') { event.preventDefault() } // prevent browser save dialog
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  useEffect(() => {
    let cancelled = false
    setDatasourcesLoading(true)

    listDatasources()
      .then(items => {
        if (!cancelled) setDatasources(items)
      })
      .finally(() => {
        if (!cancelled) setDatasourcesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!definition.datasource || !datasources.length || definition.datasourceLabel) return
    const current = datasources.find(item => item.id === definition.datasource || item.naturalId === definition.datasource)
    if (current) {
      dispatch({
        type: 'SET_DATASOURCE_META',
        payload: {
          datasource: current.naturalId,
          datasourceId: current.id,
          datasourceLabel: current.name,
        },
      })
    }
  }, [datasources, definition.datasource, definition.datasourceLabel, dispatch])

  useEffect(() => {
    if (!definition.datasource) {
      setTables([])
      setRelations([])
      setSourceColumns([])
      return
    }

    let cancelled = false
    setTablesLoading(true)

    Promise.all([getDatasourceTables(definition.datasource), getDatasourceRelations(definition.datasource)])
      .then(([tableRows, relationRows]) => {
        if (cancelled) return
        setTables(tableRows)
        setRelations(relationRows)
      })
      .finally(() => {
        if (!cancelled) setTablesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [definition.datasource])

  useEffect(() => {
    if (!definition.schema || !definition.table || definition.tableId || tables.length === 0) return
    const match = tables.find(item => item.schemaId === definition.schema && item.mappingId === definition.table)
    if (match) {
      dispatch({
        type: 'SET_TABLE_META',
        payload: {
          schema: match.schemaId,
          table: match.mappingId,
          tableId: match.restId,
          tableLabel: match.name,
        },
      })
    }
  }, [definition.schema, definition.table, definition.tableId, dispatch, tables])

  useEffect(() => {
    if (!definition.datasource || !selectedSourceTableId) {
      setSourceColumns([])
      return
    }

    let cancelled = false
    setSourceColumnsLoading(true)

    getDatasourceColumns(definition.datasource, selectedSourceTableId)
      .then(columns => {
        if (!cancelled) setSourceColumns(columns)
      })
      .finally(() => {
        if (!cancelled) setSourceColumnsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [definition.datasource, selectedSourceTableId])

  const ensureColumns = useCallback(async (datasourceId: string, tableId: string) => {
    const key = buildCacheKey(datasourceId, tableId)
    if (columnCache[key]) return columnCache[key]
    const columns = await getDatasourceColumns(datasourceId, tableId)
    setColumnCache(current => ({ ...current, [key]: columns }))
    return columns
  }, [columnCache])

  useEffect(() => {
    if (!definition.datasource || activeJoins.length === 0) return
    const missing = activeJoins.filter(join => join.tableId && !columnCache[buildCacheKey(definition.datasource, join.tableId)])
    if (missing.length === 0) return

    Promise.all(missing.map(join => ensureColumns(definition.datasource, join.tableId || '')))
      .catch(() => null)
  }, [activeJoins, columnCache, definition.datasource, ensureColumns])

  useEffect(() => {
    if (!sourceDialogOpen) return
    setSourceDraft({ datasource: definition.datasource, tableId: selectedSourceTableId })
  }, [definition.datasource, selectedSourceTableId, sourceDialogOpen])

  useEffect(() => {
    if (!sourceDialogOpen || !sourceDraft.datasource) {
      setSourceDraftTables([])
      return
    }

    let cancelled = false
    setSourceDraftLoading(true)

    getDatasourceTables(sourceDraft.datasource)
      .then(rows => {
        if (!cancelled) setSourceDraftTables(rows)
      })
      .finally(() => {
        if (!cancelled) setSourceDraftLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sourceDialogOpen, sourceDraft.datasource])

  useEffect(() => {
    if (!joinDialogOpen || !definition.datasource || !joinForm.tableId) return
    void ensureColumns(definition.datasource, joinForm.tableId)
  }, [definition.datasource, ensureColumns, joinDialogOpen, joinForm.tableId])

  const availableColumnOptions = useMemo(() => {
    const sourceOptionsForStage = (stageId: StageId, trail = new Set<string>()): ColumnOption[] => {
      if (stageId === 'main') {
        return sourceColumns.map(column => ({
          key: makeOptionKey({ relation: 'source', column: column.name }),
          label: column.label,
          caption: `${sourceLabel(definition)} · ${column.dataType}`,
          sourceLabel: sourceLabel(definition),
          reference: { relation: 'source' as const, column: column.name },
          raw: column.name,
        }))
      }

      if (trail.has(stageId)) return []
      const stage = definition.subqueries.find(item => item.id === stageId)
      if (!stage) return []

      if (stage.fields.length > 0) {
        return stage.fields.map(field => ({
          key: makeOptionKey({ relation: 'source', column: field.alias || field.column }),
          label: field.alias || field.column,
          caption: `${stage.alias} · previous stage output`,
          sourceLabel: stage.alias,
          reference: { relation: 'source' as const, column: field.alias || field.column },
          raw: field.alias || field.column,
        }))
      }

      return sourceOptionsForStage(stage.source || 'main', new Set([...trail, stageId]))
    }

    const sourceOptions = isMainStage ? sourceOptionsForStage('main') : sourceOptionsForStage(activeSubquery?.source || 'main')
    const joinOptions = activeJoins.flatMap(join => {
      const cacheKey = join.tableId ? buildCacheKey(definition.datasource, join.tableId) : ''
      const columns = cacheKey ? columnCache[cacheKey] ?? [] : []
      const joinLabel = join.alias || join.tableLabel || join.table || 'Join'
      return columns.map(column => ({
        key: makeOptionKey({ relation: 'join', relationId: join.id, column: column.name }),
        label: column.label,
        caption: `${joinLabel} · ${column.dataType}`,
        sourceLabel: joinLabel,
        reference: { relation: 'join' as const, relationId: join.id, column: column.name },
        raw: column.name,
      }))
    })

    return [...sourceOptions, ...joinOptions]
  }, [activeJoins, activeSubquery, columnCache, definition, isMainStage, sourceColumns])

  const columnOptionMap = useMemo(
    () => Object.fromEntries(availableColumnOptions.map(option => [option.key, option])) as Record<string, ColumnOption>,
    [availableColumnOptions]
  )

  const joinTable = useMemo(
    () => sourceDraftTables.find(item => item.restId === joinForm.tableId) ?? tables.find(item => item.restId === joinForm.tableId) ?? null,
    [joinForm.tableId, sourceDraftTables, tables]
  )

  const joinTableColumns = useMemo(() => {
    if (!definition.datasource || !joinForm.tableId) return []
    return columnCache[buildCacheKey(definition.datasource, joinForm.tableId)] ?? []
  }, [columnCache, definition.datasource, joinForm.tableId])

  const suggestedRelations = useMemo(() => {
    if (!isMainStage || !selectedSourceTableId) return []
    return relations.filter(relation => relation.from.includes(selectedSourceTableId))
  }, [isMainStage, relations, selectedSourceTableId])

  const currentDatasource = useMemo(
    () => datasources.find(d => d.id === definition.datasource || d.naturalId === definition.datasource) ?? null,
    [datasources, definition.datasource]
  )
  const dialect: SqlDialect = currentDatasource?.dialect ?? 'postgresql'

  const compiled = useMemo(
    () => compileQuerySql(definition, activeStageId, dialect),
    [activeStageId, definition, dialect]
  )

  // Sync SQL draft from compiler when not manually editing
  useEffect(() => {
    if (!sqlEditing) {
      setSqlDraft(compiled.sql || '')
      setSqlParseError(null)
    }
  }, [compiled.sql, sqlEditing])

  const applySqlEdit = useCallback(() => {
    const result = decompileSql(sqlDraft, sourceColumns)
    if (result.errors.length > 0) {
      setSqlParseError(result.errors[0])
      return
    }
    const patch = result.patch
    const merged = { ...definition, ...patch }
    setDefinition(merged)
    setSqlEditing(false)
    setSqlParseError(null)
  }, [sqlDraft, sourceColumns, definition, setDefinition])

  const cancelSqlEdit = useCallback(() => {
    setSqlDraft(compiled.sql || '')
    setSqlEditing(false)
    setSqlParseError(null)
  }, [compiled.sql])

  const resultsEmptyState = useMemo(() => {
    if (!definition.datasource) {
      return {
        title: 'Choose a datasource to begin',
        description: 'Start on the Home tab, choose a datasource, then pick the table or view you want to explore.',
      }
    }

    if (!selectedSourceTableId) {
      return {
        title: 'Pick a starting table',
        description: 'Once you choose a table, the ribbon can start generating raw SQL and loading preview data.',
      }
    }

    if (compiled.errors.length > 0) {
      return {
        title: 'Finish this stage',
        description: compiled.errors[0],
      }
    }

    return undefined
  }, [compiled.errors, definition.datasource, selectedSourceTableId])

  const runPreview = useCallback(async (sql: string) => {
    if (!definition.datasource || !sql) return

    const requestId = ++previewRequest.current
    setPreviewLoading(true)
    setPreviewError(null)

    try {
      const result = await executeDatasourceSql(definition.datasource, sql, 100)
      if (requestId !== previewRequest.current) return
      setPreviewRows(result.rows)
      setPreviewUpdatedAt(new Date().toLocaleTimeString())
    } catch (error) {
      if (requestId !== previewRequest.current) return
      setPreviewRows([])
      setPreviewError(error instanceof Error ? error.message : 'Could not run query preview')
    } finally {
      if (requestId === previewRequest.current) setPreviewLoading(false)
    }
  }, [definition.datasource])

  useEffect(() => {
    if (!definition.datasource || !compiled.sql) {
      setPreviewRows([])
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    if (compiled.errors.length > 0) {
      setPreviewRows([])
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    const handle = window.setTimeout(() => {
      void runPreview(compiled.sql)
    }, 350)

    return () => {
      window.clearTimeout(handle)
    }
  }, [compiled.errors, compiled.sql, definition.datasource, runPreview])

  useEffect(() => {
    // Don't auto-save until the query has a datasource picked
    if (!definition.datasource) return

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      if (isSaving.current) return
      void (async () => {
        isSaving.current = true
        setSaveStatus('saving')
        try {
          let saved: QueryRecord
          if (dbId) {
            saved = await updateQuery(dbId, definition)
          } else {
            saved = await createQuery(definition)
            setDbId(saved.id)
          }
          onSaved(saved)
          setSaveStatus('saved')
          window.setTimeout(() => setSaveStatus('idle'), 1800)
        } catch {
          setSaveStatus('error')
          window.setTimeout(() => setSaveStatus('idle'), 2200)
        } finally {
          isSaving.current = false
        }
      })()
    }, 1200)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition])

  function commitName() {
    setName(nameInput.trim() || definition.name)
    setEditingName(false)
  }

  function handleApplySource() {
    const datasource = datasources.find(item => item.id === sourceDraft.datasource || item.naturalId === sourceDraft.datasource)
    const table = sourceDraftTables.find(item => item.restId === sourceDraft.tableId)
    if (!datasource || !table) return

    const next = newQueryDefinition(definition.name)
    next.id = definition.id
    next.description = definition.description ?? ''
    next.datasource = datasource.naturalId
    next.datasourceId = datasource.id
    next.datasourceLabel = datasource.name
    next.schema = table.schemaId
    next.table = table.mappingId
    next.tableId = table.restId
    next.tableLabel = table.name

    setDefinition(next)
    setActiveStageId('main')
    setSourceDialogOpen(false)
  }

  function openColumnPicker() {
    setColumnPickerSearch('')
    setColumnPickerOpen(true)
  }

  function isColumnSelected(optionKey: string): boolean {
    const option = columnOptionMap[optionKey]
    if (!option) return false
    return activeFields.some(f =>
      f.reference?.relation === option.reference.relation &&
      f.reference?.relationId === option.reference.relationId &&
      f.column === option.raw
    )
  }

  function toggleColumn(optionKey: string) {
    const option = columnOptionMap[optionKey]
    if (!option) return

    const existing = activeFields.find(f =>
      f.reference?.relation === option.reference.relation &&
      f.reference?.relationId === option.reference.relationId &&
      f.column === option.raw
    )

    if (existing) {
      dispatch({ type: 'REMOVE_FIELD', target, fieldId: existing.id })
    } else {
      dispatch({
        type: 'ADD_FIELD',
        target,
        field: {
          column: option.raw,
          alias: uniqueLabel(option.label, activeFields.map(f => f.alias || f.column)),
          aggregate: 'none',
          reference: option.reference,
        },
      })
    }
  }

  function handleColumnDrop(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    const reordered = [...activeFields]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    dispatch({ type: 'REORDER_FIELDS', target, fields: reordered })
  }

  // Group available columns by source for the picker
  const groupedColumns = useMemo(() => {
    const groups = new Map<string, ColumnOption[]>()
    for (const option of availableColumnOptions) {
      const group = groups.get(option.sourceLabel) ?? []
      group.push(option)
      groups.set(option.sourceLabel, group)
    }
    return groups
  }, [availableColumnOptions])

  function openFieldDialog(mode: FieldDialogMode) {
    setFieldDialogMode(mode)
    setFieldForm({
      ...emptyFieldForm(),
      aggregate: mode === 'aggregate' ? 'count' : 'none',
    })
    setFieldDialogOpen(true)
  }

  function handleAddField() {
    if (fieldDialogMode === 'formula') {
      if (!fieldForm.expression.trim()) return
      dispatch({
        type: 'ADD_FIELD',
        target,
        field: {
          column: fieldForm.expression.trim(),
          alias: uniqueLabel(fieldForm.alias.trim() || 'Calculated Field', activeFields.map(field => field.alias || field.column)),
          aggregate: 'none',
          expression: fieldForm.expression.trim(),
        },
      })
      setFieldDialogOpen(false)
      return
    }

    const option = columnOptionMap[fieldForm.referenceKey]
    if (!option) return

    dispatch({
      type: 'ADD_FIELD',
      target,
      field: {
        column: option.raw,
        alias: uniqueLabel(fieldForm.alias.trim() || option.label, activeFields.map(field => field.alias || field.column)),
        aggregate: fieldForm.aggregate,
        reference: option.reference,
      },
    })
    setFieldDialogOpen(false)
  }

  function conditionLabel(condition: CriteriaCondition): string {
    const fieldLabel = condition.fieldRef
      ? (columnOptionMap[makeOptionKey(condition.fieldRef)]?.label ?? condition.field)
      : condition.field
    const op = OPERATORS.find(o => o.value === condition.operator)?.label ?? condition.operator
    if (NO_VALUE_OPERATORS.includes(condition.operator)) return `${fieldLabel} ${op}`
    return `${fieldLabel} ${op} ${condition.value}`
  }

  function openFilterForEdit(condition: CriteriaCondition) {
    const fieldKey = condition.fieldRef ? makeOptionKey(condition.fieldRef) : ''
    const valueKey = condition.valueRef ? makeOptionKey(condition.valueRef) : ''
    setFilterForm({
      fieldKey,
      operator: condition.operator,
      valueType: condition.valueType as 'literal' | 'field',
      value: condition.value,
      valueKey,
      value2: condition.value2 ?? '',
    })
    setEditingConditionId(condition.id)
    setFilterDialogOpen(true)
  }

  function handleAddFilter() {
    const field = columnOptionMap[filterForm.fieldKey]
    if (!field) return
    const compareField = filterForm.valueType === 'field' ? columnOptionMap[filterForm.valueKey] : undefined

    if (editingConditionId) {
      dispatch({
        type: 'UPDATE_CONDITION',
        target,
        condition: {
          id: editingConditionId,
          type: 'condition',
          field: field.raw,
          fieldRef: field.reference,
          operator: filterForm.operator,
          valueType: filterForm.valueType,
          value: filterForm.valueType === 'field' ? compareField?.raw ?? '' : filterForm.value,
          valueRef: filterForm.valueType === 'field' ? compareField?.reference : undefined,
          value2: filterForm.operator === 'between' ? filterForm.value2 : undefined,
        },
      })
    } else {
      dispatch({
        type: 'ADD_CONDITION',
        target,
        condition: {
          field: field.raw,
          fieldRef: field.reference,
          operator: filterForm.operator,
          valueType: filterForm.valueType,
          value: filterForm.valueType === 'field' ? compareField?.raw ?? '' : filterForm.value,
          valueRef: filterForm.valueType === 'field' ? compareField?.reference : undefined,
          value2: filterForm.operator === 'between' ? filterForm.value2 : undefined,
        },
      })
    }
    setFilterDialogOpen(false)
    setFilterForm(emptyFilterForm())
    setEditingConditionId(null)
  }

  function addSuggestedJoin(relation: DatasourceRelation) {
    const restId = relation.to[0]
    const table = tables.find(item => item.restId === restId)
    if (!table) return

    const joinId = generateId()
    dispatch({
      type: 'ADD_JOIN',
      target,
      join: {
        id: joinId,
        table: table.mappingId,
        tableId: table.restId,
        tableLabel: table.name,
        schema: table.schemaId,
        alias: table.mappingId,
        type: 'left',
        conditions: relation.defn.map(rule => ({
          left: rule.fromField,
          leftRef: { relation: 'source', column: rule.fromField },
          right: rule.toField,
          rightRef: { relation: 'join', relationId: joinId, column: rule.toField },
        })),
      },
    })
  }

  function handleAddJoin() {
    const table = tables.find(item => item.restId === joinForm.tableId)
    if (!table) return

    const joinId = generateId()
    const conditions = joinForm.conditions
      .map(condition => {
        const left = columnOptionMap[condition.leftKey]
        const right = joinTableColumns.find(column => column.name === condition.rightKey)
        if (!left || !right) return null
        return {
          left: left.raw,
          leftRef: left.reference,
          right: right.name,
          rightRef: { relation: 'join', relationId: joinId, column: right.name } as QueryReference,
        }
      })
      .filter(Boolean)

    if (conditions.length === 0) return

    dispatch({
      type: 'ADD_JOIN',
      target,
      join: {
        id: joinId,
        table: table.mappingId,
        tableId: table.restId,
        tableLabel: table.name,
        schema: table.schemaId,
        alias: joinForm.alias.trim() || table.mappingId,
        type: joinForm.type,
        conditions,
      },
    })
    setJoinDialogOpen(false)
    setJoinForm(emptyJoinForm())
  }

  function handleAddSort() {
    const option = columnOptionMap[sortForm.fieldKey]
    const limit = Number.parseInt(sortForm.limit, 10)

    if (option) {
      const sort: SortField = {
        field: option.raw,
        label: option.label,
        reference: option.reference,
        direction: sortForm.direction,
      }

      dispatch({ type: 'ADD_SORT', target, sort })
    }

    dispatch({ type: 'SET_LIMIT', target, limit: Number.isFinite(limit) && limit > 0 ? limit : undefined })
    setSortDialogOpen(false)
  }

  function handleAddSubquery() {
    const alias = subqueryAlias.trim()
    if (!alias) return
    const id = generateId()
    // Auto-chain: new sub-select reads from the last step (or main)
    const lastStep = definition.subqueries.length > 0
      ? definition.subqueries[definition.subqueries.length - 1].id
      : 'main'
    dispatch({ type: 'ADD_SUBQUERY', alias, id, source: lastStep })
    setActiveStageId(id)
    setSubqueryAlias('')
    setSubqueryDialogOpen(false)
  }

  function handleAddSubqueryPreset(preset: 'summarize' | 'filter' | 'top_n') {
    const stepNum = definition.subqueries.length + 2
    const presetNames: Record<string, string> = {
      summarize: `step_${stepNum}_summarize`,
      filter: `step_${stepNum}_filter`,
      top_n: `step_${stepNum}_top`,
    }
    const id = generateId()
    const lastStep = definition.subqueries.length > 0
      ? definition.subqueries[definition.subqueries.length - 1].id
      : 'main'
    dispatch({ type: 'ADD_SUBQUERY', alias: presetNames[preset], id, source: lastStep })
    setActiveStageId(id)
    setSubqueryDialogOpen(false)
    // Switch to the appropriate ribbon tab for the preset
    if (preset === 'summarize') setRibbonTab('columns')
    if (preset === 'filter') setRibbonTab('filters')
    if (preset === 'top_n') setRibbonTab('sort')
  }

  function handleRemoveSubquery(id: string) {
    dispatch({ type: 'REMOVE_SUBQUERY', subqueryId: id })
    if (activeStageId === id) setActiveStageId('main')
  }

  async function copySql() {
    if (!compiled.sql) return
    await navigator.clipboard.writeText(compiled.sql)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(191,219,254,0.38),_transparent_32%),linear-gradient(180deg,_#f7fbff,_#eef5fb)] text-slate-900">
      <div className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[linear-gradient(135deg,#0f6cbd,#38a3ff)] text-white shadow-sm shadow-sky-200">
            <PanelTop className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 shrink-0">
            {editingName ? (
              <Input
                autoFocus
                value={nameInput}
                onChange={event => setNameInput(event.target.value)}
                onBlur={commitName}
                onKeyDown={event => {
                  if (event.key === 'Enter') commitName()
                  if (event.key === 'Escape') {
                    setNameInput(definition.name)
                    setEditingName(false)
                  }
                }}
                className="h-8 w-64 border-sky-200 bg-white text-sm font-semibold"
              />
            ) : (
              <button className="text-left" onClick={() => setEditingName(true)}>
                <div className="flex items-center gap-2">
                  <h1 className="truncate text-sm font-semibold text-slate-900">{definition.name}</h1>
                  <PencilLine className="h-3 w-3 text-slate-400" />
                </div>
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
            {(definition.datasourceLabel || definition.datasource || 'No datasource')} - {sourceLabel(definition)}
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="h-3.5 w-3.5" />
            </Button>

            <div className="mx-1 h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-1 text-[11px]">
              {saveStatus === 'saving' && <><Loader2 className="h-3 w-3 animate-spin text-slate-400" /><span className="text-slate-400">Saving...</span></>}
              {saveStatus === 'saved' && <><CheckCircle2 className="h-3 w-3 text-emerald-500" /><span className="text-emerald-600">Saved</span></>}
              {saveStatus === 'error' && <><AlertCircle className="h-3 w-3 text-destructive" /><span className="text-destructive">Save failed</span></>}
            </div>

            <div className="mx-1 h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5">
              <Switch
                checked={betaAiEnabled}
                onCheckedChange={setBetaAiEnabled}
              />
              <span className="text-[11px] text-slate-500">
                AI
                <span className="ml-1 rounded-full bg-sky-100 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-sky-600">Beta</span>
              </span>
            </div>

          </div>
        </div>

        <div className="ribbon-container">
          <Tabs value={ribbonTab} onValueChange={value => setRibbonTab(value as RibbonTab)}>
            <TabsList className="ribbon-tab-strip">
              <TabsTrigger value="home" className="ribbon-tab">Home</TabsTrigger>
              <TabsTrigger value="columns" className="ribbon-tab">
                Columns
                {activeFields.length > 0 && <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">{activeFields.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="filters" className="ribbon-tab">
                Filters
                {activeCriteria.conditions.length > 0 && <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">{activeCriteria.conditions.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="joins" className="ribbon-tab">
                Joins
                {activeJoins.length > 0 && <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">{activeJoins.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="sort" className="ribbon-tab">
                Sort &amp; Limit
                {activeSortLimit.sorts.length > 0 && <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">{activeSortLimit.sorts.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="subselects" className="ribbon-tab">
                Sub-selects
                {definition.subqueries.length > 0 && <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sky-500 px-1 text-[9px] font-bold text-white">{definition.subqueries.length}</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="ribbon-panel">
            {ribbonTab === 'home' && (
              <>
                <RibbonGroup title="Source">
                  <CommandButton icon={Database} label="Choose source" onClick={() => setSourceDialogOpen(true)} />
                  <CommandButton icon={TableProperties} label="Change table" onClick={() => setSourceDialogOpen(true)} disabled={datasourcesLoading} />
                </RibbonGroup>

                <RibbonGroup title="Query Summary">
                  <div className="flex items-center gap-1.5">
                    <SummaryTile icon={Columns3} count={activeFields.length} label="Columns" onClick={() => setRibbonTab('columns')} />
                    <SummaryTile icon={Filter} count={activeCriteria.conditions.length} label="Filters" onClick={() => setRibbonTab('filters')} />
                    <SummaryTile icon={GitMerge} count={activeJoins.length} label="Joins" onClick={() => setRibbonTab('joins')} />
                    <SummaryTile icon={ArrowUpDown} count={activeSortLimit.sorts.length} label="Sorts" onClick={() => setRibbonTab('sort')} />
                  </div>
                </RibbonGroup>

                <RibbonGroup title="Quick Add">
                  <div className="grid grid-cols-2 gap-1">
                    <button className="h-6 rounded border border-transparent px-2 text-[10px] font-medium text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50/60" onClick={openColumnPicker} disabled={!selectedSourceTableId}>+ Column</button>
                    <button className="h-6 rounded border border-transparent px-2 text-[10px] font-medium text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50/60" onClick={() => { setEditingConditionId(null); setFilterForm(emptyFilterForm()); setFilterDialogOpen(true) }} disabled={availableColumnOptions.length === 0}>+ Filter</button>
                    <button className="h-6 rounded border border-transparent px-2 text-[10px] font-medium text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50/60" onClick={() => setJoinDialogOpen(true)} disabled={!selectedSourceTableId}>+ Join</button>
                    <button className="h-6 rounded border border-transparent px-2 text-[10px] font-medium text-slate-600 transition-colors hover:border-sky-200 hover:bg-sky-50/60" onClick={() => { setSortForm(emptySortForm(activeSortLimit.limit)); setSortDialogOpen(true) }} disabled={availableColumnOptions.length === 0}>+ Sort</button>
                  </div>
                </RibbonGroup>

                <RibbonGroup title="Run">
                  <CommandButton icon={Play} label="Preview" onClick={() => void runPreview(compiled.sql)} disabled={!compiled.sql || compiled.errors.length > 0} />
                </RibbonGroup>

                <RibbonGroup title="Export">
                  <CommandButton icon={Copy} label="Copy SQL" onClick={() => void copySql()} disabled={!compiled.sql} />
                  <CommandButton icon={Download} label="Export SQL" onClick={() => {
                    if (!compiled.sql) return
                    const blob = new Blob([compiled.sql], { type: 'text/sql' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${definition.name || 'query'}.sql`
                    a.click()
                    URL.revokeObjectURL(url)
                  }} disabled={!compiled.sql} />
                </RibbonGroup>

                {!selectedSourceTableId && (
                  <RibbonGroup title="Get Started">
                    <div className="flex flex-col gap-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <HelpCircle className="h-3.5 w-3.5 text-sky-500" />
                        <span className="font-medium">What do you want to do?</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button className="rounded-full border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-[10px] font-medium text-sky-700 transition-colors hover:bg-sky-100" onClick={() => setSourceDialogOpen(true)}>
                          Choose a data source
                        </button>
                      </div>
                    </div>
                  </RibbonGroup>
                )}
              </>
            )}

            {ribbonTab === 'columns' && (
              <>
                <RibbonGroup title="Add Columns">
                  <CommandButton icon={Columns3} label="Columns" onClick={openColumnPicker} disabled={availableColumnOptions.length === 0} />
                  <CommandButton icon={Sigma} label="Summarize" onClick={() => openFieldDialog('aggregate')} disabled={availableColumnOptions.length === 0} />
                  <CommandButton icon={Calculator} label="Formula" onClick={() => openFieldDialog('formula')} disabled={!selectedSourceTableId} />
                </RibbonGroup>
                {activeFields.length > 0 && (
                  <RibbonGroup title={`${activeFields.length} Field${activeFields.length !== 1 ? 's' : ''} Selected`}>
                    <div className="ribbon-item-list">
                      {activeFields.map(field => (
                        <div key={field.id} className="flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700">
                          <Columns3 className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{field.alias || field.column}</span>
                          {field.aggregate && field.aggregate !== 'none' && (
                            <span className="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-medium uppercase text-sky-600">{field.aggregate}</span>
                          )}
                          <button
                            className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
                            onClick={() => dispatch({ type: 'REMOVE_FIELD', target, fieldId: field.id })}
                            title="Remove field"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </RibbonGroup>
                )}
                {/* Aggregation warning: if there's an aggregate but too many non-aggregated columns */}
                {(() => {
                  const aggregated = activeFields.filter(f => f.aggregate && f.aggregate !== 'none')
                  const nonAggregated = activeFields.filter(f => !f.aggregate || f.aggregate === 'none')
                  if (aggregated.length > 0 && nonAggregated.length > 3) {
                    return (
                      <RibbonGroup title="">
                        <div className="flex max-w-sm items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <div className="text-[11px] leading-snug text-amber-800">
                            <p className="font-medium">Your {aggregated[0].aggregate} will probably be 1 for every row.</p>
                            <p className="mt-0.5 text-amber-700">
                              You have {nonAggregated.length} non-summarized columns, so each row is unique.
                              Remove columns you don't need, or{' '}
                              <button className="font-medium underline" onClick={() => setRibbonTab('subselects')}>add a sub-select</button>
                              {' '}to summarize in a separate step.
                            </p>
                          </div>
                        </div>
                      </RibbonGroup>
                    )
                  }
                  return null
                })()}
              </>
            )}

            {ribbonTab === 'filters' && (
              <>
                <RibbonGroup title="Filters">
                  <CommandButton icon={Filter} label="Add condition" onClick={() => { setEditingConditionId(null); setFilterForm(emptyFilterForm()); setFilterDialogOpen(true) }} disabled={availableColumnOptions.length === 0} />
                </RibbonGroup>
                <RibbonGroup title="Logic">
                  <div className="flex items-center gap-1">
                    {(['AND', 'OR'] as const).map(operator => (
                      <button
                        key={operator}
                        className={cn(
                          'h-8 rounded border px-3 text-xs font-medium transition-all',
                          activeCriteria.operator === operator
                            ? 'border-sky-500 bg-sky-600 text-white shadow-sm'
                            : 'border-transparent bg-transparent text-slate-600 hover:border-sky-200 hover:bg-sky-50/60'
                        )}
                        onClick={() => dispatch({ type: 'SET_CRITERIA_OPERATOR', target, operator })}
                      >
                        {operator}
                      </button>
                    ))}
                  </div>
                </RibbonGroup>
                {activeCriteria.conditions.length > 0 && (
                  <RibbonGroup title={`${activeCriteria.conditions.length} Active Condition${activeCriteria.conditions.length !== 1 ? 's' : ''}`}>
                    <div className="ribbon-item-list">
                      {activeCriteria.conditions.map(node => {
                        if (node.type !== 'condition') return null
                        return (
                          <div key={node.id} className="flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700">
                            <Filter className="h-3 w-3 shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 truncate">{conditionLabel(node)}</span>
                            <button
                              className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                              onClick={() => openFilterForEdit(node)}
                              title="Edit condition"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
                              onClick={() => dispatch({ type: 'REMOVE_CONDITION', target, conditionId: node.id })}
                              title="Remove condition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </RibbonGroup>
                )}
              </>
            )}

            {ribbonTab === 'joins' && (
              <>
                <RibbonGroup title="Joins">
                  <CommandButton icon={GitMerge} label="Manual join" onClick={() => setJoinDialogOpen(true)} disabled={!selectedSourceTableId} />
                </RibbonGroup>
                {activeJoins.length > 0 && (
                  <RibbonGroup title={`${activeJoins.length} Active Join${activeJoins.length !== 1 ? 's' : ''}`}>
                    <div className="ribbon-item-list">
                      {activeJoins.map(join => (
                        <div key={join.id} className="flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700">
                          <GitMerge className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{join.alias || join.tableLabel || join.table}</span>
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium uppercase text-slate-500">{join.type}</span>
                          <button
                            className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
                            onClick={() => dispatch({ type: 'REMOVE_JOIN', target, joinId: join.id })}
                            title="Remove join"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </RibbonGroup>
                )}
                <RibbonGroup title="Suggested">
                  <div className="flex flex-wrap items-center gap-1">
                    {suggestedRelations.length === 0 ? (
                      <span className="text-xs text-slate-500">No suggested joins</span>
                    ) : (
                      suggestedRelations.slice(0, 4).map(relation => {
                        const targetTable = tables.find(t => t.restId === relation.to[0])
                        const targetName = targetTable?.name ?? targetTable?.label ?? relation.name
                        const alreadyJoined = activeJoins.some(j => j.tableId === relation.to[0])
                        return (
                          <Button
                            key={relation.id}
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-8 gap-1.5 rounded border px-2.5 text-xs transition-all',
                              alreadyJoined
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-transparent bg-transparent text-slate-600 hover:border-sky-200 hover:bg-sky-50/60'
                            )}
                            onClick={() => addSuggestedJoin(relation)}
                            disabled={alreadyJoined}
                            title={`LEFT JOIN ${targetName} via ${relation.name}`}
                          >
                            <GitMerge className="h-3 w-3" />
                            {targetName}
                            {alreadyJoined && <Check className="h-3 w-3" />}
                          </Button>
                        )
                      })
                    )}
                  </div>
                </RibbonGroup>
              </>
            )}

            {ribbonTab === 'sort' && (
              <>
                <RibbonGroup title="Sort">
                  <CommandButton
                    icon={ArrowUpDown}
                    label="Sort/Limit"
                    onClick={() => {
                      setSortForm(emptySortForm(activeSortLimit.limit))
                      setSortDialogOpen(true)
                    }}
                    disabled={availableColumnOptions.length === 0}
                  />
                </RibbonGroup>
                {(activeSortLimit.sorts.length > 0 || activeSortLimit.limit) && (
                  <RibbonGroup title={`${activeSortLimit.sorts.length} Sort${activeSortLimit.sorts.length !== 1 ? 's' : ''} Active`}>
                    <div className="ribbon-item-list">
                      {activeSortLimit.sorts.map(sort => (
                        <div key={sort.field} className="flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700">
                          <ArrowUpDown className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate">{sort.label || sort.field}</span>
                          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-medium uppercase text-slate-500">{sort.direction}</span>
                          <button
                            className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
                            onClick={() => dispatch({ type: 'REMOVE_SORT', target, field: sort.field })}
                            title="Remove sort"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {activeSortLimit.limit && (
                        <div className="flex h-7 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-700">
                          <span className="min-w-0 flex-1">Limit {activeSortLimit.limit} rows</span>
                          <button
                            className="shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
                            onClick={() => dispatch({ type: 'SET_LIMIT', target, limit: undefined })}
                            title="Remove limit"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </RibbonGroup>
                )}
                <RibbonGroup title="SQL">
                  <CommandButton icon={Code2} label="Copy SQL" onClick={() => void copySql()} disabled={!compiled.sql} />
                  <CommandButton icon={Play} label="Run" onClick={() => void runPreview(compiled.sql)} disabled={!compiled.sql || compiled.errors.length > 0} />
                </RibbonGroup>
              </>
            )}

            {ribbonTab === 'subselects' && (
              <>
                {/* Pipeline breadcrumb */}
                <RibbonGroup title="Your query pipeline">
                  <div className="flex items-center gap-1">
                    <StageButton active={isMainStage} onClick={() => setActiveStageId('main')}>
                      <span className="flex items-center gap-1">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[9px] font-bold text-sky-700">1</span>
                        Get Data
                      </span>
                    </StageButton>
                    {definition.subqueries.map((subquery, index) => {
                      const stepNum = index + 2
                      const readableLabel = subquery.alias
                        .replace(/^step_\d+_?/, '')
                        .replace(/_/g, ' ')
                        .replace(/^\w/, c => c.toUpperCase()) || `Step ${stepNum}`
                      return (
                        <span key={subquery.id} className="flex items-center gap-1">
                          <span className="text-slate-300">→</span>
                          <StageButton active={activeStageId === subquery.id} onClick={() => setActiveStageId(subquery.id)}>
                            <span className="flex items-center gap-1">
                              <span className={cn(
                                'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                                activeStageId === subquery.id ? 'bg-white/30 text-white' : 'bg-sky-100 text-sky-700'
                              )}>{stepNum}</span>
                              {readableLabel}
                              <button
                                className="ml-0.5 rounded-full p-0.5 opacity-50 transition-opacity hover:opacity-100"
                                onClick={event => {
                                  event.stopPropagation()
                                  handleRemoveSubquery(subquery.id)
                                }}
                                title="Remove this sub-select"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          </StageButton>
                        </span>
                      )
                    })}
                    <span className="text-slate-300">→</span>
                    <Button variant="outline" size="sm" className="h-8 rounded border-dashed border-sky-300 bg-transparent px-2.5 text-xs hover:bg-sky-50/60" onClick={() => setSubqueryDialogOpen(true)}>
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add sub-select
                    </Button>
                  </div>
                </RibbonGroup>

                {/* Contextual info for selected step */}
                {definition.subqueries.length === 0 && (
                  <RibbonGroup title="What are sub-selects?">
                    <div className="flex max-w-md flex-col gap-1.5 text-xs text-slate-600">
                      <p>Sub-selects let you <strong>refine your results in steps</strong>. Your main query gets the raw data, then each sub-select can further summarize, filter, or reshape it.</p>
                      <p className="text-slate-500">Example: Get all orders → Count orders per customer → Show only customers with 5+ orders</p>
                    </div>
                  </RibbonGroup>
                )}

                {activeSubquery && (
                  <RibbonGroup title="This sub-select">
                    <div className="flex items-end gap-2">
                      <div className="grid gap-1">
                        <Label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Name</Label>
                        <Input
                          value={activeSubquery.alias}
                          onChange={event => dispatch({ type: 'SET_SUBQUERY_ALIAS', subqueryId: activeSubquery.id, alias: event.target.value })}
                          className="h-8 w-44 rounded border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Reads from</Label>
                        <Select
                          value={activeSubquery.source}
                          onValueChange={value => dispatch({ type: 'SET_SUBQUERY_SOURCE', subqueryId: activeSubquery.id, source: value })}
                        >
                          <SelectTrigger className="h-8 w-40 rounded border-slate-300 bg-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">Step 1 — Get Data</SelectItem>
                            {definition.subqueries.filter(item => item.id !== activeSubquery.id).map((item, idx) => (
                              <SelectItem key={item.id} value={item.id}>Step {idx + 2} — {item.alias.replace(/_/g, ' ')}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="pb-1 text-[10px] leading-tight text-slate-400">
                        Use the Columns, Filters, and Sort tabs to configure what this sub-select does.
                      </p>
                    </div>
                  </RibbonGroup>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {betaAiEnabled && (
        <NlBar
          datasource={currentDatasource}
          tables={tables}
          definition={definition}
          sourceColumns={sourceColumns}
          onApplyDefinition={merged => setDefinition(merged)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80">
            <button
              className="flex w-full items-center justify-between gap-4 px-4 py-1.5 text-left"
              onClick={() => setSqlPanelOpen(prev => !prev)}
            >
              <div className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-sky-600" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{sqlEditing ? 'Editing SQL' : 'SQL'}</span>
                <span className={cn('text-[10px] transition-transform', sqlPanelOpen ? 'rotate-180' : '')}>▾</span>
              </div>
              <div className="flex items-center gap-3">
                {compiled.errors.length > 0 ? (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {compiled.errors[0]}
                  </div>
                ) : previewUpdatedAt ? (
                  <div className="text-[11px] text-slate-400">Last preview at {previewUpdatedAt}</div>
                ) : null}
              </div>
            </button>
            {sqlPanelOpen && (
              <div className="relative px-4 pb-2">
                <textarea
                  className={cn(
                    'w-full resize-none overflow-auto rounded-md border px-3 py-2 font-mono text-[11px] leading-5 outline-none transition-colors',
                    sqlEditing
                      ? 'border-sky-300 bg-white text-slate-900 ring-1 ring-sky-200'
                      : 'border-slate-200 bg-white text-slate-700'
                  )}
                  style={{ maxHeight: 160, minHeight: 60 }}
                  rows={Math.min(8, Math.max(3, (sqlDraft || '').split('\n').length))}
                  value={sqlDraft || '-- Choose a datasource and table to begin'}
                  onChange={e => {
                    setSqlDraft(e.target.value)
                    if (!sqlEditing) setSqlEditing(true)
                    setSqlParseError(null)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      applySqlEdit()
                    }
                    if (e.key === 'Escape' && sqlEditing) {
                      e.preventDefault()
                      cancelSqlEdit()
                    }
                  }}
                  spellCheck={false}
                />
                {sqlParseError && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {sqlParseError}
                  </div>
                )}
                <div className="absolute right-5 top-1 flex gap-1">
                  {sqlEditing ? (
                    <>
                      <button
                        className="rounded bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
                        onClick={event => { event.stopPropagation(); applySqlEdit() }}
                        title="Apply SQL changes to ribbon (Ctrl+Enter)"
                      >
                        Apply
                      </button>
                      <button
                        className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                        onClick={event => { event.stopPropagation(); cancelSqlEdit() }}
                        title="Cancel editing (Esc)"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-medium text-sky-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-sky-50"
                        onClick={event => { event.stopPropagation(); void copySql() }}
                        title="Copy SQL"
                      >
                        Copy
                      </button>
                      <button
                        className="rounded bg-white/90 px-2 py-0.5 text-[10px] font-medium text-sky-600 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-sky-50"
                        onClick={event => { event.stopPropagation(); void runPreview(compiled.sql) }}
                        disabled={!compiled.sql || compiled.errors.length > 0}
                        title="Run preview"
                      >
                        Run
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden p-2">
            <div className="h-full overflow-hidden rounded-lg border border-slate-200 bg-white/90 shadow-[0_18px_60px_-28px_rgba(15,23,42,0.3)]">
              <TabbedResults
                rows={previewRows}
                loading={previewLoading}
                error={previewError}
                emptyState={resultsEmptyState}
                datasourceId={definition.datasource}
                tables={tables}
              />
            </div>
          </div>
        </div>

      </div>

      <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
        <DialogContent className="max-w-2xl rounded-xl border-slate-200 bg-[#f8fbff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Database className="h-5 w-5 text-sky-600" />
              Choose datasource and table
            </DialogTitle>
            <DialogDescription>
              Picking a new starting table resets the design canvas so the ribbon can rebuild the query from the new source.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-6 md:grid-cols-[240px_1fr]">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Datasource</Label>
              <Select value={sourceDraft.datasource || undefined} onValueChange={value => setSourceDraft(current => ({ ...current, datasource: value, tableId: '' }))}>
                <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                  <SelectValue placeholder={datasourcesLoading ? 'Loading datasources...' : 'Choose datasource'} />
                </SelectTrigger>
                <SelectContent>
                  {datasources.map(item => (
                    <SelectItem key={item.id} value={item.naturalId}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Tables and views</Label>
              <div className="grid max-h-[360px] gap-2 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                {sourceDraftLoading && <p className="px-3 py-2 text-sm text-slate-500">Loading tables...</p>}
                {!sourceDraftLoading && sourceDraftTables.length === 0 && (
                  <p className="px-3 py-6 text-sm text-slate-500">Pick a datasource to browse its tables and views.</p>
                )}
                {sourceDraftTables.map(table => (
                  <button
                    key={table.id}
                    className={cn(
                      'rounded-md border px-4 py-3 text-left transition-colors',
                      sourceDraft.tableId === table.restId
                        ? 'border-sky-300 bg-sky-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50'
                    )}
                    onClick={() => setSourceDraft(current => ({ ...current, tableId: table.restId }))}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{table.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{table.label}</p>
                      </div>
                      {typeof table.recordCount === 'number' && table.recordCount >= 0 && (
                        <Badge variant="secondary" className="rounded-full border border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                          {table.recordCount} rows
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="ghost" className="rounded-md" onClick={() => setSourceDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-md bg-sky-600 text-white hover:bg-sky-700" onClick={handleApplySource} disabled={!sourceDraft.datasource || !sourceDraft.tableId}>Use this source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-xl rounded-xl border-slate-200 bg-[#f8fbff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              {fieldDialogMode === 'formula' ? <Calculator className="h-5 w-5 text-sky-600" /> : <Columns3 className="h-5 w-5 text-sky-600" />}
              {fieldDialogMode === 'formula' ? 'Add calculated field' : fieldDialogMode === 'aggregate' ? 'Add summary column' : 'Add result column'}
            </DialogTitle>
            <DialogDescription>
              {fieldDialogMode === 'formula'
                ? 'Write a SQL expression and give the new output column a friendly name.'
                : 'Choose the source column people should see in the results grid.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-6">
            {fieldDialogMode !== 'formula' && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Column</Label>
                <Select value={fieldForm.referenceKey || undefined} onValueChange={value => setFieldForm(current => ({ ...current, referenceKey: value, alias: current.alias || columnOptionMap[value]?.label || '' }))}>
                  <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                    <SelectValue placeholder="Choose a field from the current stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumnOptions.map(option => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label} - {option.caption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Output label</Label>
              <Input value={fieldForm.alias} onChange={event => setFieldForm(current => ({ ...current, alias: event.target.value }))} className="h-10 rounded-md border-slate-200 bg-white" placeholder="What should people see in the grid header?" />
            </div>

            {fieldDialogMode === 'formula' ? (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">SQL expression</Label>
                <textarea
                  value={fieldForm.expression}
                  onChange={event => setFieldForm(current => ({ ...current, expression: event.target.value }))}
                  className="min-h-[120px] rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-mono text-slate-800 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Example: COALESCE(src.&quot;Freight&quot;, 0) * 1.15"
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Summary</Label>
                <Select value={fieldForm.aggregate} onValueChange={value => setFieldForm(current => ({ ...current, aggregate: value as AggregateFunction }))}>
                  <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATES.map(item => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="ghost" className="rounded-md" onClick={() => setFieldDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-md bg-sky-600 text-white hover:bg-sky-700" onClick={handleAddField} disabled={fieldDialogMode === 'formula' ? !fieldForm.expression.trim() : !fieldForm.referenceKey}>Add column</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={filterDialogOpen} onOpenChange={open => { setFilterDialogOpen(open); if (!open) setEditingConditionId(null) }}>
        <DialogContent className="max-w-xl rounded-xl border-slate-200 bg-[#f8fbff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Filter className="h-5 w-5 text-sky-600" />
              {editingConditionId ? 'Edit filter condition' : 'Add filter condition'}
            </DialogTitle>
            <DialogDescription>Describe the rows you want to keep in this stage.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-6">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Field</Label>
              <Select value={filterForm.fieldKey || undefined} onValueChange={value => setFilterForm(current => ({ ...current, fieldKey: value }))}>
                <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                  <SelectValue placeholder="Choose a field" />
                </SelectTrigger>
                <SelectContent>
                  {availableColumnOptions.map(option => (
                    <SelectItem key={option.key} value={option.key}>{option.label} - {option.caption}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Rule</Label>
                <Select value={filterForm.operator} onValueChange={value => setFilterForm(current => ({ ...current, operator: value as ComparisonOperator }))}>
                  <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!NO_VALUE_OPERATORS.includes(filterForm.operator) && (
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Compare against</Label>
                  <Select value={filterForm.valueType} onValueChange={value => setFilterForm(current => ({ ...current, valueType: value as 'literal' | 'field', value: '', valueKey: '' }))}>
                    <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="literal">Typed value</SelectItem>
                      <SelectItem value="field">Another field</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {!NO_VALUE_OPERATORS.includes(filterForm.operator) && filterForm.valueType === 'literal' && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Value</Label>
                <Input value={filterForm.value} onChange={event => setFilterForm(current => ({ ...current, value: event.target.value }))} className="h-10 rounded-md border-slate-200 bg-white" placeholder={filterForm.operator === 'in' || filterForm.operator === 'not_in' ? 'Example: USA, Canada, Mexico' : 'Type a value'} />
              </div>
            )}

            {!NO_VALUE_OPERATORS.includes(filterForm.operator) && filterForm.valueType === 'field' && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Other field</Label>
                <Select value={filterForm.valueKey || undefined} onValueChange={value => setFilterForm(current => ({ ...current, valueKey: value }))}>
                  <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                    <SelectValue placeholder="Choose another field" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumnOptions.map(option => (
                      <SelectItem key={option.key} value={option.key}>{option.label} - {option.caption}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterForm.operator === 'between' && (
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Second value</Label>
                <Input value={filterForm.value2} onChange={event => setFilterForm(current => ({ ...current, value2: event.target.value }))} className="h-10 rounded-md border-slate-200 bg-white" placeholder="Type the end of the range" />
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="ghost" className="rounded-md" onClick={() => setFilterDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-md bg-sky-600 text-white hover:bg-sky-700" onClick={handleAddFilter} disabled={!filterForm.fieldKey || (!NO_VALUE_OPERATORS.includes(filterForm.operator) && filterForm.valueType === 'literal' && !filterForm.value.trim()) || (filterForm.valueType === 'field' && !filterForm.valueKey)}>{editingConditionId ? 'Update filter' : 'Add filter'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="max-w-3xl rounded-xl border-slate-200 bg-[#f8fbff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <GitMerge className="h-5 w-5 text-sky-600" />
              Add join
            </DialogTitle>
            <DialogDescription>Pick another table and tell the ribbon how rows should line up.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2 md:col-span-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Join table</Label>
                <Select value={joinForm.tableId || undefined} onValueChange={value => {
                  const table = tables.find(item => item.restId === value)
                  setJoinForm(current => ({ ...current, tableId: value, alias: current.alias || table?.mappingId || '' }))
                }}>
                  <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                    <SelectValue placeholder="Choose a table to join" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {tables.filter(item => item.restId !== selectedSourceTableId).map(table => (
                      <SelectItem key={table.id} value={table.restId}>{table.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Join type</Label>
                <Select value={joinForm.type} onValueChange={value => setJoinForm(current => ({ ...current, type: value as JoinType }))}>
                  <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inner">Inner join</SelectItem>
                    <SelectItem value="left">Left join</SelectItem>
                    <SelectItem value="right">Right join</SelectItem>
                    <SelectItem value="full">Full join</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 md:w-64">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Join nickname</Label>
              <Input value={joinForm.alias} onChange={event => setJoinForm(current => ({ ...current, alias: event.target.value }))} className="h-10 rounded-md border-slate-200 bg-white" placeholder="Short name for joined fields" />
            </div>

            <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Match rules</p>
                  <p className="mt-1 text-xs text-slate-500">Each rule says which field on the current stage matches a field on the joined table.</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-md border-slate-200 bg-white" onClick={() => setJoinForm(current => ({ ...current, conditions: [...current.conditions, { id: generateId(), leftKey: '', rightKey: '' }] }))}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add rule
                </Button>
              </div>

              {joinForm.conditions.map(condition => (
                <div key={condition.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_auto_1fr_auto] md:items-center">
                  <Select value={condition.leftKey || undefined} onValueChange={value => setJoinForm(current => ({
                    ...current,
                    conditions: current.conditions.map(item => item.id === condition.id ? { ...item, leftKey: value } : item),
                  }))}>
                    <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                      <SelectValue placeholder="Current stage field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumnOptions.map(option => (
                        <SelectItem key={option.key} value={option.key}>{option.label} - {option.caption}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="px-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">=</div>

                  <Select value={condition.rightKey || undefined} onValueChange={value => setJoinForm(current => ({
                    ...current,
                    conditions: current.conditions.map(item => item.id === condition.id ? { ...item, rightKey: value } : item),
                  }))}>
                    <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                      <SelectValue placeholder={joinTable ? `${joinTable.name} field` : 'Joined table field'} />
                    </SelectTrigger>
                    <SelectContent>
                      {joinTableColumns.map(column => (
                        <SelectItem key={column.id} value={column.name}>{column.label} - {column.dataType}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {joinForm.conditions.length > 1 ? (
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md text-slate-500 hover:text-destructive" onClick={() => setJoinForm(current => ({
                      ...current,
                      conditions: current.conditions.filter(item => item.id !== condition.id),
                    }))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : <div />}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="ghost" className="rounded-md" onClick={() => setJoinDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-md bg-sky-600 text-white hover:bg-sky-700" onClick={handleAddJoin} disabled={!joinForm.tableId}>Add join</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sortDialogOpen} onOpenChange={setSortDialogOpen}>
        <DialogContent className="max-w-xl rounded-xl border-slate-200 bg-[#f8fbff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <ArrowUpDown className="h-5 w-5 text-sky-600" />
              Sort and limit results
            </DialogTitle>
            <DialogDescription>Choose how this stage should order its rows and how many rows should be returned.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-6">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Sort by</Label>
              <Select value={sortForm.fieldKey || undefined} onValueChange={value => setSortForm(current => ({ ...current, fieldKey: value }))}>
                <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                  <SelectValue placeholder="Choose a field to sort" />
                </SelectTrigger>
                <SelectContent>
                  {availableColumnOptions.map(option => (
                    <SelectItem key={option.key} value={option.key}>{option.label} - {option.caption}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Direction</Label>
                <Select value={sortForm.direction} onValueChange={value => setSortForm(current => ({ ...current, direction: value as 'asc' | 'desc' }))}>
                  <SelectTrigger className="h-10 rounded-md border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Ascending</SelectItem>
                    <SelectItem value="desc">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Limit rows</Label>
                <Input value={sortForm.limit} onChange={event => setSortForm(current => ({ ...current, limit: event.target.value }))} type="number" min={1} className="h-10 rounded-md border-slate-200 bg-white" placeholder="Leave blank for no SQL limit" />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button variant="ghost" className="rounded-md" onClick={() => setSortDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-md bg-sky-600 text-white hover:bg-sky-700" onClick={handleAddSort} disabled={!sortForm.fieldKey && !sortForm.limit.trim()}>Apply results settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subqueryDialogOpen} onOpenChange={val => { setSubqueryDialogOpen(val); if (!val) setSubqueryAlias('') }}>
        <DialogContent className="max-w-lg rounded-xl border-slate-200 bg-[#f8fbff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Layers3 className="h-5 w-5 text-sky-600" />
              Add a sub-select
            </DialogTitle>
            <DialogDescription>
              A sub-select takes the results from a previous step and lets you refine them further — summarize, filter, or pick the top rows.
              {definition.subqueries.length === 0 && (
                <span className="mt-1 block text-slate-500">This will be <strong>Step 2</strong>, reading from your main query.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-5">
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quick start — what do you want to do?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  className="group flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-sky-300 hover:shadow-sm"
                  onClick={() => handleAddSubqueryPreset('summarize')}
                >
                  <div className="flex items-center gap-1.5">
                    <Sigma className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-medium text-slate-800">Summarize</span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-500">Count, sum, or average your results by group</p>
                  <p className="text-[10px] italic text-slate-400">e.g. "Count customers per city"</p>
                </button>
                <button
                  className="group flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-sky-300 hover:shadow-sm"
                  onClick={() => handleAddSubqueryPreset('filter')}
                >
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-medium text-slate-800">Filter further</span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-500">Narrow down results from the previous step</p>
                  <p className="text-[10px] italic text-slate-400">e.g. "Only cities with 5+ customers"</p>
                </button>
                <button
                  className="group flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left transition-all hover:border-sky-300 hover:shadow-sm"
                  onClick={() => handleAddSubqueryPreset('top_n')}
                >
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-medium text-slate-800">Pick top N</span>
                  </div>
                  <p className="text-[11px] leading-snug text-slate-500">Sort and keep only the first N rows</p>
                  <p className="text-[10px] italic text-slate-400">e.g. "Top 10 products by revenue"</p>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Create with a custom name</p>
              <div className="flex items-center gap-2">
                <Input
                  value={subqueryAlias}
                  onChange={event => setSubqueryAlias(event.target.value.replace(/\s+/g, '_'))}
                  className="h-9 flex-1 rounded-md border-slate-200 bg-white text-sm"
                  placeholder="e.g. customers_by_city"
                  onKeyDown={e => { if (e.key === 'Enter' && subqueryAlias.trim()) handleAddSubquery() }}
                />
                <Button
                  size="sm"
                  className="h-9 rounded-md bg-sky-600 px-4 text-white hover:bg-sky-700"
                  onClick={handleAddSubquery}
                  disabled={!subqueryAlias.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={columnPickerOpen} onOpenChange={setColumnPickerOpen}>
        <DialogContent className="max-w-3xl rounded-xl border-slate-200 bg-[#f8fbff] p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Columns3 className="h-5 w-5 text-sky-600" />
              Select columns
            </DialogTitle>
            <DialogDescription>
              Click columns on the left to add them. Drag to reorder on the right.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-[400px] grid-cols-2 gap-0 divide-x divide-slate-200">
            {/* Available columns */}
            <div className="flex flex-col">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={columnPickerSearch}
                    onChange={event => setColumnPickerSearch(event.target.value)}
                    className="h-9 rounded-md border-slate-200 bg-white pl-9 text-sm"
                    placeholder="Search columns..."
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {[...groupedColumns.entries()].map(([source, columns]) => {
                  const filtered = columns.filter(col =>
                    !columnPickerSearch || col.label.toLowerCase().includes(columnPickerSearch.toLowerCase()) || col.raw.toLowerCase().includes(columnPickerSearch.toLowerCase())
                  )
                  if (filtered.length === 0) return null
                  return (
                    <div key={source} className="mb-3">
                      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{source}</p>
                      {filtered.map(col => {
                        const selected = isColumnSelected(col.key)
                        return (
                          <button
                            key={col.key}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              selected
                                ? 'bg-sky-50 text-sky-700'
                                : 'text-slate-700 hover:bg-slate-100'
                            )}
                            onClick={() => toggleColumn(col.key)}
                          >
                            <div className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                              selected
                                ? 'border-sky-500 bg-sky-500 text-white'
                                : 'border-slate-300 bg-white'
                            )}>
                              {selected && <Check className="h-3 w-3" />}
                            </div>
                            <span className="truncate">{col.label}</span>
                            <span className="ml-auto truncate text-[11px] text-slate-400">{col.raw !== col.label ? col.raw : ''}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
                {availableColumnOptions.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-slate-400">No columns available. Choose a source table first.</p>
                )}
              </div>
            </div>

            {/* Selected columns */}
            <div className="flex flex-col">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-medium text-slate-700">{activeFields.length} column{activeFields.length !== 1 ? 's' : ''} selected</p>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {activeFields.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm text-slate-400">Click columns on the left to add them here.</p>
                )}
                {activeFields.map((field, idx) => (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={event => { event.preventDefault(); setDragOverIdx(idx) }}
                    onDrop={() => {
                      if (dragIdx !== null) handleColumnDrop(dragIdx, idx)
                      setDragIdx(null)
                      setDragOverIdx(null)
                    }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-all',
                      dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
                        ? 'border-sky-400 bg-sky-50'
                        : 'border-transparent hover:bg-slate-50',
                      dragIdx === idx && 'opacity-40'
                    )}
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-300" />
                    <div className="min-w-0 flex-1">
                      <span className="truncate text-slate-800">{field.alias || field.column}</span>
                      {field.alias && field.alias !== field.column && (
                        <span className="ml-1.5 text-[11px] text-slate-400">{field.column}</span>
                      )}
                      {field.aggregate && field.aggregate !== 'none' && (
                        <span className="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] font-medium uppercase text-sky-600">{field.aggregate}</span>
                      )}
                    </div>
                    <button
                      className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                      onClick={() => dispatch({ type: 'REMOVE_FIELD', target, fieldId: field.id })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button className="rounded-md bg-sky-600 text-white hover:bg-sky-700" onClick={() => setColumnPickerOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RibbonGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ribbon-group">
      <div className="flex flex-1 items-center gap-1 px-2">{children}</div>
      <div className="ribbon-group-label">{title}</div>
    </div>
  )
}

function CommandButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType
  label: string
  caption?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={cn(
        'ribbon-command-button',
        disabled && 'ribbon-command-button-disabled'
      )}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-tight">{label}</span>
    </button>
  )
}

function SummaryTile({ icon: Icon, count, label, onClick }: { icon: React.ElementType; count: number; label: string; onClick: () => void }) {
  return (
    <button
      className={cn(
        'flex h-[52px] w-[72px] flex-col items-center justify-center gap-0.5 rounded-md border transition-all',
        count > 0
          ? 'border-sky-200 bg-sky-50/80 text-sky-700 hover:border-sky-300 hover:bg-sky-100/80'
          : 'border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:bg-slate-50'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-sm font-bold">{count}</span>
      </div>
      <span className="text-[9px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  )
}

function StageButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={cn(
        'inline-flex h-8 items-center rounded border px-2 text-xs font-medium transition-all',
        active
          ? 'border-sky-400 bg-sky-600 text-white shadow-sm'
          : 'border-transparent bg-transparent text-slate-600 hover:border-sky-200 hover:bg-sky-50/60'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
