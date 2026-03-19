---
name: informer
description: Building Magic Reports with local Vite development. Covers the dev/publish workflow and key Informer APIs for datasets, queries, and integrations.
---

# Magic Report Development

## What is a Magic Report?

A Magic Report is a custom HTML/JS/CSS application that runs inside Informer. It can:
- Query Informer datasets (Elasticsearch-indexed data)
- Execute saved queries
- Make authenticated requests to external APIs via integrations (Salesforce, etc.)
- Render charts, tables, and interactive visualizations

Reports are stored in Informer libraries and served through the Informer UI.

## Local Development Workflow

### Development Mode (`npm run dev`)

The Vite plugin proxies `/api/*` requests to your Informer server with Basic auth. This means:
- Your code makes fetch calls to `/api/...` (no host needed)
- The plugin adds authentication headers automatically
- You get hot reload while working against real Informer data

Configuration is in `.env`:
```
INFORMER_URL=http://localhost:3000
INFORMER_API_KEY=your-api-key
```

Or use basic auth:
```
INFORMER_URL=http://localhost:3000
INFORMER_USER=admin
INFORMER_PASS=yourpassword
```

### Deploying (`npm run deploy`)

Builds your project and uploads to an Informer library:
1. Creates/finds a Magic Report by slug (from package.json `name`)
2. Snapshots the library for rollback
3. Clears existing files
4. Uploads all built assets from `dist/`
5. Uploads `data-access.yaml` from project root (if it exists)
6. Report is viewable at `/reports/r/{owner}:{slug}`

## Discovering Resources

Once `.env` is configured, Claude can query the Informer API directly to help you find available resources. Ask Claude to look up:

- **Integrations**: `curl -u $USER:$PASS "$INFORMER_URL/api/integrations"` - Find integration slugs for QuickBooks, Salesforce, etc.
- **Datasets**: `curl -u $USER:$PASS "$INFORMER_URL/api/datasets-list"` - Find dataset IDs and field names
- **Queries**: `curl -u $USER:$PASS "$INFORMER_URL/api/queries-list"` - Find saved query IDs
- **Datasources**: `curl -u $USER:$PASS "$INFORMER_URL/api/datasources"` - Find SQL datasource IDs

This helps you find the correct IDs/slugs to use in your code and `data-access.yaml`. Just ask Claude to "show me available integrations" or "find the QuickBooks integration slug".

## Key APIs

All endpoints are relative to `/api`. In dev mode, the Vite proxy handles auth.

### List Datasets

```javascript
const response = await fetch('/api/datasets-list');
const datasets = await response.json();
// Returns: [{ id, name, description, records, size, ... }, ...]
```

Use this to discover available datasets. Each dataset has:
- `id` - UUID or natural ID like `admin:sales-data`
- `name` - Display name
- `records` - Approximate record count

### Search Dataset (Elasticsearch)

```javascript
const response = await fetch(`/api/datasets/${datasetId}/_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        query: { match_all: {} },
        size: 100,
        from: 0,
        _source: ['field1', 'field2'],  // Optional: limit fields returned
        sort: [{ field1: 'desc' }],      // Optional: sort order
        aggs: {                          // Optional: aggregations
            total: { sum: { field: 'amount' } }
        }
    })
});
const result = await response.json();

// Response structure:
// result.hits.total - total matching records
// result.hits.hits - array of { _source: { field1, field2, ... } }
// result.aggregations - aggregation results (if requested)
```

**Common query patterns:**

```javascript
// Filter by exact value
{ query: { bool: { filter: [{ term: { status: 'active' } }] } } }

// Filter by range
{ query: { bool: { filter: [{ range: { amount: { gte: 1000 } } }] } } }

// Date range
{ query: { bool: { filter: [{ range: { date: { gte: '2024-01-01', lte: '2024-12-31' } } }] } } }

// Multiple filters (AND)
{ query: { bool: { filter: [
    { term: { region: 'North' } },
    { range: { amount: { gte: 1000 } } }
] } } }
```

**Common aggregations:**

```javascript
// Sum, avg, min, max
{ aggs: { total: { sum: { field: 'amount' } } } }

// Group by field
{ aggs: { by_region: { terms: { field: 'region', size: 50 } } } }

// Group with nested metric
{ aggs: {
    by_region: {
        terms: { field: 'region', size: 50 },
        aggs: { total: { sum: { field: 'amount' } } }
    }
} }

