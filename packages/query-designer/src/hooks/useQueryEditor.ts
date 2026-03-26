import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type {
  QueryDefinition, QueryField, CriteriaGroup, CriteriaCondition, CriteriaNode,
  QueryJoin, SortLimit, QueryInput, FlowStep, Subquery, SortField,
} from '@/types/query'
import { generateId, } from '@/lib/utils'
import { emptyGroup, emptySubquery } from '@/lib/defaults'

const MAX_HISTORY = 80

type Action =
  | { type: 'SET_DEFINITION'; payload: QueryDefinition }
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_DESCRIPTION'; payload: string }
  | { type: 'SET_DATASOURCE_META'; payload: { datasource: string; datasourceId?: string; datasourceLabel?: string } }
  | { type: 'SET_TABLE_META'; payload: { schema?: string; table: string; tableId?: string; tableLabel?: string } }
  // Fields
  | { type: 'ADD_FIELD'; target: 'main' | string; field: Omit<QueryField, 'id'> }
  | { type: 'UPDATE_FIELD'; target: 'main' | string; field: QueryField }
  | { type: 'REMOVE_FIELD'; target: 'main' | string; fieldId: string }
  | { type: 'REORDER_FIELDS'; target: 'main' | string; fields: QueryField[] }
  // Criteria
  | { type: 'ADD_CONDITION'; target: 'main' | string; condition: Omit<CriteriaCondition, 'id' | 'type'> }
  | { type: 'UPDATE_CONDITION'; target: 'main' | string; condition: CriteriaCondition }
  | { type: 'REMOVE_CONDITION'; target: 'main' | string; conditionId: string }
  | { type: 'SET_CRITERIA_OPERATOR'; target: 'main' | string; operator: 'AND' | 'OR' }
  // Joins
  | { type: 'ADD_JOIN'; target: 'main' | string; join: Omit<QueryJoin, 'id'> & { id?: string } }
  | { type: 'UPDATE_JOIN'; target: 'main' | string; join: QueryJoin }
  | { type: 'REMOVE_JOIN'; target: 'main' | string; joinId: string }
  // Sort/Limit
  | { type: 'SET_SORT_LIMIT'; target: 'main' | string; sortLimit: SortLimit }
  | { type: 'ADD_SORT'; target: 'main' | string; sort: SortField }
  | { type: 'REMOVE_SORT'; target: 'main' | string; field: string }
  | { type: 'SET_LIMIT'; target: 'main' | string; limit: number | undefined }
  // Inputs
  | { type: 'ADD_INPUT'; input: Omit<QueryInput, 'id'> }
  | { type: 'UPDATE_INPUT'; input: QueryInput }
  | { type: 'REMOVE_INPUT'; inputId: string }
  // Flow Steps
  | { type: 'ADD_FLOW_STEP'; step: Omit<FlowStep, 'id'> }
  | { type: 'UPDATE_FLOW_STEP'; step: FlowStep }
  | { type: 'REMOVE_FLOW_STEP'; stepId: string }
  | { type: 'REORDER_FLOW_STEPS'; steps: FlowStep[] }
  // Subqueries
  | { type: 'ADD_SUBQUERY'; alias: string; id?: string; source?: string }
  | { type: 'UPDATE_SUBQUERY'; subquery: Subquery }
  | { type: 'REMOVE_SUBQUERY'; subqueryId: string }
  | { type: 'SET_SUBQUERY_ALIAS'; subqueryId: string; alias: string }
  | { type: 'SET_SUBQUERY_SOURCE'; subqueryId: string; source: string }

function getTargetFields(state: QueryDefinition, target: string): QueryField[] {
  if (target === 'main') return state.fields
  return state.subqueries.find(s => s.id === target)?.fields ?? []
}

function getTargetCriteria(state: QueryDefinition, target: string): CriteriaGroup {
  if (target === 'main') return state.criteria
  return state.subqueries.find(s => s.id === target)?.criteria ?? emptyGroup()
}

function updateTarget(state: QueryDefinition, target: string, updates: Partial<Subquery & { fields: QueryField[]; criteria: CriteriaGroup; joins: QueryJoin[]; sortLimit: SortLimit }>): QueryDefinition {
  if (target === 'main') {
    return { ...state, ...updates }
  }
  return {
    ...state,
    subqueries: state.subqueries.map(s =>
      s.id === target ? { ...s, ...updates } : s
    ),
  }
}

