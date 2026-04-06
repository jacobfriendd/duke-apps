// ─── Datasource ───────────────────────────────────────────────────────────────

export type SqlDialect = 'postgresql' | 'oracle' | 'mysql' | 'multivalue' | 'generic'

export interface DatasourceInfo {
  id: string
  naturalId: string
  name: string
  type: string
  family: string
  dialect: SqlDialect
  schemas: string[]
  reachable?: boolean
  supportsSQL?: boolean
}

export interface DatasourceTable {
  id: string
  datasourceId: string
  restId: string
  schemaId: string
  mappingId: string
  label: string
  name: string
  recordCount?: number | null
  kind?: string
}

export interface DatasourceColumn {
  id: string
  datasourceId: string
  schemaId: string
  mappingId: string
  fieldId: string
  name: string
  label: string
  dataType: string
  ordinalPosition: number
  isPrimaryKey: boolean
}

export interface DatasourceRelationRule {
  fromSchema: string
  fromMapping: string
  fromField: string
  operator: string
  toSchema: string
  toMapping: string
  toField: string
}

export interface DatasourceRelation {
  id: string
  name: string
  alias: string
  from: string[]
  to: string[]
  defn: DatasourceRelationRule[]
}

// Deprecated compatibility types for legacy editor panels.
export interface DatasetInfo {
  id: string
  label: string
}

export interface DatasetField {
  name: string
  label: string
  dataType: string
  position: number
}

export interface QueryReference {
  relation: 'source' | 'join'
  relationId?: string
  column: string
}

// ─── Field ────────────────────────────────────────────────────────────────────

export type AggregateFunction = 'none' | 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct'

export interface QueryField {
  id: string
  column: string
  alias: string
  aggregate: AggregateFunction
  reference?: QueryReference
  expression?: string  // for calculated fields
  format?: string
}

// ─── Criteria ────────────────────────────────────────────────────────────────

export type ComparisonOperator =
  | 'equals' | 'not_equals'
  | 'greater_than' | 'less_than'
  | 'greater_equal' | 'less_equal'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'is_null' | 'is_not_null'
  | 'in' | 'not_in'
  | 'between'

export type CriteriaValueType = 'literal' | 'field' | 'input'

export interface CriteriaCondition {
  type: 'condition'
  id: string
  field: string
  fieldRef?: QueryReference
  operator: ComparisonOperator
  valueType: CriteriaValueType
  value: string
  valueRef?: QueryReference
  value2?: string // for 'between'
}

export interface CriteriaGroup {
  type: 'group'
  id: string
  operator: 'AND' | 'OR'
  conditions: CriteriaNode[]
}

export type CriteriaNode = CriteriaCondition | CriteriaGroup

// ─── Join ─────────────────────────────────────────────────────────────────────

export type JoinType = 'inner' | 'left' | 'right' | 'full'

export interface JoinCondition {
  left: string
  leftRef?: QueryReference
  right: string
  rightRef?: QueryReference
}

export interface QueryJoin {
  id: string
  table: string
  tableId?: string
  tableLabel?: string
  schema?: string
  alias: string
  type: JoinType
  conditions: JoinCondition[]
}

// ─── Sort / Limit ─────────────────────────────────────────────────────────────

export interface SortField {
  field: string
  label?: string
  reference?: QueryReference
  direction: 'asc' | 'desc'
}

export interface SortLimit {
  sorts: SortField[]
  limit?: number
  offset?: number
}

// ─── Input (Parameter) ────────────────────────────────────────────────────────

export type InputType = 'string' | 'number' | 'date' | 'boolean' | 'enum'

export interface QueryInput {
  id: string
  name: string
  label: string
  type: InputType
  defaultValue?: string
  required: boolean
  options?: string[]  // for enum type
  placeholder?: string
}

// ─── Flow Step ────────────────────────────────────────────────────────────────

export type FlowStepType =
  | 'rename'
  | 'calculate'
  | 'filter'
  | 'format'
  | 'conditional'
  | 'remove'
  | 'sort'

export interface RenameStepConfig {
  field: string
  newName: string
}

export interface CalculateStepConfig {
  outputField: string
  expression: string  // plain language: "field1 + field2", "field1 * 100 / field2"
  description?: string
}

export interface FilterStepConfig {
  field: string
  operator: ComparisonOperator
  value: string
}

export interface FormatStepConfig {
  field: string
  formatType: 'number' | 'currency' | 'date' | 'uppercase' | 'lowercase' | 'trim' | 'round'
  pattern?: string
  decimals?: number
  currency?: string
}

export interface ConditionalCase {
  when: string  // plain language condition
  then: string  // output value
}

export interface ConditionalStepConfig {
  outputField: string
  cases: ConditionalCase[]
  elseValue: string
}

export interface RemoveStepConfig {
  fields: string[]
}

export interface SortStepConfig {
  sorts: SortField[]
}

export type FlowStepConfig =
  | RenameStepConfig
  | CalculateStepConfig
  | FilterStepConfig
  | FormatStepConfig
  | ConditionalStepConfig
  | RemoveStepConfig
  | SortStepConfig

export interface FlowStep {
  id: string
  type: FlowStepType
  label: string
  config: FlowStepConfig
}

// ─── Subquery ─────────────────────────────────────────────────────────────────

export interface Subquery {
  id: string
  alias: string
  source: string   // 'main' | another subquery alias
  fields: QueryField[]
  criteria: CriteriaGroup
  joins: QueryJoin[]
  sortLimit: SortLimit
}

// ─── Top-level Query Definition ───────────────────────────────────────────────

export interface QueryDefinition {
  id: string
  name: string
  description?: string
  datasource: string
  datasourceId?: string
  datasourceLabel?: string
  schema?: string
  table: string
  tableId?: string
  tableLabel?: string
  fields: QueryField[]
  criteria: CriteriaGroup
  joins: QueryJoin[]
  sortLimit: SortLimit
  inputs: QueryInput[]
  flowSteps: FlowStep[]
  subqueries: Subquery[]
  createdAt?: string
  updatedAt?: string
}

// ─── Stored record (workspace DB row) ────────────────────────────────────────

export interface QueryRecord {
  id: number
  name: string
  description: string | null
  definition: QueryDefinition
  created_at: string
  updated_at: string
}

// ─── Section navigation ────────────────────────────────────────────────────────

export type SectionId = 'fields' | 'criteria' | 'joins' | 'sort'

export type TabId = 'main' | string  // 'main' or subquery id

// ─── Query Tab (multi-query UI) ─────────────────────────────────────────────

export interface QueryTab {
  id: string
  record: QueryRecord
  label: string
}
