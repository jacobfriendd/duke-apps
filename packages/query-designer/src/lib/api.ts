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

// No hardcoded fallback — datasources are always fetched dynamically from the platform

export interface SqlPreviewResult {
  rows: Record<string, unknown>[]
}

const REQUEST_TIMEOUT = 15_000

async function fetchWithTimeout(url: string, init?: RequestInit, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const existing = init?.signal

  // If caller already supplies a signal, forward its abort
  if (existing) {
    if (existing.aborted) {
      controller.abort(existing.reason)
    } else {
      existing.addEventListener('abort', () => controller.abort(existing.reason), { once: true })
    }
  }

  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out (${url})`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
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
  const res = await fetchWithTimeout(url, init)
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, fallbackError))
  }
  return res.json()
}

export async function pingDatasource(datasourceId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `/api/datasources/${datasourceId}/_ping`,
      { method: 'POST' },
      5_000,
    )
    return res.ok
  } catch {
    return false
  }
}

export async function listDatasources(): Promise<DatasourceInfo[]> {
  let rows: Record<string, unknown>[] = []

  // Try the platform listing endpoint
  try {
    const res = await fetchWithTimeout('/api/datasources-list', undefined, 5_000)
    if (res.ok) {
      const data = await res.json()
      rows = Array.isArray(data) ? data : (data?.items ?? data?.datasources ?? data?.results ?? [])
    }
  } catch {
    // listing endpoint unavailable
  }

  // If listing returned nothing, discover datasources by probing known IDs.
  // The Informer platform may not expose a list endpoint but individual
  // datasource operations still work.
  if (rows.length === 0) {
    const probeIds = ['admin:northwind', 'northwind', 'admin:postgres', 'postgres', 'admin:mysql', 'mysql', 'admin:oracle', 'oracle']
    const probes = await Promise.all(probeIds.map(async (id): Promise<DatasourceInfo | null> => {
      const reachable = await pingDatasource(id)
      if (!reachable) return null
      // Try to get tables to confirm it's real and extract name
      const name = id.includes(':') ? id.split(':')[1] : id
      return {
        id,
        naturalId: id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        type: 'unknown',
        family: 'sql',
        dialect: detectDialect(name),
        schemas: [],
        reachable: true,
        supportsSQL: true,
      }
    }))
    return probes.filter((ds): ds is DatasourceInfo => ds !== null)
  }

  const datasources = rows
    .map((row): DatasourceInfo => {
      const type = String(row.type ?? 'unknown')
      const family = String(row.family ?? 'unknown')
      const languages = Array.isArray(row.languages) ? (row.languages as string[]) : []
      return {
        id: String(row.naturalId ?? row.id ?? ''),
        naturalId: String(row.naturalId ?? row.id ?? ''),
        name: String(row.name ?? row.naturalId ?? row.id ?? 'Datasource'),
        type,
        family,
        dialect: detectDialect(type),
        schemas: Array.isArray(row.schemas) ? row.schemas.map(value => String(value)) : [],
        supportsSQL: family === 'sql' || languages.includes('sql'),
      }
    })
    .filter(row => row.id)

  if (datasources.length === 0) return []

  // Ping all datasources in parallel to check connectivity
  const pings = await Promise.all(
    datasources.map(ds => pingDatasource(ds.naturalId))
  )
  return datasources.map((ds, i) => ({ ...ds, reachable: pings[i] }))
}

export async function getDatasourceTables(datasourceId: string): Promise<DatasourceTable[]> {
  try {
    const data = await requestJson<Record<string, unknown>[]>(
      `/api/datasources/${datasourceId}/mappings-list`,
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
    // Try dialect-aware fallback queries
    const fallbackQueries: Record<string, string> = {
      oracle: "SELECT owner AS table_schema, table_name FROM all_tables WHERE owner NOT IN ('SYS','SYSTEM','OUTLN','DIP') ORDER BY owner, table_name",
      default: "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name",
    }

    // Detect dialect from datasourceId if possible — for fallback we try the default (pg/mysql) first
    let preview: SqlPreviewResult
    try {
      preview = await executeDatasourceSql(datasourceId, fallbackQueries.default, 500)
    } catch {
      // information_schema failed — try Oracle-style catalog
      try {
        preview = await executeDatasourceSql(datasourceId, fallbackQueries.oracle, 500)
      } catch {
        return [] // No fallback available for this database type
      }
    }

    return preview.rows.map((row): DatasourceTable => {
      const schemaId = String(row.table_schema ?? row.owner ?? 'public')
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
      `/api/datasources/${datasourceId}/mappings/${tableId}/fields-list`,
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
    const safeSchema = schemaId.replace(/'/g, "''")
    const safeMapping = mappingId.replace(/'/g, "''")

    const fallbackDefault = `SELECT column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema = '${safeSchema}' AND table_name = '${safeMapping}' ORDER BY ordinal_position`
    const fallbackOracle = `SELECT column_name, data_type, column_id AS ordinal_position FROM all_tab_columns WHERE owner = '${safeSchema}' AND table_name = '${safeMapping}' ORDER BY column_id`

    let preview: SqlPreviewResult
    try {
      preview = await executeDatasourceSql(datasourceId, fallbackDefault, 500)
    } catch {
      try {
        preview = await executeDatasourceSql(datasourceId, fallbackOracle, 500)
      } catch {
        return []
      }
    }

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
      `/api/datasources/${datasourceId}/schema.json`,
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
  const res = await fetchWithTimeout(
    `/api/datasources/${datasourceId}/_query?output=json&limit=${limit}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'sql', payload: sql, limit, options: {} }),
    },
  )

  if (!res.ok) {
    throw new Error(await readErrorMessage(res, 'Failed to run SQL preview'))
  }

  const data = await res.json()
  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data.rows || data.records || data.data || data.results || []
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
