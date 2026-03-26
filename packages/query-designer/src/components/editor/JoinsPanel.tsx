import { useState } from 'react'
import { Plus, Trash2, GitMerge, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { QueryJoin, JoinType } from '@/types/query'
import { generateId } from '@/lib/utils'

const JOIN_TYPES: { value: JoinType; label: string; color: string }[] = [
  { value: 'inner', label: 'INNER JOIN', color: 'bg-blue-500/15 text-blue-400' },
  { value: 'left', label: 'LEFT JOIN', color: 'bg-emerald-500/15 text-emerald-400' },
  { value: 'right', label: 'RIGHT JOIN', color: 'bg-amber-500/15 text-amber-400' },
  { value: 'full', label: 'FULL JOIN', color: 'bg-purple-500/15 text-purple-400' },
]

interface Props {
  joins: QueryJoin[]
  onAdd: (join: Omit<QueryJoin, 'id'>) => void
  onUpdate: (join: QueryJoin) => void
  onRemove: (id: string) => void
}

type JoinForm = {
  table: string; alias: string; type: JoinType
  conditions: Array<{ id: string; left: string; right: string }>
}
const emptyForm = (): JoinForm => ({
  table: '', alias: '', type: 'inner',
  conditions: [{ id: generateId(), left: '', right: '' }],
})

export function JoinsPanel({ joins, onAdd, onUpdate, onRemove }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<QueryJoin | null>(null)
  const [form, setForm] = useState<JoinForm>(emptyForm())

  function openAdd() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(j: QueryJoin) {
    setEditing(j)
    setForm({
      table: j.table, alias: j.alias, type: j.type,
      conditions: j.conditions.map(c => ({ ...c, id: generateId() })),
    })
    setOpen(true)
  }

  function handleSubmit() {
    const join = { table: form.table, alias: form.alias, type: form.type, conditions: form.conditions.map(({ left, right }) => ({ left, right })) }
    if (!join.table) return
    if (editing) onUpdate({ ...editing, ...join })
    else onAdd(join)
    setOpen(false)
  }

  function addCondition() {
    setForm(f => ({ ...f, conditions: [...f.conditions, { id: generateId(), left: '', right: '' }] }))
  }
  function removeCondition(id: string) {
    setForm(f => ({ ...f, conditions: f.conditions.filter(c => c.id !== id) }))
  }
  function updateCondition(id: string, side: 'left' | 'right', value: string) {
    setForm(f => ({ ...f, conditions: f.conditions.map(c => c.id === id ? { ...c, [side]: value } : c) }))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {joins.length === 0 ? 'No joins' : `${joins.length} join${joins.length !== 1 ? 's' : ''}`}
        </p>
        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2" onClick={openAdd}>
          <Plus className="w-3 h-3" /> Add Join
        </Button>
      </div>

      {joins.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <GitMerge className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No joins — single table query</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {joins.map(j => {
          const jt = JOIN_TYPES.find(t => t.value === j.type)
          return (
            <div key={j.id} className="group p-3 rounded-md border border-border/50 bg-secondary/30 hover:border-border transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${jt?.color ?? ''}`}>
                    {jt?.label ?? j.type}
                  </Badge>
                  <span className="text-xs font-medium text-foreground truncate">{j.table}</span>
                  {j.alias && j.alias !== j.table && (
                    <span className="text-xs text-muted-foreground shrink-0">AS {j.alias}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => openEdit(j)}>Edit</Button>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(j.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {j.conditions.length > 0 && (
                <div className="mt-1.5 ml-1 flex flex-col gap-0.5">
                  {j.conditions.map((c, idx) => (
                    <p key={idx} className="text-[10px] text-muted-foreground font-mono">
                      <span className="text-foreground/70">{c.left}</span>
                      <span className="mx-1">=</span>
                      <span className="text-foreground/70">{c.right}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-primary" />
              {editing ? 'Edit Join' : 'Add Join'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Join type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as JoinType }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOIN_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Table</Label>
              <Input value={form.table} onChange={e => setForm(f => ({ ...f, table: e.target.value }))} className="h-8 text-sm" placeholder="e.g. customers" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Alias</Label>
              <Input value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} className="h-8 text-sm" placeholder={form.table || 'e.g. c'} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">ON conditions</Label>
                <Button variant="ghost" size="sm" className="h-5 px-1 text-xs gap-0.5" onClick={addCondition}>
                  <Plus className="w-2.5 h-2.5" /> Add
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                {form.conditions.map(c => (
                  <div key={c.id} className="flex items-center gap-1.5">
                    <Input value={c.left} onChange={e => updateCondition(c.id, 'left', e.target.value)} className="h-7 text-xs font-mono flex-1" placeholder="left.field" />
                    <span className="text-xs text-muted-foreground">=</span>
                    <Input value={c.right} onChange={e => updateCondition(c.id, 'right', e.target.value)} className="h-7 text-xs font-mono flex-1" placeholder="right.field" />
                    {form.conditions.length > 1 && (
                      <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeCondition(c.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!form.table}>{editing ? 'Save' : 'Add Join'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
