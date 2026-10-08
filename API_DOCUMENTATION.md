# KARM API Documentation

This document describes the HTTP API currently implemented by the KARM backend.

## Base URL

When running the backend locally, the API is available at:

```text
http://localhost:4000
```

All versioned endpoints use the `/api/v1` prefix. The health check is not versioned:

```text
GET /health
```

Uploaded files are served from `/uploads/<filename>`.

## Authentication and roles

Protected endpoints require a JWT in the `Authorization` header:

```http
Authorization: Bearer <token>
```

The API supports these roles:

| Role | Description |
| --- | --- |
| `applicant` | Manages a business profile, applications, and documents |
| `authority` | Reviews applications for the authority's department |
| `admin` | Manages approval types and users, and can access all authority queues |

Registration creates an `applicant`. Authority and admin accounts must be provisioned or updated by an administrator.

## Response and error format

Successful responses return JSON in an endpoint-specific object. For example:

```json
{
  "user": {
    "_id": "665f1a...",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "applicant"
  }
}
```

Errors use this shape:

```json
{
  "message": "Application not found",
  "errors": []
}
```

Validation errors may include field-level entries in `errors`. Every response includes an `X-Request-Id` header.

Common status codes:

| Status | Meaning |
| --- | --- |
| `400` | Invalid input or invalid state transition |
| `401` | Missing or invalid JWT |
| `403` | Insufficient role, department, or resource access |
| `404` | Resource not found |
| `409` | Duplicate resource |
| `500` | Unexpected server error |

## Health

### `GET /health`

Returns `200` when the HTTP service is running.

```json
{
  "status": "ok"
}
```

## Authentication

### `POST /api/v1/auth/register`

Creates an applicant account.

