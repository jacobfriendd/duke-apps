/**
 * SQL Decompiler — parses pseudo-SQL back into QueryDefinition patches.
 *
 * This is intentionally lenient. It handles the common patterns a user would
 * type and quietly ignores anything it can't parse. Column name casing is
 * corrected against a known column list.
 */

import type {
  AggregateFunction,
  ComparisonOperator,
  CriteriaCondition,
  CriteriaGroup,
  CriteriaNode,
  DatasourceColumn,
  JoinType,
  QueryDefinition,
  QueryField,
  QueryJoin,
  QueryReference,
  SortField,
  SortLimit,
} from '@/types/query'
import { generateId } from './utils'

export interface DecompileResult {
  patch: Partial<QueryDefinition>
  errors: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Strip surrounding quotes (double, single, or backtick) from an identifier. */
function unquote(s: string): string {
  const trimmed = s.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/** Strip surrounding single quotes from a string literal. */
function unquoteLiteral(s: string): string {
  const trimmed = s.trim()
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'")
  }
  return trimmed
}

type ColumnFixMap = Map<string, string>

function buildColumnFixMap(columns: DatasourceColumn[]): ColumnFixMap {
  const map = new Map<string, string>()
  for (const col of columns) {
    map.set(col.name.toLowerCase(), col.name)
  }
  return map
}

function fixCol(name: string, fixMap: ColumnFixMap): string {
  return fixMap.get(name.toLowerCase()) ?? name
}

function sourceRef(column: string): QueryReference {
  return { relation: 'source', column }
}

// ── Tokenizer ─────────────────────────────────────────────────────────────

/**
 * Split SQL into clauses. We look for top-level keywords and split on them.
 * This is NOT a full parser — it handles the patterns the compiler produces
 * plus the kinds of things users will type freehand.
 */
interface SqlClauses {
  select: string
  from: string
  joins: string[]
  where: string
  groupBy: string
  orderBy: string
  limit: string
  offset: string
}

function splitClauses(sql: string): SqlClauses {
  // Normalize whitespace
  const normalized = sql.replace(/\s+/g, ' ').trim()

  const result: SqlClauses = {
    select: '',
    from: '',
    joins: [],
    where: '',
    groupBy: '',
    orderBy: '',
    limit: '',
    offset: '',
  }

  // Regex to match top-level keywords (case-insensitive).
  // We capture everything between keywords.
  const keywordPattern = /\b(SELECT|FROM|(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN|JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|OFFSET|FETCH\s+FIRST)\b/gi

  const matches: { keyword: string; index: number }[] = []
  let match: RegExpExecArray | null
  while ((match = keywordPattern.exec(normalized)) !== null) {
    matches.push({ keyword: match[1].toUpperCase().replace(/\s+/g, ' '), index: match.index })
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].keyword.length
    const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length
    const body = normalized.slice(start, end).trim().replace(/;$/, '').trim()
    const kw = matches[i].keyword

    if (kw === 'SELECT') {
      result.select = body
    } else if (kw === 'FROM') {
      result.from = body
    } else if (kw.endsWith('JOIN') || kw === 'JOIN') {
      result.joins.push(`${kw} ${body}`)
    } else if (kw === 'WHERE') {
      result.where = body
    } else if (kw === 'GROUP BY') {
      result.groupBy = body
    } else if (kw === 'ORDER BY') {
      result.orderBy = body
    } else if (kw === 'LIMIT') {
      result.limit = body
    } else if (kw === 'OFFSET') {
      result.offset = body
    } else if (kw === 'FETCH FIRST') {
      // Oracle-style: FETCH FIRST N ROWS ONLY
      const n = body.match(/^(\d+)/)
      if (n) result.limit = n[1]
    }
  }

  return result
}

// ── SELECT parser ─────────────────────────────────────────────────────────

const AGGREGATE_PATTERN = /^(COUNT\s*\(\s*DISTINCT|COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(.*?)\s*\)\s*$/i
const AGGREGATE_MAP: Record<string, AggregateFunction> = {
  'count': 'count',
  'count distinct': 'count_distinct',
  'sum': 'sum',
  'avg': 'avg',
  'min': 'min',
  'max': 'max',
}

function parseSelectFields(selectClause: string, fixMap: ColumnFixMap): QueryField[] | null {
  if (!selectClause) return null

  const trimmed = selectClause.trim()

  // SELECT * or src.* — means "all columns, no explicit fields"
  if (/^\*$|^"?\w+"?\.\*$/.test(trimmed)) return null

  // Split on commas, respecting parentheses
  const parts = splitTopLevel(trimmed, ',')
  const fields: QueryField[] = []

  for (const raw of parts) {
    const part = raw.trim()
    if (!part) continue

    // Check for AS alias
    const aliasMatch = part.match(/^([\s\S]+?)\s+AS\s+(.+)$/i)
    let expr: string
    let alias: string

    if (aliasMatch) {
      expr = aliasMatch[1].trim()
      alias = unquote(aliasMatch[2].trim())
    } else {
      expr = part
      alias = ''
    }

    // Check for aggregate function
    const aggMatch = expr.match(AGGREGATE_PATTERN)
    let aggregate: AggregateFunction = 'none'
    let column: string

    if (aggMatch) {
      const funcName = aggMatch[1].toUpperCase().replace(/\s+/g, ' ')
      aggregate = AGGREGATE_MAP[funcName.toLowerCase()] ?? 'none'
      // The inner expression — strip the extra paren from COUNT(DISTINCT ...)
      column = unquote(stripTablePrefix(aggMatch[2].replace(/^\(/, '').trim()))
    } else {
      column = unquote(stripTablePrefix(expr))
    }

    column = fixCol(column, fixMap)
    if (!alias) alias = column

    fields.push({
      id: generateId(),
      column,
      alias,
      aggregate,
      reference: sourceRef(column),
    })
  }

  return fields.length > 0 ? fields : null
}

/** Strip "src"., "table"., schema.table. prefixes from a column reference. */
function stripTablePrefix(expr: string): string {
  // "src"."Column" or src.Column or "schema"."table"."Column"
  const parts = expr.split('.')
  return unquote(parts[parts.length - 1])
}

/** Split a string on a delimiter, respecting parentheses depth. */
function splitTopLevel(s: string, delimiter: string): string[] {
  const result: string[] = []
  let depth = 0
  let current = ''
  let inSingleQuote = false

  for (let i = 0; i < s.length; i++) {
    const char = s[i]

    if (char === "'" && !inSingleQuote) {
      inSingleQuote = true
      current += char
    } else if (char === "'" && inSingleQuote) {
      // Check for escaped quote ''
      if (i + 1 < s.length && s[i + 1] === "'") {
        current += "''"
        i++
      } else {
        inSingleQuote = false
        current += char
      }
    } else if (inSingleQuote) {
      current += char
    } else if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth--
      current += char
    } else if (depth === 0 && s.slice(i, i + delimiter.length) === delimiter) {
      result.push(current)
      current = ''
      i += delimiter.length - 1
    } else {
      current += char
    }
  }
  if (current.trim()) result.push(current)
  return result
}

// ── WHERE parser ──────────────────────────────────────────────────────────

const OPERATOR_MAP: [RegExp, ComparisonOperator, boolean][] = [
  [/^(.+?)\s+NOT\s+IN\s*\((.+)\)\s*$/i, 'not_in', false],
  [/^(.+?)\s+IN\s*\((.+)\)\s*$/i, 'in', false],
  [/^(.+?)\s+NOT\s+BETWEEN\s+(.+?)\s+AND\s+(.+)$/i, 'not_equals', false], // fallback
  [/^(.+?)\s+BETWEEN\s+(.+?)\s+AND\s+(.+)$/i, 'between', true],
  [/^(.+?)\s+IS\s+NOT\s+NULL\s*$/i, 'is_not_null', false],
  [/^(.+?)\s+IS\s+NULL\s*$/i, 'is_null', false],
  [/^(.+?)\s+(?:NOT\s+)?ILIKE\s+'%(.+)%'\s*$/i, 'contains', false],
  [/^(.+?)\s+(?:NOT\s+)?ILIKE\s+'(.+)%'\s*$/i, 'starts_with', false],
  [/^(.+?)\s+(?:NOT\s+)?ILIKE\s+'%(.+)'\s*$/i, 'ends_with', false],
  [/^(.+?)\s+(?:NOT\s+)?LIKE\s+'%(.+)%'\s*$/i, 'contains', false],
  [/^(.+?)\s+(?:NOT\s+)?LIKE\s+'(.+)%'\s*$/i, 'starts_with', false],
  [/^(.+?)\s+(?:NOT\s+)?LIKE\s+'%(.+)'\s*$/i, 'ends_with', false],
  [/^(.+?)\s*<>\s*(.+)$/i, 'not_equals', false],
  [/^(.+?)\s*!=\s*(.+)$/i, 'not_equals', false],
  [/^(.+?)\s*>=\s*(.+)$/i, 'greater_equal', false],
  [/^(.+?)\s*<=\s*(.+)$/i, 'less_equal', false],
  [/^(.+?)\s*>\s*(.+)$/i, 'greater_than', false],
  [/^(.+?)\s*<\s*(.+)$/i, 'less_than', false],
  [/^(.+?)\s*=\s*(.+)$/i, 'equals', false],
]

function parseWhereClause(whereClause: string, fixMap: ColumnFixMap): CriteriaGroup | null {
  if (!whereClause.trim()) return null

  // Split on top-level AND/OR
  // First try to detect if this is an OR-based group
  const orParts = splitTopLevelLogical(whereClause, 'OR')
  if (orParts.length > 1) {
    const conditions = orParts
      .map(part => parseWhereClause(part, fixMap))
      .filter((g): g is CriteriaGroup => g !== null)

    // Flatten: if each sub-result is a single condition, pull them up
    const flatConditions: CriteriaNode[] = []
    for (const g of conditions) {
      if (g.conditions.length === 1) {
        flatConditions.push(g.conditions[0])
      } else {
        flatConditions.push(g)
      }
    }

    return {
      type: 'group',
      id: generateId(),
      operator: 'OR',
      conditions: flatConditions,
    }
  }

  const andParts = splitTopLevelLogical(whereClause, 'AND')
  const conditions: CriteriaNode[] = []

  for (const part of andParts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // Strip surrounding parens if the whole thing is wrapped
    const unwrapped = trimmed.startsWith('(') && trimmed.endsWith(')')
      ? trimmed.slice(1, -1).trim()
      : trimmed

    const condition = parseSingleCondition(unwrapped, fixMap)
    if (condition) {
      conditions.push(condition)
    }
  }

  if (conditions.length === 0) return null

  return {
    type: 'group',
    id: generateId(),
    operator: 'AND',
    conditions,
  }
}

function parseSingleCondition(expr: string, fixMap: ColumnFixMap): CriteriaCondition | null {
  for (const [pattern, operator, isBetween] of OPERATOR_MAP) {
    const match = expr.match(pattern)
    if (!match) continue

    const field = fixCol(unquote(stripTablePrefix(match[1].trim())), fixMap)

    if (operator === 'is_null' || operator === 'is_not_null') {
      return {
        type: 'condition',
        id: generateId(),
        field,
        fieldRef: sourceRef(field),
        operator,
        valueType: 'literal',
        value: '',
      }
    }

    if (operator === 'in' || operator === 'not_in') {
      const items = match[2].split(',').map(s => unquoteLiteral(s.trim())).join(', ')
      return {
        type: 'condition',
        id: generateId(),
        field,
        fieldRef: sourceRef(field),
        operator,
        valueType: 'literal',
        value: items,
      }
    }

    if (isBetween) {
      return {
        type: 'condition',
        id: generateId(),
        field,
        fieldRef: sourceRef(field),
        operator: 'between',
        valueType: 'literal',
        value: unquoteLiteral(match[2].trim()),
        value2: unquoteLiteral(match[3].trim()),
      }
    }

    if (operator === 'contains' || operator === 'starts_with' || operator === 'ends_with') {
      return {
        type: 'condition',
        id: generateId(),
        field,
        fieldRef: sourceRef(field),
        operator,
        valueType: 'literal',
        value: match[2], // already stripped of % wildcards by the regex
      }
    }

    return {
      type: 'condition',
      id: generateId(),
      field,
      fieldRef: sourceRef(field),
      operator,
      valueType: 'literal',
      value: unquoteLiteral(match[2].trim()),
    }
  }

  return null
}

/** Split on a logical keyword (AND/OR) at the top level (outside parens). */
function splitTopLevelLogical(s: string, keyword: 'AND' | 'OR'): string[] {
  const result: string[] = []
  let depth = 0
  let current = ''
  let inSingleQuote = false
  const kwLen = keyword.length
  const upper = s.toUpperCase()

  for (let i = 0; i < s.length; i++) {
    const char = s[i]

    if (char === "'" && !inSingleQuote) {
      inSingleQuote = true
      current += char
    } else if (char === "'" && inSingleQuote) {
      if (i + 1 < s.length && s[i + 1] === "'") {
        current += "''"
        i++
      } else {
        inSingleQuote = false
        current += char
      }
    } else if (inSingleQuote) {
      current += char
    } else if (char === '(') {
      depth++
      current += char
    } else if (char === ')') {
      depth--
      current += char
    } else if (
      depth === 0 &&
      upper.slice(i, i + kwLen + 2) === ` ${keyword} `
    ) {
      result.push(current)
      current = ''
      i += kwLen + 1
      continue
    } else {
      current += char
    }
  }
  if (current.trim()) result.push(current)
  return result
}

// ── JOIN parser ───────────────────────────────────────────────────────────

const JOIN_PATTERN = /^(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+(.+?)\s+(?:AS\s+)?(\w+|"[^"]+")\s+ON\s+(.+)$/i

function parseJoins(joinClauses: string[], fixMap: ColumnFixMap): QueryJoin[] {
  const joins: QueryJoin[] = []

  for (const clause of joinClauses) {
    const match = clause.match(JOIN_PATTERN)
    if (!match) continue

    const joinTypeRaw = (match[1] || 'inner').toLowerCase() as JoinType
    const tableRef = match[2].trim()
    const alias = unquote(match[3].trim())
    const onClause = match[4].trim()

    // Parse schema.table
    const tableParts = tableRef.split('.').map(p => unquote(p.trim()))
    const schema = tableParts.length > 1 ? tableParts[0] : ''
    const table = tableParts.length > 1 ? tableParts[1] : tableParts[0]

    // Parse ON conditions (col1 = col2 AND col3 = col4)
    const onParts = onClause.split(/\s+AND\s+/i)
    const conditions = onParts
      .map(part => {
        const eqMatch = part.trim().match(/^(.+?)\s*=\s*(.+)$/)
        if (!eqMatch) return null
        return {
          left: fixCol(unquote(stripTablePrefix(eqMatch[1].trim())), fixMap),
          right: unquote(stripTablePrefix(eqMatch[2].trim())),
        }
      })
      .filter((c): c is { left: string; right: string } => c !== null)

    joins.push({
      id: generateId(),
      table,
      schema,
      tableId: schema ? `${schema}+${table}` : undefined,
      alias,
      type: joinTypeRaw,
      conditions,
    })
  }

  return joins
}

// ── ORDER BY / LIMIT parser ───────────────────────────────────────────────

function parseOrderBy(orderByClause: string, fixMap: ColumnFixMap): SortField[] {
  if (!orderByClause.trim()) return []

  return orderByClause.split(',').map(part => {
    const trimmed = part.trim()
    const dirMatch = trimmed.match(/^(.+?)\s+(ASC|DESC)\s*$/i)
    const expr = dirMatch ? dirMatch[1].trim() : trimmed
    const direction: 'asc' | 'desc' = dirMatch && dirMatch[2].toUpperCase() === 'DESC' ? 'desc' : 'asc'
    const column = fixCol(unquote(stripTablePrefix(expr)), fixMap)

    return {
      field: column,
      direction,
      reference: sourceRef(column),
    }
  })
}

function parseLimit(limitStr: string): number | undefined {
  const n = parseInt(limitStr.trim(), 10)
  return isNaN(n) ? undefined : n
}

// ── Main entry point ──────────────────────────────────────────────────────

export function decompileSql(
  sql: string,
  knownColumns: DatasourceColumn[],
): DecompileResult {
  const errors: string[] = []
  const fixMap = buildColumnFixMap(knownColumns)
  const clauses = splitClauses(sql)

  const patch: Partial<QueryDefinition> = {}

  // Fields
  const fields = parseSelectFields(clauses.select, fixMap)
  if (fields) {
    patch.fields = fields
  }

  // Criteria
  const criteria = parseWhereClause(clauses.where, fixMap)
  if (criteria) {
    patch.criteria = criteria
  } else if (clauses.where === '' && sql.toUpperCase().includes('SELECT')) {
    // User cleared the WHERE — set empty criteria
    patch.criteria = { type: 'group', id: generateId(), operator: 'AND', conditions: [] }
  }

  // Joins
  if (clauses.joins.length > 0) {
    const joins = parseJoins(clauses.joins, fixMap)
    if (joins.length > 0) {
      patch.joins = joins
    }
  }

  // Sort & Limit
  const sorts = parseOrderBy(clauses.orderBy, fixMap)
  const limit = clauses.limit ? parseLimit(clauses.limit) : undefined
  const offset = clauses.offset ? parseLimit(clauses.offset) : undefined

  if (sorts.length > 0 || limit !== undefined) {
    const sortLimit: SortLimit = { sorts }
    if (limit !== undefined) sortLimit.limit = limit
    if (offset !== undefined) sortLimit.offset = offset
    patch.sortLimit = sortLimit
  }

  return { patch, errors }
}
