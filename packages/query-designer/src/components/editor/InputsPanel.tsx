import { useState } from 'react'
import { Plus, Trash2, Pencil, SlidersHorizontal, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import type { QueryInput, InputType } from '@/types/query'

const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'enum', label: 'Dropdown (fixed options)' },
]

interface Props {
  inputs: QueryInput[]
  onAdd: (input: Omit<QueryInput, 'id'>) => void
  onUpdate: (input: QueryInput) => void
  onRemove: (id: string) => void
}

type InputForm = { name: string; label: string; type: InputType; defaultValue: string; required: boolean; options: string; placeholder: string }
const emptyForm = (): InputForm => ({ name: '', label: '', type: 'string', defaultValue: '', required: false, options: '', placeholder: '' })

export function InputsPanel({ inputs, onAdd, onUpdate, onRemove }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<QueryInput | null>(null)
  const [form, setForm] = useState<InputForm>(emptyForm())

  function openAdd() { setEditing(null); setForm(emptyForm()); setOpen(true) }
  function openEdit(inp: QueryInput) {
    setEditing(inp)
    setForm({
      name: inp.name, label: inp.label, type: inp.type,
      defaultValue: inp.defaultValue ?? '',
      required: inp.required,
      options: (inp.options ?? []).join('\n'),
      placeholder: inp.placeholder ?? '',
    })
    setOpen(true)
  }

  function handleSubmit() {
    const inp = {
      name: form.name.trim(),
      label: form.label.trim() || form.name.trim(),
      type: form.type,
      defaultValue: form.defaultValue.trim() || undefined,
      required: form.required,
      options: form.type === 'enum' ? form.options.split('\n').map(s => s.trim()).filter(Boolean) : undefined,
      placeholder: form.placeholder.trim() || undefined,
    }
    if (!inp.name) return
    if (editing) onUpdate({ ...editing, ...inp })
    else onAdd(inp)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {inputs.length === 0 ? 'No parameters' : `${inputs.length} parameter${inputs.length !== 1 ? 's' : ''}`}
        </p>
        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2" onClick={openAdd}>
          <Plus className="w-3 h-3" /> Add Input
        </Button>
      </div>

      {inputs.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-5 text-center">
          <SlidersHorizontal className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">No parameters — query returns all data</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add inputs to filter by user-provided values</p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {inputs.map(inp => (
          <div key={inp.id} className="group flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-secondary/30 hover:border-border transition-all">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">$</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium text-foreground">{inp.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{inp.type}</Badge>
                {inp.required && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />}
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{inp.label}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground" onClick={() => openEdit(inp)}>
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(inp.id)}>
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
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              {editing ? 'Edit Input' : 'Add Input'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Parameter name <span className="text-muted-foreground">(used in criteria as $name)</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.replace(/\s/g, '_') }))} className="h-8 text-sm font-mono" placeholder="e.g. start_date" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Display label</Label>
              <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="h-8 text-sm" placeholder={form.name || 'e.g. Start Date'} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as InputType }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INPUT_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-sm">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.type === 'enum' && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Options <span className="text-muted-foreground">(one per line)</span></Label>
                <textarea
                  value={form.options}
                  onChange={e => setForm(f => ({ ...f, options: e.target.value }))}
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Option A&#10;Option B&#10;Option C"
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs">Default value</Label>
              <Input value={form.defaultValue} onChange={e => setForm(f => ({ ...f, defaultValue: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.required} onCheckedChange={v => setForm(f => ({ ...f, required: v }))} id="required-switch" />
              <Label htmlFor="required-switch" className="text-xs cursor-pointer">Required — user must provide a value</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!form.name}>{editing ? 'Save' : 'Add Input'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
