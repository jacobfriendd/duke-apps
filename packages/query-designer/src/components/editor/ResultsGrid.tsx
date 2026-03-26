import { Database, Loader2, SearchX, AlertCircle } from 'lucide-react'

interface Props {
  rows: Record<string, unknown>[]
  loading: boolean
  error: string | null
  emptyState?: {
    title: string
    description: string
  }
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function ResultsGrid({ rows, loading, error, emptyState }: Props) {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))))

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Running query preview...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex max-w-xl items-start gap-3 rounded-md border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Preview could not run</p>
            <p className="mt-1 text-destructive/80">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-white shadow-sm">
            <SearchX className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{emptyState?.title || 'No rows returned'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{emptyState?.description || 'Adjust filters, joins, or selected columns and the results will appear here.'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-b-lg bg-white">
      <div className="flex items-center justify-between border-b border-border bg-slate-50/90 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Database className="h-3.5 w-3.5" />
          <span>{rows.length} row{rows.length === 1 ? '' : 's'} in preview</span>
        </div>
        <span>{columns.length} column{columns.length === 1 ? '' : 's'}</span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
            <tr>
              {columns.map(column => (
                <th
                  key={column}
                  className="border-b border-r border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 last:border-r-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60 hover:bg-sky-50/70">
                {columns.map(column => (
                  <td
                    key={`${rowIndex}-${column}`}
                    className="max-w-[280px] border-b border-r border-border/80 px-3 py-2 align-top text-slate-700 last:border-r-0"
                    title={formatCell(row[column])}
                  >
                    <div className="truncate">{formatCell(row[column])}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
