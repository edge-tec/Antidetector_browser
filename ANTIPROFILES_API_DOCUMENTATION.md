# AntiProfiles — Local Automation API v2 Documentation

**Base URL:** `http://127.0.0.1:<port>` (strictly localhost-bound with DNS rebinding protection)  
**Authentication:** `Authorization: Bearer <API_TOKEN>`  
**Backward Compatibility:** All `/api/v1/*` endpoints remain 100% supported.

---

## Endpoints

### Profiles & Trash
- `GET /api/v1/profiles` — List profiles
- `POST /api/v1/profiles` — Create profile
- `PUT /api/v1/profiles/:id` — Update profile
- `POST /api/v1/profiles/:id/start` — Launch browser profile (returns `pid` and `wsEndpoint`)
- `POST /api/v1/profiles/:id/stop` — Stop browser profile
- `POST /api/v2/profiles/:id/restart` — Restart browser profile
- `POST /api/v2/profiles/:id/trash` — Soft-delete profile to 30-day Trash
- `POST /api/v2/profiles/:id/restore` — Restore profile from Trash

### Bulk Operations
- `POST /api/v2/bulk/start` — Body: `{ "profileIds": ["id1", "id2"] }`
- `POST /api/v2/bulk/stop` — Body: `{ "profileIds": ["id1", "id2"] }`

### Browser Runtimes & Diagnostics
- `GET /api/v2/runtimes?engine=chromium|firefox` — List multi-kernel runtimes & install status
- `GET /api/v2/diagnostics` — System-wide runtime & launch diagnostics
- `GET /api/v2/profiles/:id/diagnostics` — Per-profile runtime, kernel, proxy & extension diagnostics

### Proxy Rotation & Failover
- `POST /api/v2/proxies/:id/rotate` — Trigger IP rotation via configured rotation URL
- `PUT /api/v2/proxies/:id/failover` — Body: `{ "rotationUrl": "...", "failoverProxyId": "...", "proxyGroup": "..." }`

### Cookies
- `GET /api/v2/profiles/:id/cookies?domain=example.com` — Read cookies (live CDP or stored)
- `POST /api/v2/profiles/:id/cookies/import` — Body: `{ "cookies": [...] }` (JSON array or Netscape text)
- `DELETE /api/v2/profiles/:id/cookies` — Clear all cookies for profile

### RPA Workflows
- `GET /api/v2/workflows` — List automation workflows
- `POST /api/v2/workflows` — Create workflow (`{ "name": "...", "steps": [...] }`)
- `POST /api/v2/workflows/:id/execute` — Body: `{ "profileId": "..." }`
- `POST /api/v2/executions/:id/pause` — Pause active execution
- `POST /api/v2/executions/:id/resume` — Resume paused execution
- `POST /api/v2/executions/:id/stop` — Stop active execution
- `GET /api/v2/executions/:id` — Get execution status & step logs
