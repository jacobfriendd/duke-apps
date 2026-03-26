import { useCallback, useRef, useState } from 'react'
import { Plus, X, Table2 } from 'lucide-react'
import { ResultsGrid } from './ResultsGrid'
import { executeDatasourceSql } from '@/lib/api'
import type { DatasourceTable } from '@/types/query'

interface TableTab {
  id: string
  label: string
  schemaId: string
  mappingId: string
  rows: Record<string, unknown>[]
  loading: boolean
  error: string | null
  fetched: boolean
}

interface Props {
  /** Combined query result rows */
  rows: Record<string, unknown>[]
  loading: boolean
  error: string | null
  emptyState?: { title: string; description: string }
  /** Current datasource ID for fetching table previews */
  datasourceId: string
  /** All available tables in the datasource */
  tables: DatasourceTable[]
}

export function TabbedResults({ rows, loading, error, emptyState, datasourceId, tables }: Props) {
  const [activeTab, setActiveTab] = useState('results')
  const [tableTabs, setTableTabs] = useState<TableTab[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const pickerRef = useRef<HTMLDivElement>(null)
  const requestIds = useRef<Record<string, number>>({})

  const fetchTablePreview = useCallback(async (tab: TableTab) => {
    if (!datasourceId) return

    const reqKey = tab.id
    const reqId = (requestIds.current[reqKey] ?? 0) + 1
    requestIds.current[reqKey] = reqId

    setTableTabs(prev => prev.map(t =>
      t.id === tab.id ? { ...t, loading: true, error: null } : t
    ))

    try {
      const sql = `SELECT * FROM "${tab.schemaId}"."${tab.mappingId}" LIMIT 100`
      const result = await executeDatasourceSql(datasourceId, sql, 100)
      if (requestIds.current[reqKey] !== reqId) return
      setTableTabs(prev => prev.map(t =>
        t.id === tab.id ? { ...t, rows: result.rows, loading: false, fetched: true } : t
      ))
    } catch (err) {
      if (requestIds.current[reqKey] !== reqId) return
      setTableTabs(prev => prev.map(t =>
        t.id === tab.id ? { ...t, rows: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load table', fetched: true } : t
      ))
    }
  }, [datasourceId])

  const addTableTab = useCallback((table: DatasourceTable) => {
    const existing = tableTabs.find(t => t.id === table.id)
    if (existing) {
      setActiveTab(existing.id)
      setPickerOpen(false)
      setPickerSearch('')
      return
    }

    const newTab: TableTab = {
      id: table.id,
      label: table.label,
      schemaId: table.schemaId,
      mappingId: table.mappingId,
      rows: [],
      loading: false,
      error: null,
      fetched: false,
    }

    setTableTabs(prev => [...prev, newTab])
    setActiveTab(table.id)
    setPickerOpen(false)
    setPickerSearch('')

    // Lazy fetch on first open
    void fetchTablePreview(newTab)
  }, [tableTabs, fetchTablePreview])

  const closeTab = useCallback((tabId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setTableTabs(prev => prev.filter(t => t.id !== tabId))
    if (activeTab === tabId) {
      setActiveTab('results')
    }
  }, [activeTab])

  const filteredTables = tables.filter(t =>
    t.label.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    t.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  const activeTableTab = tableTabs.find(t => t.id === activeTab)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'results' ? (
          <ResultsGrid rows={rows} loading={loading} error={error} emptyState={emptyState} />
        ) : activeTableTab ? (
          <ResultsGrid
            rows={activeTableTab.rows}
            loading={activeTableTab.loading}
            error={activeTableTab.error}
            emptyState={{
              title: `Browse ${activeTableTab.label}`,
              description: 'Loading table preview...',
            }}
          />
        ) : null}
      </div>

      {/* Tab bar — bottom, Excel-style */}
      <div className="flex items-center gap-0 border-t border-slate-200 bg-slate-50/80 px-1">
        {/* Add table tab button */}
        <div className="relative">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            disabled={!datasourceId || tables.length === 0}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Browse a table"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {pickerOpen && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => { setPickerOpen(false); setPickerSearch('') }} />

              {/* Dropdown — opens upward */}
              <div
                ref={pickerRef}
                className="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg"
              >
                <div className="border-b border-slate-100 p-2">
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search tables..."
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto p-1">
                  {filteredTables.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">
                      {pickerSearch ? 'No tables match your search' : 'No tables available'}
                    </div>
                  ) : (
                    filteredTables.map(table => {
                      const alreadyOpen = tableTabs.some(t => t.id === table.id)
                      return (
                        <button
                          key={table.id}
                          onClick={() => addTableTab(table)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-sky-50"
                        >
                          <Table2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate text-slate-700">{table.label}</span>
                          {alreadyOpen && (
                            <span className="shrink-0 text-[10px] text-sky-500">open</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mx-1 h-4 w-px bg-slate-200" />

        {/* Results tab - always present */}
        <button
          onClick={() => setActiveTab('results')}
          className={`
            flex items-center gap-1.5 border-t-2 px-3 py-1.5 text-xs font-medium transition-colors
            ${activeTab === 'results'
              ? 'border-sky-500 bg-white text-sky-700'
              : 'border-transparent text-slate-500 hover:bg-white/60 hover:text-slate-700'
            }
          `}
        >
          Results
        </button>

        {/* Table browse tabs */}
        {tableTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              if (!tab.fetched && !tab.loading) {
                void fetchTablePreview(tab)
              }
            }}
            className={`
              group flex items-center gap-1.5 border-t-2 px-3 py-1.5 text-xs font-medium transition-colors
              ${activeTab === tab.id
                ? 'border-sky-500 bg-white text-sky-700'
                : 'border-transparent text-slate-500 hover:bg-white/60 hover:text-slate-700'
              }
            `}
          >
            <Table2 className="h-3 w-3 shrink-0 opacity-50" />
            <span className="max-w-[140px] truncate">{tab.label}</span>
            <span
              role="button"
              onClick={event => closeTab(tab.id, event)}
              className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-slate-200 group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