function reducer(state: QueryDefinition, action: Action): QueryDefinition {
  switch (action.type) {
    case 'SET_DEFINITION': return action.payload
    case 'SET_NAME': return { ...state, name: action.payload }
    case 'SET_DESCRIPTION': return { ...state, description: action.payload }
    case 'SET_DATASOURCE_META':
      return {
        ...state,
        datasource: action.payload.datasource,
        datasourceId: action.payload.datasourceId ?? '',
        datasourceLabel: action.payload.datasourceLabel ?? '',
      }
    case 'SET_TABLE_META':
      return {
        ...state,
        schema: action.payload.schema ?? '',
        table: action.payload.table,
        tableId: action.payload.tableId ?? '',
        tableLabel: action.payload.tableLabel ?? '',
      }

    case 'ADD_FIELD': {
      const fields = getTargetFields(state, action.target)
      const newField = { ...action.field, id: generateId() }
      return updateTarget(state, action.target, { fields: [...fields, newField] })
    }
    case 'UPDATE_FIELD': {
      const fields = getTargetFields(state, action.target)
      return updateTarget(state, action.target, {
        fields: fields.map(f => f.id === action.field.id ? action.field : f),
      })
    }
    case 'REMOVE_FIELD': {
      const fields = getTargetFields(state, action.target)
      return updateTarget(state, action.target, {
        fields: fields.filter(f => f.id !== action.fieldId),
      })
    }
    case 'REORDER_FIELDS':
      return updateTarget(state, action.target, { fields: action.fields })

    case 'ADD_CONDITION': {
      const criteria = getTargetCriteria(state, action.target)
      const newCond: CriteriaCondition = { ...action.condition, id: generateId(), type: 'condition' }
      return updateTarget(state, action.target, {
        criteria: { ...criteria, conditions: [...criteria.conditions, newCond] },
      })
    }
    case 'UPDATE_CONDITION': {
      const criteria = getTargetCriteria(state, action.target)
      const updateNodes = (nodes: CriteriaNode[]): CriteriaNode[] =>
        nodes.map(n => {
          if (n.type === 'condition' && n.id === action.condition.id) return action.condition
          if (n.type === 'group') return { ...n, conditions: updateNodes(n.conditions) }
          return n
        })
      return updateTarget(state, action.target, {
        criteria: { ...criteria, conditions: updateNodes(criteria.conditions) },
      })
    }
    case 'REMOVE_CONDITION': {
      const criteria = getTargetCriteria(state, action.target)
      const removeNode = (nodes: CriteriaNode[]): CriteriaNode[] =>
        nodes
          .filter(n => n.id !== action.conditionId)
          .map(n => n.type === 'group' ? { ...n, conditions: removeNode(n.conditions) } : n)
      return updateTarget(state, action.target, {
        criteria: { ...criteria, conditions: removeNode(criteria.conditions) },
      })
    }
    case 'SET_CRITERIA_OPERATOR': {
      const criteria = getTargetCriteria(state, action.target)
      return updateTarget(state, action.target, {
        criteria: { ...criteria, operator: action.operator },
      })
    }

    case 'ADD_JOIN': {
      const joins = action.target === 'main' ? state.joins : state.subqueries.find(s => s.id === action.target)?.joins ?? []
      const newJoin = { ...action.join, id: action.join.id ?? generateId() }
      return updateTarget(state, action.target, { joins: [...joins, newJoin] })
    }
    case 'UPDATE_JOIN': {
      const joins = action.target === 'main' ? state.joins : state.subqueries.find(s => s.id === action.target)?.joins ?? []
      return updateTarget(state, action.target, {
        joins: joins.map(j => j.id === action.join.id ? action.join : j),
      })
    }
    case 'REMOVE_JOIN': {
      const joins = action.target === 'main' ? state.joins : state.subqueries.find(s => s.id === action.target)?.joins ?? []
      return updateTarget(state, action.target, {
        joins: joins.filter(j => j.id !== action.joinId),
      })
    }

    case 'SET_SORT_LIMIT':
      return updateTarget(state, action.target, { sortLimit: action.sortLimit })
    case 'ADD_SORT': {
      const sl = action.target === 'main' ? state.sortLimit : state.subqueries.find(s => s.id === action.target)?.sortLimit ?? { sorts: [] }
      return updateTarget(state, action.target, {
        sortLimit: { ...sl, sorts: [...sl.sorts.filter(s => s.field !== action.sort.field), action.sort] },
      })
    }
    case 'REMOVE_SORT': {
      const sl = action.target === 'main' ? state.sortLimit : state.subqueries.find(s => s.id === action.target)?.sortLimit ?? { sorts: [] }
      return updateTarget(state, action.target, {
        sortLimit: { ...sl, sorts: sl.sorts.filter(s => s.field !== action.field) },
      })
    }
    case 'SET_LIMIT': {
      const sl = action.target === 'main' ? state.sortLimit : state.subqueries.find(s => s.id === action.target)?.sortLimit ?? { sorts: [] }
      return updateTarget(state, action.target, { sortLimit: { ...sl, limit: action.limit } })
    }

    case 'ADD_INPUT': {
      const input = { ...action.input, id: generateId() }
      return { ...state, inputs: [...state.inputs, input] }
    }
    case 'UPDATE_INPUT':
      return { ...state, inputs: state.inputs.map(i => i.id === action.input.id ? action.input : i) }
    case 'REMOVE_INPUT':
      return { ...state, inputs: state.inputs.filter(i => i.id !== action.inputId) }

    case 'ADD_FLOW_STEP': {
      const step = { ...action.step, id: generateId() }
      return { ...state, flowSteps: [...state.flowSteps, step] }
    }
    case 'UPDATE_FLOW_STEP':
      return { ...state, flowSteps: state.flowSteps.map(s => s.id === action.step.id ? action.step : s) }
    case 'REMOVE_FLOW_STEP':
      return { ...state, flowSteps: state.flowSteps.filter(s => s.id !== action.stepId) }
    case 'REORDER_FLOW_STEPS':
      return { ...state, flowSteps: action.steps }

    case 'ADD_SUBQUERY': {
      const sub = emptySubquery(action.alias)
      if (action.id) sub.id = action.id
      if (action.source) sub.source = action.source
      return { ...state, subqueries: [...state.subqueries, sub] }
    }
    case 'UPDATE_SUBQUERY':
      return { ...state, subqueries: state.subqueries.map(s => s.id === action.subquery.id ? action.subquery : s) }
    case 'REMOVE_SUBQUERY':
      return { ...state, subqueries: state.subqueries.filter(s => s.id !== action.subqueryId) }
    case 'SET_SUBQUERY_ALIAS':
      return { ...state, subqueries: state.subqueries.map(s => s.id === action.subqueryId ? { ...s, alias: action.alias } : s) }
    case 'SET_SUBQUERY_SOURCE':
      return { ...state, subqueries: state.subqueries.map(s => s.id === action.subqueryId ? { ...s, source: action.source } : s) }

    default: return state
  }
}


