import type {
  CriteriaCondition,
  CriteriaGroup,
  QueryDefinition,
  QueryField,
  QueryInput,
  QueryJoin,
  QueryReference,
  SqlDialect,
  SortLimit,
  Subquery,
} from '@/types/query'

export interface SqlCompileResult {
  sql: string
  errors: string[]
}

type StageId = 'main' | string

type StageModel = Pick<Subquery, 'fields' | 'criteria' | 'joins' | 'sortLimit'> & {
  id: StageId
  label: string
  source?: StageId
}

interface AliasMap {
  source: string
  joins: Record<string, string>
}

interface StageContext {
  definition: QueryDefinition
  dialect: SqlDialect
  inputsByName: Map<string, QueryInput>
  errors: string[]
}

function quoteIdentifier(value: string, dialect: SqlDialect = 'postgresql') {
  if (dialect === 'mysql') return `\`${value.replace(/`/g, '``')}\``
  return `"${value.replace(/"/g, '""')}"`
}

function escapeLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function sqlLiteral(value: string) {
  const trimmed = value.trim()
  if (!trimmed.length) return "''"
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toUpperCase()
  if (/^null$/i.test(trimmed)) return 'NULL'
  return escapeLiteral(trimmed)
}

function safeAlias(seed: string, used: Set<string>) {
  let base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!base) base = 'ref'
  if (!/^[a-z_]/.test(base)) base = `a_${base}`

  let next = base
  let index = 1
  while (used.has(next)) {
    index += 1
    next = `${base}_${index}`
  }

  used.add(next)
  return next
}

function makeAliasMap(stage: StageModel): AliasMap {
  const used = new Set<string>(['src'])
  const joins: Record<string, string> = {}

  for (const join of stage.joins) {
    joins[join.id] = safeAlias(join.alias || join.tableLabel || join.table || join.id, used)
  }

  return { source: 'src', joins }
}

function compileReference(reference: QueryReference | undefined, fallback: string, aliases: AliasMap, dialect: SqlDialect = 'postgresql') {
  if (!reference) return fallback

  const alias = reference.relation === 'source'
    ? aliases.source
    : reference.relationId
      ? aliases.joins[reference.relationId]
      : undefined

  if (!alias) return fallback
  return `${quoteIdentifier(alias, dialect)}.${quoteIdentifier(reference.column, dialect)}`
}

function compileFieldExpression(field: QueryField, aliases: AliasMap, dialect: SqlDialect = 'postgresql') {
  if (field.expression?.trim()) return field.expression.trim()
  return compileReference(field.reference, field.column, aliases, dialect)
}

function aggregateExpression(expression: string, aggregate: QueryField['aggregate']) {
  switch (aggregate) {
    case 'count':
      return `COUNT(${expression})`
    case 'count_distinct':
      return `COUNT(DISTINCT ${expression})`
    case 'sum':
      return `SUM(${expression})`
    case 'avg':
      return `AVG(${expression})`
    case 'min':
      return `MIN(${expression})`
    case 'max':
      return `MAX(${expression})`
    default:
      return expression
  }
}

function compileSelect(fields: QueryField[], aliases: AliasMap, dialect: SqlDialect = 'postgresql') {
  if (fields.length === 0) {
    return `${quoteIdentifier(aliases.source, dialect)}.*`
  }

  return fields.map(field => {
    const expression = aggregateExpression(compileFieldExpression(field, aliases, dialect), field.aggregate)
    const alias = field.alias?.trim() || field.column?.trim() || 'column'
    return `${expression} AS ${quoteIdentifier(alias, dialect)}`
  }).join(',\n  ')
}

function compileGroupBy(fields: QueryField[], aliases: AliasMap, dialect: SqlDialect = 'postgresql') {
  const hasAggregate = fields.some(field => field.aggregate !== 'none')
  if (!hasAggregate) return ''

  const groupExpressions = fields
    .filter(field => field.aggregate === 'none')
    .map(field => compileFieldExpression(field, aliases, dialect))

  if (groupExpressions.length === 0) return ''
  return `GROUP BY ${groupExpressions.join(', ')}`
}

