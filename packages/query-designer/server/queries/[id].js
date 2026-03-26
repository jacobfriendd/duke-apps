export async function GET({ query, request }) {
  const [row] = await query('SELECT * FROM queries WHERE id = $1', [request.params.id])
  if (!row) return { status: 404, body: { error: 'Query not found' } }
  return row
}

export async function PUT({ query, request }) {
  const { name, description, definition } = request.body
  if (!name || !name.trim()) {
    return { status: 400, body: { error: 'Name is required' } }
  }
  const [row] = await query(
    `UPDATE queries
     SET name = $1, description = $2, definition = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [name.trim(), description || null, JSON.stringify(definition || {}), request.params.id]
  )
  if (!row) return { status: 404, body: { error: 'Query not found' } }
  return row
}

export async function DELETE({ query, request }) {
  const [row] = await query('DELETE FROM queries WHERE id = $1 RETURNING id', [request.params.id])
  if (!row) return { status: 404, body: { error: 'Query not found' } }
}
