export async function GET({ query }) {
  return await query(
    'SELECT id, name, description, definition, created_at, updated_at FROM queries ORDER BY updated_at DESC'
  )
}

export async function POST({ query, request }) {
  const { name, description, definition } = request.body
  if (!name || !name.trim()) {
    return { status: 400, body: { error: 'Name is required' } }
  }
  const [row] = await query(
    'INSERT INTO queries (name, description, definition) VALUES ($1, $2, $3) RETURNING *',
    [name.trim(), description || null, JSON.stringify(definition || {})]
  )
  return { status: 201, body: row }
}