function compileInputValue(value: string, inputsByName: Map<string, QueryInput>) {
  const input = inputsByName.get(value)
  return sqlLiteral(input?.defaultValue ?? '')
}

function compileValue(
  condition: CriteriaCondition,
  key: 'value' | 'value2',
  aliases: AliasMap,
  inputsByName: Map<string, QueryInput>,
  dialect: SqlDialect = 'postgresql'
) {
  const raw = (condition[key] ?? '').trim()
  if (condition.valueType === 'field') {
    const reference = key === 'value' ? condition.valueRef : undefined
    return compileReference(reference, raw, aliases, dialect)
  }
  if (condition.valueType === 'input') {
    return compileInputValue(raw || condition.value, inputsByName)
  }
  return sqlLiteral(raw)
}

function compileInList(condition: CriteriaCondition, aliases: AliasMap, inputsByName: Map<string, QueryInput>, dialect: SqlDialect = 'postgresql') {
  if (condition.valueType === 'field') {
    return compileValue(condition, 'value', aliases, inputsByName, dialect)
  }

  if (condition.valueType === 'input') {
    return compileInputValue(condition.value, inputsByName)
  }

  const items = condition.value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (items.length === 0) return '(NULL)'
  return `(${items.map(sqlLiteral).join(', ')})`
}

function compileLike(left: string, value: string, pattern: 'contains' | 'starts_with' | 'ends_with', negate: boolean, dialect: SqlDialect) {
  const prefix = pattern === 'contains' || pattern === 'ends_with' ? "'%' || " : ''
  const suffix = pattern === 'contains' || pattern === 'starts_with' ? " || '%'" : ''
  const castVal = `CAST(${value} AS ${dialect === 'oracle' ? 'VARCHAR2(4000)' : 'TEXT'})`
  const castLeft = `CAST(${left} AS ${dialect === 'oracle' ? 'VARCHAR2(4000)' : 'TEXT'})`

  if (dialect === 'postgresql') {
    return `${castLeft} ${negate ? 'NOT ILIKE' : 'ILIKE'} ${prefix}${castVal}${suffix}`
  }
  // Oracle, MySQL, generic: use UPPER() LIKE UPPER()
  return `UPPER(${castLeft}) ${negate ? 'NOT LIKE' : 'LIKE'} ${prefix}UPPER(${castVal})${suffix}`
}

function compileCondition(condition: CriteriaCondition, aliases: AliasMap, inputsByName: Map<string, QueryInput>, dialect: SqlDialect = 'postgresql') {
  const left = compileReference(condition.fieldRef, condition.field, aliases, dialect)

  switch (condition.operator) {
    case 'equals':
      return `${left} = ${compileValue(condition, 'value', aliases, inputsByName, dialect)}`
    case 'not_equals':
      return `${left} <> ${compileValue(condition, 'value', aliases, inputsByName, dialect)}`
    case 'greater_than':
      return `${left} > ${compileValue(condition, 'value', aliases, inputsByName, dialect)}`
    case 'less_than':
      return `${left} < ${compileValue(condition, 'value', aliases, inputsByName, dialect)}`
    case 'greater_equal':
      return `${left} >= ${compileValue(condition, 'value', aliases, inputsByName, dialect)}`
    case 'less_equal':
      return `${left} <= ${compileValue(condition, 'value', aliases, inputsByName, dialect)}`
    case 'contains':
      return compileLike(left, compileValue(condition, 'value', aliases, inputsByName, dialect), 'contains', false, dialect)
    case 'not_contains':
      return compileLike(left, compileValue(condition, 'value', aliases, inputsByName, dialect), 'contains', true, dialect)
    case 'starts_with':
      return compileLike(left, compileValue(condition, 'value', aliases, inputsByName, dialect), 'starts_with', false, dialect)
    case 'ends_with':
      return compileLike(left, compileValue(condition, 'value', aliases, inputsByName, dialect), 'ends_with', false, dialect)
    case 'is_null':
      return `${left} IS NULL`
    case 'is_not_null':
      return `${left} IS NOT NULL`
    case 'in':
      return `${left} IN ${compileInList(condition, aliases, inputsByName, dialect)}`
    case 'not_in':
      return `${left} NOT IN ${compileInList(condition, aliases, inputsByName, dialect)}`
    case 'between':
      return `${left} BETWEEN ${compileValue(condition, 'value', aliases, inputsByName, dialect)} AND ${compileValue(condition, 'value2', aliases, inputsByName, dialect)}`
    default:
      return `${left} = ${compileValue(condition, 'value', aliases, inputsByName, dialect)}`
  }
}

