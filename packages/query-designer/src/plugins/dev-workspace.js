import Database from 'better-sqlite3'
import { join } from 'path'

/**
 * Vite plugin that provides a local SQLite workspace database for dev,
 * handling /api/_server/queries routes that would normally run on the
 * Informer platform's workspace database.
 */
export default function devWorkspace() {
  let db

  return {
    name: 'dev-workspace',

    configureServer(server) {
      db = new Database(join(process.cwd(), '.workspace.db'))
      db.pragma('journal_mode = WAL')

      // Create tables if they don't exist (SQLite-adapted migration)
      db.exec(`
        CREATE TABLE IF NOT EXISTS queries (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT NOT NULL,
          description TEXT,
          definition  TEXT NOT NULL DEFAULT '{}',
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      // Middleware runs before the Informer proxy, so /api/_server/ routes
      // are handled locally instead of being forwarded to the remote server.
      server.middlewares.use('/api/_server/queries', (req, res) => {
        // Vite strips the mount prefix, so req.url is "/" or "/<id>"
        const id = req.url.replace(/^\//, '').split('?')[0] || null

        if (req.method === 'POST' || req.method === 'PUT') {
          let body = ''
          req.on('data', chunk => (body += chunk))
          req.on('end', () => {
            try {
              req.body = JSON.parse(body)
            } catch {
              req.body = {}
            }
            handle(db, req, res, id)
          })
        } else {
          handle(db, req, res, id)
        }
      })

      console.log('[dev-workspace] Local SQLite workspace ready')
    }
  }
}

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function parseRow(row) {
  if (!row) return null
  return { ...row, definition: JSON.parse(row.definition) }
}

function handle(db, req, res, id) {
  try {
    if (!id) {
      // Collection routes: GET (list) / POST (create)
      if (req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM queries ORDER BY updated_at DESC').all()
        return json(res, 200, rows.map(parseRow))
      }

      if (req.method === 'POST') {
        const { name, description, definition } = req.body
        if (!name || !name.trim()) return json(res, 400, { error: 'Name is required' })

        const result = db.prepare(
          "INSERT INTO queries (name, description, definition, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
        ).run(name.trim(), description || null, JSON.stringify(definition || {}))

        const row = db.prepare('SELECT * FROM queries WHERE id = ?').get(result.lastInsertRowid)
        return json(res, 201, parseRow(row))
      }
    } else {
      // Item routes: GET / PUT / DELETE
      if (req.method === 'GET') {
        const row = db.prepare('SELECT * FROM queries WHERE id = ?').get(id)
        if (!row) return json(res, 404, { error: 'Query not found' })
        return json(res, 200, parseRow(row))
      }

      if (req.method === 'PUT') {
        const { name, description, definition } = req.body
        if (!name || !name.trim()) return json(res, 400, { error: 'Name is required' })

        const result = db.prepare(
          "UPDATE queries SET name = ?, description = ?, definition = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(name.trim(), description || null, JSON.stringify(definition || {}), id)

        if (result.changes === 0) return json(res, 404, { error: 'Query not found' })

        const row = db.prepare('SELECT * FROM queries WHERE id = ?').get(id)
        return json(res, 200, parseRow(row))
      }

      if (req.method === 'DELETE') {
        const result = db.prepare('DELETE FROM queries WHERE id = ?').run(id)
        if (result.changes === 0) return json(res, 404, { error: 'Query not found' })
        res.statusCode = 204
        res.end()
        return
      }
    }

    json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[dev-workspace]', e)
    json(res, 500, { error: e.message })
  }
}
