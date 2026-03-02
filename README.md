# GraphQL Dev
## A Zone01 Profile Dashboard

> A pure static frontend dashboard for the Zone01 school platform.  
> Visualises your personal learning data fetched live from the platform's GraphQL API.

---

## Table of Contents

## 1. [Overview](#1-overview)
## 2. [Authentication](#2-authentication)
## 3. [GraphQL Data Layer](#3-graphql-data-layer)
## 4. [SVG Charts](#4-svg-charts)
## 5. [Local Development](#5-local-development)
--- 
## 1. Overview

Zone01 Profile Dashboard is a **zero-backend, zero-dependency** web application.
There is no build step, no package manager, no server process. Every file is
plain HTML, CSS, or vanilla JavaScript that runs directly in the browser.

**What it does:**
- Authenticates the user against the Zone01 platform using HTTP Basic Auth
- Stores the returned JWT in `localStorage`
- Fetches personal data (XP, progress, audit stats) from the platform's GraphQL API
- Renders the data as an interactive dashboard with animated SVG charts

**What it is not:**
- Not a server-side application
- Not a Node.js project
- Not a React/Vue/Angular app
- Not connected to any database

The Zone01 platform (`platform.zone01.gr`) is the only backend involved. This
project is a custom frontend skin on top of their existing API.

---
## 2. Authentication

### Login flow
```
Browser                           Zone01 API
   |                                  |
   |-- POST /api/auth/signin -------->|
   |   Authorization: Basic           |
   |   base64("username:password")    |
   |                                  |
   |<-- 200 OK  "eyJhbGci..." --------|
   |   JWT token (plain text or JSON) |
   |                                  |
   |  [JWT saved to localStorage]     |
   |                                  |
   |-- POST /api/graphql-engine/... ->|
   |   Authorization: Bearer <JWT>    |
   |                                  |
   |<-- 200 OK  { "data": { ... } } --|
```

```
1. User submits form
2. browser encodes "username:password" as Base64
3. POST https://platform.zone01.gr/api/auth/signin
   Header: Authorization: Basic <base64string>
4. Platform responds with JWT (plain text or JSON)
5. JWT stripped of surrounding quotes if needed, saved to localStorage
6. Browser redirects to /profile.html
```

### JWT structure

A JWT has three Base64url-encoded segments separated by dots:

```
eyJhbGciOiJSUzI1NiJ9   ← header (algorithm)
.eyJzdWIiOiIxMjMiLCJleHAiOjE3MDAwMDAwMDB9  ← payload (claims)
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← signature
```

The payload decoded contains at minimum:
- `sub` — the user's ID
- `exp` — expiry as a Unix timestamp

The client reads `exp` to decide if the token is still valid without making a
network request.

### Auth guard

Every page load of `profile.html` runs `requireAuth()` synchronously before
any async code. If it returns `false`, the script throws immediately — no
data is fetched, no UI is rendered, the user is redirected to login.

### Session persistence

`localStorage` survives browser restarts. A user who logged in yesterday and visits today will be automatically authenticated if their JWT hasn't expired. This is
intentional — the same behaviour as Gmail, GitHub, etc.

---

## 3. GraphQL Data Layer

### What is GraphQL

GraphQL is a query language for APIs. Instead of many REST endpoints
(`/users`, `/transactions`, `/progress`), there is one endpoint and you
describe exactly what data you want in the request body.

Every GraphQL request in this project is sent as a POST to:
```
https://platform.zone01.gr/api/graphql-engine/v1/graphql
```

With body:
```json
{
  "query": "query { user { id login } }",
  "variables": {}
}
```

And header:
```
Authorization: Bearer <JWT>
```

### Query types used

**Normal query** — no arguments, returns all records:
```graphql
query {
  user {
    id
    login
    email
    createdAt
    totalUp
    totalDown
  }
}
```

**Args query** — server-side filtering with `where` and `order_by`:
```graphql
query {
  transaction(
    where: { type: { _eq: "xp" } }
    order_by: { createdAt: asc }
  ) {
    amount
    createdAt
    path
  }
}
```

**Nested query** — a field that returns a related object:

`object` is a nested relationship that returns the related project metadata.

```graphql
query {
  progress(order_by: { createdAt: desc }, limit: 100) {
    id
    grade
    createdAt
    object {
      name
      type
    }
  }
}
```
---

### Available data

| Table | Key fields | Used for |
|-------|-----------|----------|
| `user` | `id`, `login`, `email`, `createdAt`, `totalUp`, `totalDown` | Identity card, audit ratio |
| `transaction` (type: `xp`) | `amount`, `createdAt`, `path` | XP timeline, top projects, category chart, heatmap |
| `progress` | `grade`, `createdAt`, `object{name,type}` | Pass/fail donut, recent projects, attempts chart |

`totalUp` = total XP bytes given during audits (auditor role)  
`totalDown` = total XP bytes received during audits (auditee role)  
XP amounts are stored in bytes — `formatXP()` converts to kB/MB for display.

### Inspecting queries in DevTools

Open the Network tab while on `profile.html`. Filter by "Fetch/XHR". Click any
request to `graphql`. The Payload tab shows the exact query sent. The Response
tab shows the raw JSON returned.

You can also run queries manually in the browser console:

```js
gqlRequest(`query { user { id login totalUp totalDown } }`).then(console.log)
```
---
## 4. SVG Charts

All charts live in `graphs.js`. They are injected into `<div class="graph-box">`
containers in `profile.html`.

### Shared infrastructure

**`svgEl(tag, attrs)`** — creates an SVG element with namespace and sets
attributes in one call.

**Color palette `C`** — a single object with all chart colours keyed by
semantic name (`accent`, `pass`, `fail`, `warn`, etc.). Edit this to retheme
all charts at once.

**`Tooltip`** — a singleton that manages the shared `#graph-tooltip` div.
`Tooltip.show(html, event)` positions and reveals it. `Tooltip.hide()` fades
it out. All charts call these on `mouseenter`/`mouseleave`.

---
### Example
### `drawLineGraph(containerId, transactions)`

**What it shows:** Cumulative XP earned over time as an animated line + area chart.

**How the data is transformed:**
- Sorts transactions by `createdAt` ascending
- Accumulates a running total to build cumulative XP points
- Maps each point to `(x, y)` coordinates using date range and max XP as scale bounds

**Visual features:**
- Gradient area fill beneath the line
- Dual-colour gradient stroke (accent2 → accent, left to right)
- Glow filter on the line
- Draw-in animation via SVG `stroke-dashoffset` SMIL animation
- Sampled dot markers (every N-th point + last) for hover targets
- Y-axis tick labels formatted as `k` values
- X-axis tick labels as `Mon 'YY` dates
- Hover tooltip showing cumulative XP, amount earned, date, and project name

---

## 5. Local Development

### Requirement

Files must be served over HTTP. Opening `index.html` directly as a `file://`
URL causes browsers to block the cross-origin requests to the platform API.

### Option A — Python (recommended, zero install)

```bash
python3 -m http.server 3000
```

Open http://localhost:3000

### Option B — Node.js

```bash
npx serve .
```

Open http://localhost:3000

### CORS during local development

The Zone01 platform may not whitelist `localhost` as an allowed CORS origin.
If you see a CORS error in the console, deploy a preview to Vercel instead
(see [Deployment](#13-deployment--vercel)) — your Vercel domain will be
accepted by the API.

To test locally anyway (macOS):
```bash
open -n -a /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --args --disable-web-security --user-data-dir=/tmp/chrome-dev
```

⚠️ This disables browser security protections. Use only for local testing and close the window immediately after use.