function compileCriteria(group: CriteriaGroup, aliases: AliasMap, inputsByName: Map<string, QueryInput>, dialect: SqlDialect = 'postgresql'): string | null {
  const parts = group.conditions
    .map(node => {
      if (node.type === 'group') {
        const child = compileCriteria(node, aliases, inputsByName, dialect)
        return child ? `(${child})` : null
      }
      return compileCondition(node, aliases, inputsByName, dialect)
    })
    .filter(Boolean)

  if (parts.length === 0) return null
  return parts.join(` ${group.operator} `)
}

function compileJoin(join: QueryJoin, aliases: AliasMap, errors: string[], dialect: SqlDialect = 'postgresql') {
  if (!join.table || !join.schema) {
    errors.push(`Join "${join.alias || join.tableLabel || join.id}" is missing a table.`)
    return null
  }

  const joinAlias = aliases.joins[join.id]
  const conditions = join.conditions
    .filter(condition => condition.left && condition.right)
    .map(condition => {
      const left = compileReference(condition.leftRef, condition.left, aliases, dialect)
      const right = compileReference(condition.rightRef, condition.right, aliases, dialect)
      return `${left} = ${right}`
    })

  if (conditions.length === 0) {
    errors.push(`Join "${join.alias || join.tableLabel || join.id}" needs at least one match rule.`)
    return null
  }

  const keyword = `${join.type.toUpperCase()} JOIN`
  return `${keyword} ${quoteIdentifier(join.schema, dialect)}.${quoteIdentifier(join.table, dialect)} AS ${quoteIdentifier(joinAlias, dialect)} ON ${conditions.join(' AND ')}`
}

function compileSort(sortLimit: SortLimit, aliases: AliasMap, dialect: SqlDialect = 'postgresql') {
  if (sortLimit.sorts.length === 0) return ''
  return `ORDER BY ${sortLimit.sorts.map(sort => `${compileReference(sort.reference, sort.field, aliases, dialect)} ${sort.direction.toUpperCase()}`).join(', ')}`
}

function compileLimit(sortLimit: SortLimit, dialect: SqlDialect = 'postgresql') {
  if (!sortLimit.limit) return ''
  if (dialect === 'oracle') return `FETCH FIRST ${sortLimit.limit} ROWS ONLY`
  return `LIMIT ${sortLimit.limit}`
}

function stageFromDefinition(definition: QueryDefinition): StageModel {
  return {
    id: 'main',
    label: definition.tableLabel || definition.table || 'Main Query',
    fields: definition.fields,
    criteria: definition.criteria,
    joins: definition.joins,
    sortLimit: definition.sortLimit,
  }
}

function getStage(definition: QueryDefinition, stageId: StageId): StageModel | null {
  if (stageId === 'main') return stageFromDefinition(definition)
  const stage = definition.subqueries.find(item => item.id === stageId)
  if (!stage) return null
  return {
    id: stage.id,
    label: stage.alias || stage.id,
    source: stage.source || 'main',
    fields: stage.fields,
    criteria: stage.criteria,
    joins: stage.joins,
    sortLimit: stage.sortLimit,
  }
}

function cteName(stage: StageModel) {
  if (stage.id === 'main') return 'main_query'
  return safeAlias(`sq_${stage.label}_${String(stage.id).slice(0, 4)}`, new Set())
}

