# ProfileVault — Automation API Documentation

## Overview

ProfileVault exposes a local REST API for programmatic browser profile management.
The API server binds to `127.0.0.1:37100` by default and requires Bearer token authentication.

## Authentication

All requests require the `Authorization` header:

```
Authorization: Bearer <your-api-token>
```

Obtain your API token from the **Automation** page in the ProfileVault UI.

## Endpoints

### Health Check

```
GET /api/v1/status
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "runningProfiles": 2
}
```

### List Profiles

```
GET /api/v1/profiles
GET /api/v1/profiles?search=myprofile
```

### Create Profile

```
POST /api/v1/profiles
Content-Type: application/json

{
  "name": "Test Profile",
  "language": "en-US",
  "timezone": "America/New_York",
  "screenWidth": 1920,
  "screenHeight": 1080,
  "userAgent": "",
  "webrtcMode": "default",
  "tags": ["testing"]
}
```

### Get Profile

```
GET /api/v1/profiles/:id
```

### Update Profile

```
PUT /api/v1/profiles/:id
Content-Type: application/json

{
  "name": "Updated Name"
}
```

### Delete Profile

```
DELETE /api/v1/profiles/:id
```

### Start Browser

```
POST /api/v1/profiles/:id/start
```

Response:
```json
{
  "success": true,
  "pid": 12345,
  "wsEndpoint": "ws://127.0.0.1:9222/devtools/browser/xxx"
}
```

### Stop Browser

```
POST /api/v1/profiles/:id/stop
```

### Get Browser Status

```
GET /api/v1/profiles/:id/status
```

Response:
```json
{
  "profileId": "uuid",
  "status": "running",
  "isRunning": true,
  "pid": 12345,
  "wsEndpoint": "ws://...",
  "startedAt": "2024-01-01T00:00:00Z"
}
```

## Security Notes

- The API binds to `127.0.0.1` only — it is not accessible from the network.
- All requests require a valid API token.
- Tokens can be rotated from the UI.
- Proxy passwords are never returned in API responses.
- Sensitive data is redacted from logs.

## Error Responses

All errors return a JSON body with an `error` field:

```json
{
  "error": "Profile not found"
}
```

HTTP status codes:
- `400` — Bad request (invalid input)
- `401` — Missing authentication
- `403` — Invalid token
- `404` — Resource not found
- `500` — Internal server error