Request body:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "a-password-at-least-8-characters"
}
```

Returns `201` with `{ "user": User }`. The password is never returned.

### `POST /api/v1/auth/login`

Authenticates a user.

Request body:

```json
{
  "email": "ada@example.com",
  "password": "a-password-at-least-8-characters"
}
```

Returns `200` with:

```json
{
  "token": "<jwt>",
  "user": {}
}
```

### `GET /api/v1/auth/me`

**Auth:** any authenticated user.

Returns the current user as `{ "user": User }`.

## Applicant endpoints

The following endpoints require the `applicant` role.

### Business profile

#### `GET /api/v1/profile`

Returns the applicant's profile as `{ "profile": BusinessProfile | null }`.

#### `POST /api/v1/profile`

Creates the applicant's profile. Only one profile may exist per user.

Request body:

```json
{
  "businessName": "Lovelace Labs",
  "sector": "Technology",
  "location": {
    "state": "Karnataka",
    "district": "Bengaluru Urban"
  },
  "projectSize": "medium",
  "stage": "operating"
}
```

Returns `201` with `{ "profile": BusinessProfile }`.

#### `PATCH /api/v1/profile`

Updates any subset of the profile fields above. Returns the updated profile.

### Checklist

#### `GET /api/v1/checklist`

Returns active approval types matching the applicant's sector, state, project size, and stage:

```json
{
  "items": [
    {
      "_id": "665f1a...",
      "name": "Factory License",
      "department": "industry",
      "requiredDocuments": [
        {
          "docType": "registration_certificate",
          "label": "Registration certificate",
          "required": true
        }
      ],
      "slaDays": 7,
      "description": "",
      "isActive": true
    }
  ]
}
```

If no profile exists, `items` is an empty array.

### Applications

#### `POST /api/v1/applications`

Creates a draft application from the applicant's profile and one or more active approval types.

Request body:

```json
{
  "businessProfileId": "665f1a...",
  "approvalTypeIds": ["665f2b...", "665f2c..."]
}
```

Returns `201` with `{ "application": Application }`. Approval type IDs must be unique, active, and valid for the selected profile.

#### `GET /api/v1/applications`

Returns all applications owned by the authenticated applicant:

```json
{
  "applications": []
}
```

#### `GET /api/v1/applications/:id`

Returns one application owned by the authenticated applicant as `{ "application": Application }`.

#### `POST /api/v1/applications/:id/submit`

Submits all approval items in the application, sets their submission timestamps and SLA deadlines, and changes the overall status to `in_progress`.

Submission fails with `400` if any document has `preValidationStatus: "failed"`.

### Application documents

#### `POST /api/v1/applications/:id/items/:itemId/documents`

Uploads a document for an application item.

Content type: `multipart/form-data`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | file | Yes | PDF, PNG, or JPEG |
| `docType` | string | Yes | Must match the item's approval type |

The upload limit is configured by `MAX_FILE_SIZE_MB` and defaults to 10 MB. A successful upload returns `201`:

```json
{
  "document": {
    "docType": "registration_certificate",
    "fileUrl": "/uploads/<filename>",
    "preValidationStatus": "passed",
    "preValidationNotes": [],
    "riskBrief": null
  },
  "preValidationResult": {
    "status": "passed",
    "notes": []
  }
}
```

#### `POST /api/v1/applications/:id/items/:itemId/reupload`

Replaces a document after an authority has set the item to `query_raised` or `rejected`.

Content type: `multipart/form-data`

| Field | Type | Required |
| --- | --- | --- |
| `file` | file | Yes |
| `docType` | string | Yes |

Returns the replacement document and changes the item status to `in_review`.

## Authority endpoints

These endpoints require `authority` or `admin`, unless noted otherwise.

### `GET /api/v1/authority/applications`

Lists non-draft applications.

Authority users only see items assigned to their department. Admin users see all applications. Authorities may filter by item status:

```text
GET /api/v1/authority/applications?status=submitted
```

Returns `{ "applications": [] }`.

### `GET /api/v1/authority/applications/:id`

Returns an application visible to the current authority or admin as `{ "application": Application }`.

### `GET /api/v1/authority/applications/:id/items/:itemId/risk-brief`

Returns or generates the advisory risk brief for an application item:

```json
{
  "riskBrief": {
    "score": 10,
    "summary": "Advisory automated risk brief; human review required.",
    "flags": [],
    "generatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

The risk brief is advisory only and does not replace human review. A document must exist before a risk brief can be generated.

### `POST /api/v1/authority/applications/:id/items/:itemId/decision`

Records an authority decision.

Request body:

```json
{
  "decision": "approve",
  "reason": "All required documents are complete."
}
```

Allowed decisions are `approve`, `reject`, and `request_reupload`. `reason` is required for `reject` and `request_reupload`.

The response is `{ "applicationItem": ApplicationItem }`.

## Notifications

### `GET /api/v1/notifications`

**Auth:** any authenticated user.

Returns the user's newest notifications first:

```json
{
  "notifications": []
}
```

### `PATCH /api/v1/notifications/:id/read`

**Auth:** any authenticated user.

Marks the specified notification as read and returns `{ "notification": Notification }`.

## Admin endpoints

All endpoints in this section require the `admin` role.

### Approval types

#### `GET /api/v1/admin/approval-types`

Returns all approval types, including inactive types.

#### `POST /api/v1/admin/approval-types`

Creates an approval type. The request body follows this shape:

```json
{
  "name": "Factory License",
  "department": "industry",
  "requiredDocuments": [
    {
      "docType": "registration_certificate",
      "label": "Registration certificate",
      "required": true
    }
  ],
  "slaDays": 7,
  "description": "License required for industrial operations.",
  "isActive": true,
  "sectors": ["Technology"],
  "states": ["Karnataka"],
  "projectSizes": ["medium"],
  "stages": ["operating"]
}
```

`requiredDocuments`, `sectors`, `states`, `projectSizes`, and `stages` are arrays. The matching arrays are optional; an empty or omitted matching array is treated as unrestricted by the checklist.

#### `PATCH /api/v1/admin/approval-types/:id`

Updates the supplied approval type fields and returns the updated document.

#### `DELETE /api/v1/admin/approval-types/:id`

Soft-deactivates the approval type by setting `isActive` to `false`. Returns `204 No Content`.

### Users

#### `GET /api/v1/admin/users`

Returns all users without password fields:

```json
{
  "users": []
}
```

#### `PATCH /api/v1/admin/users/:id`

Updates a user's role and department.

Request body:

```json
{
  "role": "authority",
  "department": "industry"
}
```

Returns the updated user as `{ "user": User }`.

### `GET /api/v1/admin/analytics`

Requires `admin` or `authority` (the route currently allows both roles). Returns the current analytics response shape:

```json
{
  "avgDaysByApprovalType": [],
  "bottlenecks": [],
  "rejectionReasons": []
}
```

## Core resource status values

Application item statuses:

```text
draft | submitted | in_review | query_raised | approved | rejected
```

Application overall statuses:

```text
draft | in_progress | action_required | approved | rejected
```

Document pre-validation statuses:

```text
pending | passed | failed
```

## Local configuration

The backend reads configuration from `backend/.env`. See [`backend/.env.example`](backend/.env.example).

| Variable | Default / example | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port |
| `MONGODB_URI` | local MongoDB URI | MongoDB connection string |
| `JWT_SECRET` | replace in deployments | JWT signing secret |
| `JWT_EXPIRES_IN` | `1d` | JWT lifetime |
| `CORS_ORIGIN` | comma-separated origins | Allowed browser origins |
| `UPLOAD_DIR` | `uploads` | File storage directory |
| `MAX_FILE_SIZE_MB` | `10` | Maximum uploaded file size |
| `SLA_WARNING_DAYS` | `2` | SLA warning configuration |
| `AI_PROVIDER` | `local` | Reserved provider configuration |