// Date histogram
{ aggs: {
    by_month: {
        date_histogram: { field: 'date', calendar_interval: 'month' },
        aggs: { total: { sum: { field: 'amount' } } }
    }
} }
```

### List Queries

```javascript
const response = await fetch('/api/queries-list');
const queries = await response.json();
// Returns: [{ id, name, description, ... }, ...]
```

### Execute Query

```javascript
const response = await fetch(`/api/queries/${queryId}/_execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        parameters: { param1: 'value1' }  // Optional query parameters
    })
});
const result = await response.json();
```

### List Integrations

```javascript
const response = await fetch('/api/integrations');
const result = await response.json();
// result.items = [{ id, name, slug, type, ... }, ...]
```

Integrations are authenticated connections to external APIs (Salesforce, REST APIs, etc.).

### Make Integration Request

The response is a true HTTP proxy — the upstream status code, headers, and body are returned directly.

```javascript
const response = await fetch(`/api/integrations/${slugOrId}/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        url: '/data/v59.0/query',           // Path relative to integration's base URL
        method: 'GET',                       // HTTP method
        params: { q: 'SELECT Id FROM Account' },  // Query params
        data: { /* body for POST/PUT */ },   // Request body
        headers: { /* extra headers */ }     // Additional headers
    })
});
const result = await response.json();  // body is the upstream response directly
```

**Salesforce example:**
```javascript
const response = await fetch('/api/integrations/salesforce/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        url: '/data/v59.0/query',
        method: 'GET',
        params: {
            q: "SELECT Id, Name, Amount FROM Opportunity WHERE StageName = 'Closed Won'"
        }
    })
});
const result = await response.json();
const records = result.records;
```

## Data Access Configuration

When your report is published and shared, you must declare which APIs it needs access to. Create a `data-access.yaml` file in your project root (it will be published with your report).

**Important:** Without this file, all API access is blocked when the report runs in Informer.

### Basic Example

```yaml
# data-access.yaml

datasets:
  - admin:sales-data
  - admin:customers

queries:
  - admin:monthly-summary

integrations:
  - salesforce
```

### With Row-Level Security

Restrict data based on the viewing user's profile:

```yaml
datasets:
  # Users only see their region's data
  - id: admin:orders
    filter:
      region: $user.custom.region

  # Users only see their own records
  - id: admin:sales
    filter:
      sales_rep: $user.username
```

### Integration with Credentials

Pass user-specific credentials to external APIs:

```yaml
integrations:
  - id: partner-api
    headers:
      Authorization: Bearer $user.custom.partnerToken
    params:
      client_id: $tenant.id
```

### Available Variables

| Variable | Description |
|----------|-------------|
| `$user.username` | Login name |
| `$user.email` | Email address |
| `$user.displayName` | Full name |
| `$user.custom.xxx` | Custom user field |
| `$tenant.id` | Tenant ID |
| `$report.id` | Report UUID |

### Resource Types

| Type | API Access Granted |
|------|-------------------|
| `datasets` | `_search`, `fields` |
| `queries` | `_execute` |
| `datasources` | `_query` |
| `integrations` | `request` |
| `libraries` | `contents/*` |

For edge cases, you can also whitelist raw API paths:

```yaml
apis:
  - POST /api/custom/endpoint
```

## Report Context

When running inside Informer (not dev mode), the report receives context:

```javascript
const reportId = window.__INFORMER__?.report?.id;
const reportName = window.__INFORMER__?.report?.name;
```

In dev mode, the Vite plugin mocks this with placeholder values.

## PDF Export

Reports can be exported to PDF via `POST /api/reports/{id}/_print`.

### How it works

1. Informer opens your report in a headless browser (Puppeteer)
2. Waits for network requests to complete
3. Waits for `window.informerReady` to become `true`
4. Adds `.print` class to `<html>`
5. Captures the page as PDF using print media

### Signal when ready

Set `window.informerReady` to signal when your report is fully rendered:

```javascript
// Start of app
window.informerReady = false;

// After all charts/content rendered
window.informerReady = true;
```

### Rendering details

- **Print media is used** - Standard `@media print` CSS rules apply
- **`.print` class added** - Informer adds a `.print` class to `<html>` for additional targeting
- **Viewport is 1200px** by default (configurable via `viewportWidth` option)
- **Box shadows are removed** - They render as grey boxes in PDFs
- **Colors are preserved** - `print-color-adjust: exact` is applied automatically

### Print CSS

Use standard `@media print` rules or the `.print` class:

```css
/* Standard print media query */
@media print {
    body {
        background: white;
        color: black;
    }

    .no-print {
        display: none;
    }
}

/* Or use the .print class (added by Informer) */
.print .no-print {
    display: none;
}

/* Avoid page breaks inside elements */
.chart-container {
    break-inside: avoid;
}
```

### Print API options

```javascript
await fetch(`/api/reports/${reportId}/_print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        format: 'Letter',        // Letter, Legal, Tabloid, A3, A4, A5
        landscape: false,
        viewportWidth: 1200,     // 400-2400, affects responsive layouts
        waitForReady: true,      // Wait for window.informerReady
        save: false              // true = save to downloads, false = return PDF
    })
});
```

## Reference Files

- `references/api-reference.md` - Detailed API documentation
- `references/report-templates.md` - HTML/CSS/JS starter templates
