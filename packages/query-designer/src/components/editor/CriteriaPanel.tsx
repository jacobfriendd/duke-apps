import { useState } from 'react'
import { Plus, Trash2, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { CriteriaGroup, CriteriaCondition, ComparisonOperator, CriteriaValueType, QueryInput } from '@/types/query'

const OPERATORS: { value: ComparisonOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'greater_equal', label: 'is greater than or equal' },
  { value: 'less_than', label: 'is less than' },
  { value: 'less_equal', label: 'is less than or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'in', label: 'is in' },
  { value: 'not_in', label: 'is not in' },
  { value: 'between', label: 'is between' },
  { value: 'is_null', label: 'is empty' },
  { value: 'is_not_null', label: 'is not empty' },
]

const NO_VALUE_OPS: ComparisonOperator[] = ['is_null', 'is_not_null']

interface Props {
  criteria: CriteriaGroup
  inputs: QueryInput[]
  onAddCondition: (condition: Omit<CriteriaCondition, 'id' | 'type'>) => void
  onUpdateCondition: (condition: CriteriaCondition) => void
  onRemoveCondition: (id: string) => void
  onSetOperator: (op: 'AND' | 'OR') => void
}

type CondForm = {
  field: string; operator: ComparisonOperator; valueType: CriteriaValueType; value: string; value2: string
}
const emptyForm = (): CondForm => ({ field: '', operator: 'equals', valueType: 'literal', value: '', value2: '' })

function ConditionRow({ node, inputs, onUpdate, onRemove }: {
  node: CriteriaCondition
  inputs: QueryInput[]
  onUpdate: (c: CriteriaCondition) => void
  onRemove: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CondForm>({
    field: node.field,
    operator: node.operator,
    valueType: node.valueType,
    value: node.value,
    value2: node.value2 ?? '',
  })

  function handleSave() {
    onUpdate({ ...node, ...form, value2: form.value2 || undefined })
    setEditing(false)
  }

  const noValue = NO_VALUE_OPS.includes(node.operator)
  const opLabel = OPERATORS.find(o => o.value === node.operator)?.label ?? node.operator

  return (
    <>
      <div className="group flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/60 transition-all">
        <div className="flex-1 min-w-0 text-xs">
          <span className="font-medium text-foreground">{node.field}</span>
          {' '}
          <span className="text-muted-foreground">{opLabel}</span>
          {!noValue && (
            <>
              {' '}
              <span className="text-primary">
                {node.valueType === 'input' ? `$${node.value}` : node.value}
              </span>
              {node.value2 && <span className="text-muted-foreground"> and <span className="text-primary">{node.value2}</span></span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(node.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Edit Condition
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Field</Label>
              <Input value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} className="h-8 text-sm" placeholder="e.g. order_total" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Operator</Label>
              <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v as ComparisonOperator }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!NO_VALUE_OPS.includes(form.operator) && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Value type</Label>
                  <Select value={form.valueType} onValueChange={v => setForm(f => ({ ...f, valueType: v as CriteriaValueType }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="literal" className="text-sm">Literal value</SelectItem>
                      <SelectItem value="field" className="text-sm">Another field</SelectItem>
                      {inputs.length > 0 && <SelectItem value="input" className="text-sm">Input parameter</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {form.valueType === 'input' ? (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Input</Label>
                    <Select value={form.value} onValueChange={v => setForm(f => ({ ...f, value: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select input…" /></SelectTrigger>
                      <SelectContent>
                        {inputs.map(i => <SelectItem key={i.id} value={i.name} className="text-sm">${i.name} — {i.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Value</Label>
                    <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="h-8 text-sm" />
                  </div>
                )}
                {form.operator === 'between' && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Second value</Label>
                    <Input value={form.value2} onChange={e => setForm(f => ({ ...f, value2: e.target.value }))} className="h-8 text-sm" />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function CriteriaPanel({ criteria, inputs, onAddCondition, onUpdateCondition, onRemoveCondition, onSetOperator }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CondForm>(emptyForm())

  function handleAdd() {
    if (!form.field) return
    onAddCondition({
      field: form.field,
      operator: form.operator,
      valueType: form.valueType,
      value: form.value,
      value2: form.value2 || undefined,
    })
    setForm(emptyForm())
    setOpen(false)
  }

  const conditions = criteria.conditions.filter(n => n.type === 'condition') as CriteriaCondition[]
  const noValue = NO_VALUE_OPS.includes(form.operator)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {criteria.conditions.length > 1 && (
            <div className="flex rounded-md border border-border overflow-hidden">
              {(['AND', 'OR'] as const).map(op => (
                <button
                  key={op}
                  onClick={() => onSetOperator(op)}
                  className={`px-2.5 py-0.5 text-xs font-medium transition-colors ${criteria.operator === op ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {op}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {conditions.length === 0 ? 'No conditions' : `${conditions.length} condition${conditions.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs px-2" onClick={() => { setForm(emptyForm()); setOpen(true) }}>
          <Plus className="w-3 h-3" /> Add Condition
        </Button>
      </div>

      {conditions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
          <Filter className="w-5 h-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No filter conditions — all rows will be returned</p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {conditions.map((node, idx) => (
          <div key={node.id} className="flex gap-2 items-start">
            {conditions.length > 1 && (
              <div className="w-8 text-center pt-2">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {idx === 0 ? 'WHERE' : criteria.operator}
                </span>
              </div>
            )}
            <div className="flex-1">
              <ConditionRow
                node={node}
                inputs={inputs}
                onUpdate={onUpdateCondition}
                onRemove={onRemoveCondition}
              />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary" />
              Add Condition
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Field</Label>
              <Input value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value }))} className="h-8 text-sm" placeholder="e.g. status" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Operator</Label>
              <Select value={form.operator} onValueChange={v => setForm(f => ({ ...f, operator: v as ComparisonOperator }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!noValue && (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs">Value type</Label>
                  <Select value={form.valueType} onValueChange={v => setForm(f => ({ ...f, valueType: v as CriteriaValueType }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="literal" className="text-sm">Literal value</SelectItem>
                      <SelectItem value="field" className="text-sm">Another field</SelectItem>
                      {inputs.length > 0 && <SelectItem value="input" className="text-sm">Input parameter</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                {form.valueType === 'input' ? (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Input</Label>
                    <Select value={form.value} onValueChange={v => setForm(f => ({ ...f, value: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select input…" /></SelectTrigger>
                      <SelectContent>
                        {inputs.map(i => <SelectItem key={i.id} value={i.name} className="text-sm">${i.name} — {i.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Value</Label>
                    <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="h-8 text-sm" />
                  </div>
                )}
                {form.operator === 'between' && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Second value</Label>
                    <Input value={form.value2} onChange={e => setForm(f => ({ ...f, value2: e.target.value }))} className="h-8 text-sm" />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!form.field}>Add Condition</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
