import type {
  DatasourceColumn,
  DatasourceInfo,
  DatasourceRelation,
  DatasourceTable,
  QueryDefinition,
  QueryRecord,
} from '@/types/query'

import type { SqlDialect } from '@/types/query'

function detectDialect(type: string): SqlDialect {
  const t = type.toLowerCase()
  if (t.includes('postgres') || t === 'pg') return 'postgresql'
  if (t.includes('oracle') || t === 'oci') return 'oracle'
  if (t.includes('mysql') || t.includes('maria')) return 'mysql'
  if (t.includes('pick') || t.includes('multivalue') || t.includes('u2') || t.includes('rocket') || t.includes('d3') || t.includes('jbase') || t.includes('reality') || t.includes('sagitta')) return 'multivalue'
  return 'generic'
}

const FALLBACK_DATASOURCES: DatasourceInfo[] = [
  {
    id: 'admin:northwind',
    naturalId: 'admin:northwind',
    name: 'Northwind',
    type: 'postgres',
    family: 'sql',
    dialect: 'postgresql',
    schemas: ['public'],
  },
]

export interface SqlPreviewResult {
  rows: Record<string, unknown>[]
}

function encodePath(value: string) {
  return encodeURIComponent(value)
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return data?.message || data?.error || fallback
  } catch {
    return fallback
  }
}

async function requestJson<T>(url: string, init?: RequestInit, fallbackError = 'Request failed'): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, fallbackError))
  }
  return res.json()
}

export async function listDatasources(): Promise<DatasourceInfo[]> {
  try {
    const data = await requestJson<Record<string, unknown>>(
      '/api/datasources?limit=100&start=0&sort=name&embedded=true',
      undefined,
      'Failed to load datasources'
    )

    const rows = ((data?._embedded as Record<string, unknown>)?.['inf:datasource'] as Record<string, unknown>[] | undefined) ?? []

    const datasources = rows.map((row): DatasourceInfo => {
      const type = String(row.type ?? 'unknown')
      return {
        id: String(row.naturalId ?? row.id ?? ''),
        naturalId: String(row.naturalId ?? row.id ?? ''),
        name: String(row.name ?? row.naturalId ?? row.id ?? 'Datasource'),
        type,
        family: String(row.family ?? 'unknown'),
        dialect: detectDialect(type),
        schemas: Array.isArray(row.schemas) ? row.schemas.map(value => String(value)) : [],
      }
    }).filter(row => row.id)

    return datasources.length > 0 ? datasources : FALLBACK_DATASOURCES
  } catch {
    return FALLBACK_DATASOURCES
  }
}

export async function getDatasourceTables(datasourceId: string): Promise<DatasourceTable[]> {
  try {
    const data = await requestJson<Record<string, unknown>[]>(
      `/api/datasources/${encodePath(datasourceId)}/mappings-list`,
      undefined,
      'Failed to load datasource tables'
    )

    return data
      .map((row): DatasourceTable => ({
        id: String(row.id ?? ''),
        datasourceId,
        restId: String(row.restId ?? ''),
        schemaId: String(row.schemaId ?? ''),
        mappingId: String(row.mappingId ?? ''),
        label: `${String(row.schemaId ?? '')}.${String(row.mappingId ?? '')}`,
        name: String(row.name ?? row.mappingId ?? 'Table'),
        recordCount: typeof row.records === 'number'
          ? row.records
          : typeof (row.data as Record<string, unknown> | undefined)?.records === 'number'
            ? Number((row.data as Record<string, unknown>).records)
            : null,
        kind: String((row.data as Record<string, unknown> | undefined)?.relkind ?? ''),
      }))
      .filter(row => row.restId && row.mappingId)
      .sort((a, b) => a.label.localeCompare(b.label))
  } catch {
    const preview = await executeDatasourceSql(
      datasourceId,
      "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name",
      500
    )

    return preview.rows.map((row): DatasourceTable => {
      const schemaId = String(row.table_schema ?? 'public')
      const mappingId = String(row.table_name ?? '')
      return {
        id: `${datasourceId}:${schemaId}+${mappingId}`,
        datasourceId,
        restId: `${schemaId}+${mappingId}`,
        schemaId,
        mappingId,
        label: `${schemaId}.${mappingId}`,
        name: mappingId,
        recordCount: null,
        kind: '',
      }
    })
  }
}

