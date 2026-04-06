// GET /api/_server/responses — list all responses
export async function GET({ query }) {
  const rows = await query('SELECT * FROM responses ORDER BY updated_at DESC')
  return rows.map(row => ({
    ...row,
    sections: typeof row.sections === 'string' ? JSON.parse(row.sections) : row.sections,
    session_data: typeof row.session_data === 'string' ? JSON.parse(row.session_data) : row.session_data,
  }))
}

// POST /api/_server/responses — create or update a response
export async function POST({ request, query }) {
  const body = await request.json()
  const { id: responseId, startedAt, completedAt, sections, sessionData } = body

  if (!responseId) {
    return { status: 400, body: { error: 'Response id is required' } }
  }

  // Extract name/role from welcome section
  const welcome = sections?.welcome?.answers ?? {}
  const name = welcome.name?.value ?? null
  const role = welcome.role?.value ?? null
  const sectionsJson = JSON.stringify(sections ?? {})
  const sessionDataJson = sessionData ? JSON.stringify(sessionData) : null

  // Upsert
  const existing = await query('SELECT id FROM responses WHERE response_id = $1', [responseId])
  if (existing.length > 0) {
    await query(
      'UPDATE responses SET name = $1, role = $2, started_at = $3, completed_at = $4, sections = $5, session_data = $6, updated_at = NOW() WHERE response_id = $7',
      [name, role, startedAt, completedAt ?? null, sectionsJson, sessionDataJson, responseId]
    )
    const [row] = await query('SELECT * FROM responses WHERE response_id = $1', [responseId])
    return row
  }

  await query(
    'INSERT INTO responses (response_id, name, role, started_at, completed_at, sections, session_data) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [responseId, name, role, startedAt, completedAt ?? null, sectionsJson, sessionDataJson]
  )
  const [row] = await query('SELECT * FROM responses WHERE response_id = $1', [responseId])
  return row
}
