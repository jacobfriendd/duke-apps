import Database from 'better-sqlite3'
import { join } from 'path'

/**
 * Vite plugin that provides a local SQLite database for survey responses.
 * Handles /api/_server/responses routes in dev mode.
 */
export default function devWorkspace() {
  let db

  return {
    name: 'dev-workspace',

    configureServer(server) {
      db = new Database(join(process.cwd(), '.workspace.db'))
      db.pragma('journal_mode = WAL')

      db.exec(`
        CREATE TABLE IF NOT EXISTS responses (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          response_id TEXT NOT NULL UNIQUE,
          name        TEXT,
          role        TEXT,
          started_at  TEXT NOT NULL,
          completed_at TEXT,
          sections    TEXT NOT NULL DEFAULT '{}',
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `)

      server.middlewares.use('/api/_server/responses', (req, res) => {
        const id = req.url.replace(/^\//, '').split('?')[0] || null

        if (req.method === 'POST') {
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

      console.log('[dev-workspace] Survey SQLite database ready')
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
  return { ...row, sections: JSON.parse(row.sections) }
}

function extractWelcome(sections) {
  const welcome = sections?.welcome?.answers ?? {}
  return {
    name: welcome.name?.value ?? null,
    role: welcome.role?.value ?? null,
  }
}

function handle(db, req, res, id) {
  try {
    if (!id) {
      if (req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM responses ORDER BY updated_at DESC').all()
        return json(res, 200, rows.map(parseRow))
      }

      if (req.method === 'POST') {
        const { id: responseId, startedAt, completedAt, sections } = req.body
        if (!responseId) return json(res, 400, { error: 'Response id is required' })

        const { name, role } = extractWelcome(sections)
        const sectionsJson = JSON.stringify(sections ?? {})

        // Upsert — update if response_id already exists
        const existing = db.prepare('SELECT id FROM responses WHERE response_id = ?').get(responseId)
        if (existing) {
          db.prepare(
            "UPDATE responses SET name = ?, role = ?, started_at = ?, completed_at = ?, sections = ?, updated_at = datetime('now') WHERE response_id = ?"
          ).run(name, role, startedAt, completedAt ?? null, sectionsJson, responseId)
          const row = db.prepare('SELECT * FROM responses WHERE response_id = ?').get(responseId)
          return json(res, 200, parseRow(row))
        }

        db.prepare(
          "INSERT INTO responses (response_id, name, role, started_at, completed_at, sections, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
        ).run(responseId, name, role, startedAt, completedAt ?? null, sectionsJson)
        const row = db.prepare('SELECT * FROM responses WHERE response_id = ?').get(responseId)
        return json(res, 201, parseRow(row))
      }
    } else {
      if (req.method === 'GET') {
        const row = db.prepare('SELECT * FROM responses WHERE response_id = ?').get(id)
        if (!row) return json(res, 404, { error: 'Response not found' })
        return json(res, 200, parseRow(row))
      }
    }

    json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[dev-workspace]', e)
    json(res, 500, { error: e.message })
  }
}
