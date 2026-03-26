import { useState } from 'react'
import { Plus, Pencil, Trash2, GripVertical, Hash, Sigma, FunctionSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { QueryField, AggregateFunction, DatasetField } from '@/types/query'

const AGGREGATES: { value: AggregateFunction; label: string }[] = [
  { value: 'none', label: 'None (raw)' },
  { value: 'count', label: 'COUNT' },
  { value: 'count_distinct', label: 'COUNT DISTINCT' },
  { value: 'sum', label: 'SUM' },
  { value: 'avg', label: 'AVG' },
  { value: 'min', label: 'MIN' },
  { value: 'max', label: 'MAX' },
]

const AGG_COLORS: Record<AggregateFunction, string> = {
  none: '',
  count: 'bg-blue-500/15 text-blue-400',
  count_distinct: 'bg-blue-500/15 text-blue-400',
  sum: 'bg-emerald-500/15 text-emerald-400',
  avg: 'bg-amber-500/15 text-amber-400',
  min: 'bg-purple-500/15 text-purple-400',
  max: 'bg-purple-500/15 text-purple-400',
}

interface Props {
  fields: QueryField[]
  datasetFields?: DatasetField[]
  onAdd: (field: Omit<QueryField, 'id'>) => void
  onUpdate: (field: QueryField) => void
  onRemove: (id: string) => void
  onReorder: (fields: QueryField[]) => void
}

type FieldForm = { column: string; alias: string; aggregate: AggregateFunction; expression: string }
const emptyForm = (): FieldForm => ({ column: '', alias: '', aggregate: 'none', expression: '' })

export function FieldsPanel({ fields, datasetFields = [], onAdd, onUpdate, onRemove, onReorder }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<QueryField | null>(null)
  const [form, setForm] = useState<FieldForm>(emptyForm())
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  function openAdd() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(f: QueryField) {
    setEditing(f)
    setForm({ column: f.column, alias: f.alias, aggregate: f.aggregate, expression: f.expression ?? '' })
    setOpen(true)
  }

  function handleSubmit() {
    const field = {
      column: form.column.trim(),
      alias: form.alias.trim() || form.column.trim(),
      aggregate: form.aggregate,
      expression: form.expression.trim() || undefined,
    }
    if (!field.column && !field.expression) return
    if (editing) {
      onUpdate({ ...editing, ...field })
    } else {
      onAdd(field)
    }
    setOpen(false)
  }

  function handleDrop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) return
    const reordered = [...fields]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onReorder(reordered)
    setDragIdx(null)
    setDragOver(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {fields.length === 0 ? 'No fields selected' : `${fields.length} field${fields.length !== 1 ? 's' : ''}`}
        </p>
        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2" onClick={openAdd}>
          <Plus className="w-3 h-3" /> Add Field
        </Button>
      </div>

      {/* Dataset field picker */}
      {datasetFields.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Dataset Fields
          </p>
          <div className="flex flex-wrap gap-1.5">
            {datasetFields.map(df => {
              const alreadyAdded = fields.some(f => f.column === df.name)
              return (
                <button
                  key={df.name}
                  disabled={alreadyAdded}
                  onClick={() => onAdd({ column: df.name, alias: df.label, aggregate: 'none' })}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors
                    ${alreadyAdded
                      ? 'border-primary/30 bg-primary/10 text-primary cursor-default'
                      : 'border-border/50 bg-background hover:border-primary/50 hover:bg-primary/5 text-foreground cursor-pointer'}
                  `}
                  title={`${df.label} (${df.dataType})`}
                >
                  <Hash className="w-2.5 h-2.5 shrink-0" />
                  {df.label}
                  {alreadyAdded && <span className="text-[9px] text-primary/60">added</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {fields.length === 0 && datasetFields.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center">
          <Hash className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Select a dataset to browse fields, or add them manually</p>
          <Button variant="secondary" size="sm" className="mt-3 gap-1 text-xs" onClick={openAdd}>
            <Plus className="w-3 h-3" /> Add Field
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {fields.map((f, idx) => (
          <div
            key={f.id}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
            className={`group flex items-center gap-2 px-3 py-2 rounded-md border transition-all cursor-grab active:cursor-grabbing
              ${dragOver === idx ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/60'}
            `}
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {f.expression ? (
                  <FunctionSquare className="w-3 h-3 text-amber-400 shrink-0" />
                ) : (
                  <Hash className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                )}
                <span className="text-xs font-medium text-foreground truncate">
                  {f.alias || f.column}
                </span>
                {f.aggregate !== 'none' && (
                  <Badge className={`text-[10px] px-1.5 py-0 font-mono shrink-0 ${AGG_COLORS[f.aggregate]}`}>
                    {f.aggregate.toUpperCase()}
                  </Badge>
                )}
              </div>
              {(f.alias && f.alias !== f.column && !f.expression) && (
                <p className="text-[10px] text-muted-foreground ml-5 mt-0.5 truncate">← {f.column}</p>
              )}
              {f.expression && (
                <p className="text-[10px] text-muted-foreground font-mono ml-5 mt-0.5 truncate">{f.expression}</p>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground" onClick={() => openEdit(f)}>
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(f.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sigma className="w-4 h-4 text-primary" />
              {editing ? 'Edit Field' : 'Add Field'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Column name</Label>
              {datasetFields.length > 0 ? (
                <Select
                  value={form.column || undefined}
                  onValueChange={v => {
                    const df = datasetFields.find(f => f.name === v)
                    setForm(f => ({ ...f, column: v, alias: f.alias || df?.label || '' }))
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a column…" />
                  </SelectTrigger>
                  <SelectContent>
                    {datasetFields.map(df => (
                      <SelectItem key={df.name} value={df.name} className="text-sm">
                        {df.label} <span className="text-muted-foreground ml-1">({df.name})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="e.g. order_total"
                  value={form.column}
                  onChange={e => setForm(f => ({ ...f, column: e.target.value }))}
                  className="h-8 text-sm"
                />
              )}
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Alias (output name)</Label>
              <Input
                placeholder={form.column || 'e.g. Total Orders'}
                value={form.alias}
                onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Aggregate</Label>
              <Select value={form.aggregate} onValueChange={v => setForm(f => ({ ...f, aggregate: v as AggregateFunction }))}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATES.map(a => (
                    <SelectItem key={a.value} value={a.value} className="text-sm">{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs flex items-center gap-1">
                <FunctionSquare className="w-3 h-3 text-amber-400" /> Expression
                <span className="text-muted-foreground font-normal">(optional — overrides column)</span>
              </Label>
              <Input
                placeholder="e.g. price * quantity"
                value={form.expression}
                onChange={e => setForm(f => ({ ...f, expression: e.target.value }))}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!form.column && !form.expression}>
              {editing ? 'Save' : 'Add Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
