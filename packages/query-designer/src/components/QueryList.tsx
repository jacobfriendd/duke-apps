import { useEffect, useState } from 'react'
import { Plus, Database, ChevronRight, Trash2, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { listQueries, deleteQuery, createQuery } from '@/lib/api'
import { newQueryDefinition } from '@/lib/defaults'
import type { QueryRecord } from '@/types/query'

interface Props {
  onOpen: (record: QueryRecord) => void
}

export function QueryList({ onOpen }: Props) {
  const [records, setRecords] = useState<QueryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QueryRecord | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    listQueries()
      .then(setRecords)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    setCreating(true)
    try {
      const def = newQueryDefinition('Untitled Query')
      const record = await createQuery(def)
      onOpen(record)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create query')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(record: QueryRecord) {
    await deleteQuery(record.id)
    setRecords(r => r.filter(q => q.id !== record.id))
    setDeleteTarget(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function getSource(record: QueryRecord) {
    const definition = record.definition
    return {
      datasource: definition?.datasourceLabel || definition?.datasource,
      table: definition?.tableLabel || (definition?.schema && definition?.table ? `${definition.schema}.${definition.table}` : ''),
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">Query Designer</h1>
            <p className="text-xs text-muted-foreground">Duke University — Informer Project</p>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={creating} size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Query
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {loading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
            Loading queries…
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="flex flex-col items-center justify-center h-52 text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Database className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No queries yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first query to get started</p>
            </div>
            <Button onClick={handleCreate} disabled={creating} size="sm" variant="secondary" className="gap-1.5 mt-1">
              <Plus className="w-3.5 h-3.5" />
              New Query
            </Button>
          </div>
        )}

        {!loading && records.length > 0 && (
          <div className="grid gap-2 max-w-3xl">
            {records.map(record => (
              (() => {
                const source = getSource(record)
                return (
              <div
                key={record.id}
                className="group flex items-center gap-4 px-4 py-3.5 rounded-lg border border-border/60 bg-card hover:border-border hover:bg-card/80 cursor-pointer transition-all"
                onClick={() => onOpen(record)}
              >
                <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{record.name}</p>
                    {source.datasource && (
                      <Badge variant="secondary" className="text-xs font-normal shrink-0">
                        {source.datasource}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {source.table && (
                      <span className="text-xs text-muted-foreground truncate">{source.table}</span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDate(record.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(record) }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
                )
              })()
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete query?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
