import { useState } from 'react'
import { Plus, Trash2, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { SortLimit, SortField } from '@/types/query'

interface Props {
  sortLimit: SortLimit
  onAddSort: (sort: SortField) => void
  onRemoveSort: (field: string) => void
  onSetLimit: (limit: number | undefined) => void
}

export function SortLimitPanel({ sortLimit, onAddSort, onRemoveSort, onSetLimit }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SortField>({ field: '', direction: 'asc' })
  const [limitInput, setLimitInput] = useState(sortLimit.limit?.toString() ?? '')

  function handleAddSort() {
    if (!form.field) return
    onAddSort(form)
    setForm({ field: '', direction: 'asc' })
    setOpen(false)
  }

  function handleLimitBlur() {
    const n = parseInt(limitInput)
    onSetLimit(isNaN(n) || n <= 0 ? undefined : n)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Sort */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-foreground">Sort</p>
          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2" onClick={() => { setForm({ field: '', direction: 'asc' }); setOpen(true) }}>
            <Plus className="w-3 h-3" /> Add Sort
          </Button>
        </div>

        {sortLimit.sorts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-5 text-center">
            <ArrowUpDown className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Natural order — no sorting applied</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {sortLimit.sorts.map((s, idx) => (
              <div key={s.field} className="group flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-secondary/30 hover:border-border transition-all">
                <span className="text-[10px] text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{s.field}</span>
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                    {s.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {s.direction.toUpperCase()}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" onClick={() => onRemoveSort(s.field)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Limit */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-foreground">Limit</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-32">
            <Input
              type="number"
              min={1}
              placeholder="No limit"
              value={limitInput}
              onChange={e => setLimitInput(e.target.value)}
              onBlur={handleLimitBlur}
              className="h-8 text-sm"
            />
          </div>
          {sortLimit.limit && (
            <p className="text-xs text-muted-foreground">rows per result</p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-primary" />
              Add Sort
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Field</Label>
              <Input value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} className="h-8 text-sm" placeholder="e.g. order_date" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v as 'asc' | 'desc' }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc" className="text-sm">Ascending (A → Z, 0 → 9)</SelectItem>
                  <SelectItem value="desc" className="text-sm">Descending (Z → A, 9 → 0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddSort} disabled={!form.field}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