// Actions that should NOT push onto the undo stack (they are either
// external resets or trivial renames that fire on every keystroke).
const NON_UNDOABLE: Set<Action['type']> = new Set(['SET_DEFINITION'])

export function useQueryEditor(initial: QueryDefinition) {
  const [definition, dispatch] = useReducer(reducer, initial)

  // ── Undo / redo history ──────────────────────────────────────────────
  const undoStack = useRef<QueryDefinition[]>([])
  const redoStack = useRef<QueryDefinition[]>([])
  const lastSnapshot = useRef<QueryDefinition>(initial)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }, [])

  const wrappedDispatch = useCallback((action: Action) => {
    if (!NON_UNDOABLE.has(action.type)) {
      undoStack.current = [...undoStack.current.slice(-(MAX_HISTORY - 1)), lastSnapshot.current]
      redoStack.current = []
    }
    dispatch(action)
    syncFlags()
  }, [syncFlags])

  // Keep lastSnapshot in sync so undo captures the state *before* the
  // next action. Updated in an effect to satisfy React ref rules.
  useEffect(() => {
    lastSnapshot.current = definition
  }, [definition])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current = [...redoStack.current, lastSnapshot.current]
    dispatch({ type: 'SET_DEFINITION', payload: prev })
    syncFlags()
  }, [syncFlags])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current = [...undoStack.current, lastSnapshot.current]
    dispatch({ type: 'SET_DEFINITION', payload: next })
    syncFlags()
  }, [syncFlags])

  const setDefinition = useCallback((d: QueryDefinition) =>
    dispatch({ type: 'SET_DEFINITION', payload: d }), [])
  const setName = useCallback((n: string) =>
    wrappedDispatch({ type: 'SET_NAME', payload: n }), [wrappedDispatch])
  const setDescription = useCallback((d: string) =>
    wrappedDispatch({ type: 'SET_DESCRIPTION', payload: d }), [wrappedDispatch])
  const setDatasourceMeta = useCallback((payload: { datasource: string; datasourceId?: string; datasourceLabel?: string }) =>
    wrappedDispatch({ type: 'SET_DATASOURCE_META', payload }), [wrappedDispatch])
  const setTableMeta = useCallback((payload: { schema?: string; table: string; tableId?: string; tableLabel?: string }) =>
    wrappedDispatch({ type: 'SET_TABLE_META', payload }), [wrappedDispatch])

  return {
    definition,
    dispatch: wrappedDispatch,
    setDefinition, setName, setDescription, setDatasourceMeta, setTableMeta,
    undo, redo, canUndo, canRedo,
  }
}
