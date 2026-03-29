// GET /api/_server/responses/:id — get a single response
export async function GET({ request, query }) {
  const id = request.params.id
  const rows = await query('SELECT * FROM responses WHERE response_id = $1', [id])
  if (rows.length === 0) {
    return { status: 404, body: { error: 'Response not found' } }
  }
  const row = rows[0]
  return {
    ...row,
    sections: typeof row.sections === 'string' ? JSON.parse(row.sections) : row.sections,
  }
}