export async function getDatasourceColumns(datasourceId: string, tableId: string): Promise<DatasourceColumn[]> {
  try {
    const data = await requestJson<Record<string, unknown>[]>(
      `/api/datasources/${encodePath(datasourceId)}/mappings/${encodePath(tableId)}/fields-list`,
      undefined,
      'Failed to load datasource columns'
    )

    return data
      .map((row): DatasourceColumn => ({
        id: String(row.id ?? `${tableId}:${row.fieldId ?? row.name ?? ''}`),
        datasourceId,
        schemaId: String((row.data as Record<string, unknown> | undefined)?.schemaId ?? tableId.split('+')[0] ?? ''),
        mappingId: String((row.data as Record<string, unknown> | undefined)?.mappingId ?? tableId.split('+')[1] ?? ''),
        fieldId: String(row.fieldId ?? row.name ?? ''),
        name: String(row.fieldId ?? row.name ?? ''),
        label: String(row.name ?? row.fieldId ?? ''),
        dataType: String(row.dataType ?? 'text'),
        ordinalPosition: Number(row.ordinalPosition ?? (row.data as Record<string, unknown> | undefined)?.ordinalPosition ?? 9999),
        isPrimaryKey: Boolean((row.data as Record<string, unknown> | undefined)?.isPk),
      }))
      .filter(row => row.name)
      .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
  } catch {
    const [schemaId, mappingId] = tableId.split('+')
    const preview = await executeDatasourceSql(
      datasourceId,
      `SELECT column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema = '${schemaId}' AND table_name = '${mappingId}' ORDER BY ordinal_position`,
      500
    )

    return preview.rows.map((row): DatasourceColumn => ({
      id: `${tableId}:${String(row.column_name ?? '')}`,
      datasourceId,
      schemaId,
      mappingId,
      fieldId: String(row.column_name ?? ''),
      name: String(row.column_name ?? ''),
      label: String(row.column_name ?? ''),
      dataType: String(row.data_type ?? 'text'),
      ordinalPosition: Number(row.ordinal_position ?? 9999),
      isPrimaryKey: false,
    }))
  }
}

export async function getDatasourceRelations(datasourceId: string): Promise<DatasourceRelation[]> {
  try {
    const data = await requestJson<Record<string, unknown>[]>(
      `/api/datasources/${encodePath(datasourceId)}/schema.json`,
      undefined,
      'Failed to load datasource relationships'
    )

    return data.map(row => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? row.as ?? 'Relationship'),
      alias: String(row.as ?? row.name ?? 'join'),
      from: Array.isArray(row.from) ? row.from.map(value => String(value)) : [],
      to: Array.isArray(row.to) ? row.to.map(value => String(value)) : [],
      defn: Array.isArray(row.defn)
        ? row.defn.map(rule => ({
          fromSchema: String((rule as Record<string, unknown>).fromSchema ?? ''),
          fromMapping: String((rule as Record<string, unknown>).fromMapping ?? ''),
          fromField: String((rule as Record<string, unknown>).fromField ?? ''),
          operator: String((rule as Record<string, unknown>).operator ?? '='),
          toSchema: String((rule as Record<string, unknown>).toSchema ?? ''),
          toMapping: String((rule as Record<string, unknown>).toMapping ?? ''),
          toField: String((rule as Record<string, unknown>).toField ?? ''),
        }))
        : [],
    }))
  } catch {
    return []
  }
}

export async function executeDatasourceSql(datasourceId: string, sql: string, limit = 100): Promise<SqlPreviewResult> {
  const rows = await requestJson<Record<string, unknown>[]>(
    `/api/datasources/${encodePath(datasourceId)}/_query?output=json&limit=${limit}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'sql', payload: sql }),
    },
    'Failed to run SQL preview'
  )

  return { rows }
}

// ─── Queries (workspace DB) ─────────────────────────────────────────────────

export async function listQueries(): Promise<QueryRecord[]> {
  const res = await fetch('/api/_server/queries')
  if (!res.ok) throw new Error('Failed to load queries')
  return res.json()
}

export async function getQuery(id: number): Promise<QueryRecord> {
  const res = await fetch(`/api/_server/queries/${id}`)
  if (!res.ok) throw new Error('Query not found')
  return res.json()
}

export async function createQuery(definition: QueryDefinition): Promise<QueryRecord> {
  const res = await fetch('/api/_server/queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: definition.name, description: definition.description, definition }),
  })
  if (!res.ok) throw new Error('Failed to create query')
  return res.json()
}

export async function updateQuery(id: number, definition: QueryDefinition): Promise<QueryRecord> {
  const res = await fetch(`/api/_server/queries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: definition.name, description: definition.description, definition }),
  })
  if (!res.ok) throw new Error('Failed to save query')
  return res.json()
}

export async function deleteQuery(id: number): Promise<void> {
  const res = await fetch(`/api/_server/queries/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete query')
}
