import { useState } from 'react'
import { Plus, Trash2, Pencil, GripVertical, Workflow, ArrowRight, Calculator, Tag, EyeOff, GitBranch, AlignLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { FlowStep, FlowStepType, QueryField } from '@/types/query'
import { generateId } from '@/lib/utils'

const STEP_TYPES: { value: FlowStepType; label: string; icon: React.ElementType; color: string; desc: string }[] = [
  { value: 'rename', label: 'Rename', icon: Tag, color: 'text-blue-400', desc: 'Rename a field to a new name' },
  { value: 'calculate', label: 'Calculate', icon: Calculator, color: 'text-emerald-400', desc: 'Add a computed field using an expression' },
  { value: 'filter', label: 'Filter Rows', icon: ArrowRight, color: 'text-amber-400', desc: 'Keep or remove rows matching a condition' },
  { value: 'format', label: 'Format', icon: AlignLeft, color: 'text-purple-400', desc: 'Format number, date, or text fields' },
  { value: 'conditional', label: 'Conditional', icon: GitBranch, color: 'text-pink-400', desc: 'Map values based on conditions (CASE WHEN)' },
  { value: 'remove', label: 'Remove Fields', icon: EyeOff, color: 'text-red-400', desc: 'Drop fields from the output' },
]

const FORMAT_TYPES = ['number', 'currency', 'date', 'uppercase', 'lowercase', 'trim', 'round']

interface Props {
  steps: FlowStep[]
  fields: QueryField[]
  onAdd: (step: Omit<FlowStep, 'id'>) => void
  onUpdate: (step: FlowStep) => void
  onRemove: (id: string) => void
  onReorder: (steps: FlowStep[]) => void
}

function StepIcon({ type, className }: { type: FlowStepType; className?: string }) {
  const def = STEP_TYPES.find(s => s.value === type)
  if (!def) return <Workflow className={className} />
  const Icon = def.icon
  return <Icon className={`${className} ${def.color}`} />
}

function stepSummary(step: FlowStep): string {
  const c = step.config as unknown as Record<string, unknown>
  switch (step.type) {
    case 'rename': return `${c.field} → ${c.newName}`
    case 'calculate': return `${c.outputField} = ${c.expression}`
    case 'filter': return `Keep rows where ${c.field} ${c.operator} ${c.value}`
    case 'format': return `Format ${c.field} as ${c.formatType}`
    case 'conditional': return `${c.outputField} based on ${(c.cases as unknown[])?.length ?? 0} condition(s)`
    case 'remove': return `Remove: ${(c.fields as string[])?.join(', ')}`
    default: return step.label
  }
}

export function FlowStepsPanel({ steps, fields: _fields, onAdd, onUpdate, onRemove, onReorder }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FlowStep | null>(null)
  const [stepType, setStepType] = useState<FlowStepType>('rename')
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  void _fields

  function openAdd(type: FlowStepType) {
    setEditing(null)
    setStepType(type)
    setForm(type === 'conditional' ? { outputField: '', cases: [{ id: generateId(), when: '', then: '' }], elseValue: '' } :
            type === 'remove' ? { fields: '' } :
            type === 'calculate' ? { outputField: '', expression: '', description: '' } :
            type === 'format' ? { field: '', formatType: 'number', decimals: 2, currency: 'USD' } :
            type === 'filter' ? { field: '', operator: 'equals', value: '' } :
            { field: '', newName: '' })
    setOpen(true)
  }

  function openEdit(s: FlowStep) {
    setEditing(s)
    setStepType(s.type)
    const c = s.config as unknown as Record<string, unknown>
    setForm(s.type === 'remove' ? { ...c, fields: (c.fields as string[])?.join(', ') ?? '' } :
            s.type === 'conditional' ? { ...c, cases: (c.cases as Array<{ when: string; then: string }>).map(cs => ({ ...cs, id: generateId() })) } :
            { ...c })
    setOpen(true)
  }

  function buildConfig(): Record<string, unknown> {
    if (stepType === 'remove') {
      return { fields: (form.fields as string).split(',').map((s: string) => s.trim()).filter(Boolean) }
    }
    if (stepType === 'conditional') {
      return {
        ...form,
        cases: (form.cases as Array<{ id: string; when: string; then: string }>).map(item => ({
          when: item.when,
          then: item.then,
        })),
      }
    }
    return { ...form }
  }

  function handleSubmit() {
    const config = buildConfig()
    const def = STEP_TYPES.find(s => s.value === stepType)!
    const label = def.label + (config.field ? `: ${config.field}` : config.outputField ? `: ${config.outputField}` : '')
    if (editing) {
      onUpdate({ ...editing, type: stepType, label, config: config as unknown as FlowStep['config'] })
    } else {
      onAdd({ type: stepType, label, config: config as unknown as FlowStep['config'] })
    }
    setOpen(false)
  }

  function handleDrop(toIdx: number) {
    if (dragIdx === null || dragIdx === toIdx) return
    const reordered = [...steps]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(toIdx, 0, moved)
    onReorder(reordered)
    setDragIdx(null)
    setDragOver(null)
  }

  const [addMenuOpen, setAddMenuOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {steps.length === 0 ? 'No steps' : `${steps.length} step${steps.length !== 1 ? 's' : ''} in pipeline`}
        </p>
        <div className="relative">
          <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2" onClick={() => setAddMenuOpen(o => !o)}>
            <Plus className="w-3 h-3" /> Add Step
          </Button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-md border border-border bg-popover shadow-xl py-1">
              {STEP_TYPES.map(s => {
                const Icon = s.icon
                return (
                  <button
                    key={s.value}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors"
                    onClick={() => { openAdd(s.value); setAddMenuOpen(false) }}
                  >
                    <Icon className={`w-3.5 h-3.5 ${s.color} shrink-0`} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {steps.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <Workflow className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No transformations applied</p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Steps run after data is fetched, before indexing</p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {steps.map((s, idx) => (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragIdx(idx)}
            onDragOver={e => { e.preventDefault(); setDragOver(idx) }}
            onDrop={() => handleDrop(idx)}
            onDragEnd={() => { setDragIdx(null); setDragOver(null) }}
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-md border transition-all cursor-grab
              ${dragOver === idx ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/60'}
            `}
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <StepIcon type={s.type} className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">{s.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{stepSummary(s)}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-foreground" onClick={() => openEdit(s)}>
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(s.id)}>
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
              <StepIcon type={stepType} className="w-4 h-4" />
              {editing ? 'Edit Step' : `Add ${STEP_TYPES.find(s => s.value === stepType)?.label}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {/* Rename */}
            {stepType === 'rename' && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Field to rename</Label>
                  <Input value={String(form.field ?? '')} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} className="h-8 text-sm" placeholder="e.g. cust_id" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">New name</Label>
                  <Input value={String(form.newName ?? '')} onChange={e => setForm(f => ({ ...f, newName: e.target.value }))} className="h-8 text-sm" placeholder="e.g. customer_id" />
                </div>
              </>
            )}

            {/* Calculate */}
            {stepType === 'calculate' && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Output field name</Label>
                  <Input value={String(form.outputField ?? '')} onChange={e => setForm(f => ({ ...f, outputField: e.target.value }))} className="h-8 text-sm" placeholder="e.g. margin_pct" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Expression</Label>
                  <Input value={String(form.expression ?? '')} onChange={e => setForm(f => ({ ...f, expression: e.target.value }))} className="h-8 text-sm font-mono" placeholder="e.g. (revenue - cost) / revenue * 100" />
                  <p className="text-[10px] text-muted-foreground">Use field names. Supports +, -, *, /, parentheses.</p>
                </div>
              </>
            )}

            {/* Filter */}
            {stepType === 'filter' && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Field</Label>
                  <Input value={String(form.field ?? '')} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Operator</Label>
                  <Select value={String(form.operator ?? 'equals')} onValueChange={v => setForm(f => ({ ...f, operator: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'is_null', 'is_not_null'].map(o => (
                        <SelectItem key={o} value={o} className="text-sm">{o.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Value</Label>
                  <Input value={String(form.value ?? '')} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="h-8 text-sm" />
                </div>
              </>
            )}

            {/* Format */}
            {stepType === 'format' && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Field</Label>
                  <Input value={String(form.field ?? '')} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Format as</Label>
                  <Select value={String(form.formatType ?? 'number')} onValueChange={v => setForm(f => ({ ...f, formatType: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMAT_TYPES.map(t => <SelectItem key={t} value={t} className="text-sm capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {(form.formatType === 'number' || form.formatType === 'round') && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Decimal places</Label>
                    <Input type="number" min={0} max={10} value={String(form.decimals ?? 2)} onChange={e => setForm(f => ({ ...f, decimals: parseInt(e.target.value) }))} className="h-8 text-sm" />
                  </div>
                )}
              </>
            )}

            {/* Conditional */}
            {stepType === 'conditional' && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Output field name</Label>
                  <Input value={String(form.outputField ?? '')} onChange={e => setForm(f => ({ ...f, outputField: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Cases</Label>
                  <div className="flex flex-col gap-1.5">
                    {(form.cases as Array<{ id: string; when: string; then: string }>).map(c => (
                      <div key={c.id} className="grid grid-cols-[1fr_auto_1fr] gap-1 items-center">
                        <Input value={c.when} onChange={e => setForm(f => ({
                          ...f, cases: (f.cases as Array<{id:string;when:string;then:string}>).map((cs) => cs.id === c.id ? { ...cs, when: e.target.value } : cs)
                        }))} placeholder="when condition" className="h-7 text-xs" />
                        <span className="text-[10px] text-muted-foreground text-center">→</span>
                        <Input value={c.then} onChange={e => setForm(f => ({
                          ...f, cases: (f.cases as Array<{id:string;when:string;then:string}>).map((cs) => cs.id === c.id ? { ...cs, then: e.target.value } : cs)
                        }))} placeholder="then value" className="h-7 text-xs" />
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="h-6 text-xs self-start gap-1" onClick={() => setForm(f => ({ ...f, cases: [...(f.cases as unknown[]), { id: generateId(), when: '', then: '' }] }))}>
                      <Plus className="w-2.5 h-2.5" /> Add case
                    </Button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Else (default value)</Label>
                  <Input value={String(form.elseValue ?? '')} onChange={e => setForm(f => ({ ...f, elseValue: e.target.value }))} className="h-8 text-sm" />
                </div>
              </>
            )}

            {/* Remove */}
            {stepType === 'remove' && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Fields to remove <span className="text-muted-foreground">(comma-separated)</span></Label>
                <Input value={String(form.fields ?? '')} onChange={e => setForm(f => ({ ...f, fields: e.target.value }))} className="h-8 text-sm" placeholder="e.g. internal_id, temp_field" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit}>{editing ? 'Save' : 'Add Step'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
