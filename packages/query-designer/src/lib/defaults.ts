import type { CriteriaGroup, QueryDefinition, Subquery } from '@/types/query'
import { generateId } from './utils'

export function emptyGroup(): CriteriaGroup {
  return { type: 'group', id: generateId(), operator: 'AND', conditions: [] }
}

export function emptySubquery(alias: string): Subquery {
  return {
    id: generateId(),
    alias,
    source: 'main',
    fields: [],
    criteria: emptyGroup(),
    joins: [],
    sortLimit: { sorts: [] },
  }
}

export function newQueryDefinition(name = 'Untitled Query'): QueryDefinition {
  return {
    id: generateId(),
    name,
    description: '',
    datasource: '',
    datasourceId: '',
    datasourceLabel: '',
    schema: '',
    table: '',
    tableId: '',
    tableLabel: '',
    fields: [],
    criteria: emptyGroup(),
    joins: [],
    sortLimit: { sorts: [] },
    inputs: [],
    flowSteps: [],
    subqueries: [],
  }
}