function buildStageSql(
  stage: StageModel,
  fromClause: string,
  context: StageContext
) {
  const { dialect } = context
  const aliases = makeAliasMap(stage)
  const selectSql = compileSelect(stage.fields, aliases, dialect)
  const joinSql = stage.joins
    .map(join => compileJoin(join, aliases, context.errors, dialect))
    .filter(Boolean)
    .join('\n')
  const whereSql = compileCriteria(stage.criteria, aliases, context.inputsByName, dialect)
  const groupBySql = compileGroupBy(stage.fields, aliases, dialect)
  const sortSql = compileSort(stage.sortLimit, aliases, dialect)
  const limitSql = compileLimit(stage.sortLimit, dialect)

  return [
    'SELECT',
    `  ${selectSql}`,
    fromClause,
    joinSql,
    whereSql ? `WHERE ${whereSql}` : '',
    groupBySql,
    sortSql,
    limitSql,
  ].filter(Boolean).join('\n')
}

export function compileQuerySql(definition: QueryDefinition, activeStageId: StageId = 'main', dialect: SqlDialect = 'postgresql'): SqlCompileResult {
  const errors: string[] = []
  const inputsByName = new Map(definition.inputs.map(input => [input.name, input]))
  const context: StageContext = { definition, dialect, inputsByName, errors }

  if (!definition.datasource) {
    return { sql: '', errors: ['Choose a datasource first.'] }
  }

  const activeStage = getStage(definition, activeStageId)
  if (!activeStage) {
    return { sql: '', errors: ['The selected query stage no longer exists.'] }
  }

  if (!definition.schema || !definition.table) {
    return { sql: '', errors: ['Choose a source table before running the query.'] }
  }

  const cteBodies = new Map<StageId, string>()
  const cteNames = new Map<StageId, string>()
  const stack = new Set<StageId>()

  const ensureStage = (stageId: StageId): string => {
    if (cteNames.has(stageId)) return cteNames.get(stageId) || 'main_query'
    if (stack.has(stageId)) {
      errors.push('A circular subquery reference was found.')
      return 'main_query'
    }

    const stage = getStage(definition, stageId)
    if (!stage) {
      errors.push(`Subquery source "${stageId}" is missing.`)
      return 'main_query'
    }

    stack.add(stageId)
    const nextCteName = cteName(stage)
    cteNames.set(stageId, nextCteName)

    const fromClause = stageId === 'main'
      ? `FROM ${quoteIdentifier(definition.schema, dialect)}.${quoteIdentifier(definition.table, dialect)} AS ${quoteIdentifier('src', dialect)}`
      : `FROM ${quoteIdentifier(ensureStage(stage.source || 'main'), dialect)} AS ${quoteIdentifier('src', dialect)}`

    cteBodies.set(stageId, buildStageSql(stage, fromClause, context))
    stack.delete(stageId)
    return nextCteName
  }

  const dependencyOrder: StageId[] = []

  const collectDependencies = (stageId: StageId) => {
    const stage = getStage(definition, stageId)
    if (!stage || stage.id === 'main') return

    const source = stage.source || 'main'
    if (source !== activeStageId) {
      collectDependencies(source)
      if (!dependencyOrder.includes(source)) {
        dependencyOrder.push(source)
      }
    }
  }

  collectDependencies(activeStageId)
  dependencyOrder.forEach(ensureStage)

  const finalFrom = activeStageId === 'main'
    ? `FROM ${quoteIdentifier(definition.schema, dialect)}.${quoteIdentifier(definition.table, dialect)} AS ${quoteIdentifier('src', dialect)}`
    : `FROM ${quoteIdentifier(ensureStage(activeStage.source || 'main'), dialect)} AS ${quoteIdentifier('src', dialect)}`

  const finalSql = buildStageSql(activeStage, finalFrom, context)

  const withSql = dependencyOrder
    .map(stageId => {
      const name = cteNames.get(stageId)
      const body = cteBodies.get(stageId)
      if (!name || !body) return null
      return `${quoteIdentifier(name, dialect)} AS (\n${body}\n)`
    })
    .filter(Boolean)
    .join(',\n')

  return {
    sql: withSql ? `WITH\n${withSql}\n${finalSql}` : finalSql,
    errors,
  }
}
