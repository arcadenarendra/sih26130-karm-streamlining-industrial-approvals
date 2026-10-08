# KARM

KARM is a department-based government services and approvals platform. It provides applicants with a guided application workflow and gives department authorities a secure, department-scoped review dashboard.

## Features

- Department and service selection backed by MongoDB
- Dynamic, service-specific required document configuration
- Applicant profiles and application drafts
- Secure document upload with file type and size validation
- Application submission, SLA tracking, and reference numbers
- Department-scoped authority review
- Document verification and advisory risk briefs
- Approval, rejection, and correction-request workflows
- Applicant notifications and application history
- Admin management for services, users, and authorities
- Draft application withdrawal

## Supported departments

The initial seed includes:

1. Revenue Department
2. Education Department
3. Health Department
4. Transport Department
5. Municipal Corporation / Urban Development Department
6. Social Welfare Department
7. Labour Department
8. Agriculture Department
9. Food & Civil Supplies Department
10. Police / Home Department

Departments, services, and required documents are stored in the database and can be extended without hardcoding them in the frontend.

## Architecture

```text
frontend/   React, TanStack Router, TanStack Query, Vite
backend/    Node.js, Express, TypeScript, Mongoose
database    MongoDB
uploads     Local or mounted protected document storage
```

The frontend communicates with the backend through `/api/v1`. Documents are served through authenticated API routes rather than public unrestricted URLs.

## Requirements

- Node.js 20 or newer
- MongoDB 7 or newer, or Docker Desktop
- npm

## Configuration

Create `backend/.env` locally. Do not commit it.

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/karm
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:3000
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10
SLA_WARNING_DAYS=2
```

For the frontend to use the real backend, set `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4000
```

Never place database credentials, JWT secrets, API keys, or passwords in source files or committed documentation.

## Local development

### Backend

```powershell
cd backend
npm install
npm run dev
```

The backend runs on `http://localhost:4000`.

### Frontend

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

The frontend runs on the Vite development URL shown in the terminal. Set `VITE_API_BASE_URL` when using the real backend; otherwise the frontend uses its local mock data.

## Seed development data

With MongoDB running and `backend/.env` configured:

```powershell
cd backend
npm run seed
```

The seed creates the 10 departments, department services, authority records, and development sample data. Initial authority credentials are documented in [AUTHORITY_CREDENTIALS.md](./AUTHORITY_CREDENTIALS.md). These are development-only credentials and must be rotated before any shared or production deployment.

## Docker

To run MongoDB, the backend, and the frontend together:

```powershell
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/health`

The Docker Compose configuration uses a named MongoDB volume and an uploads volume. Review deployment secrets before using it outside local development.

## Testing and builds

Backend:

```powershell
cd backend
npm test
npm run build
```

Frontend:

```powershell
cd frontend
npm test
npm run build
```

## Security notes

- Passwords are stored as bcrypt hashes, never as plaintext.
- Applicants can access only their own applications and documents.
- Authorities can access only applications routed to their assigned department.
- Document routes require authentication and authorization checks.
- Required documents and submission validation are enforced by the backend.
- Draft withdrawal is limited to applications that have not been submitted.
- Keep `backend/.env`, local uploads, and production secrets outside version control.

## Project documentation

- [Backend architecture](./KARM_Backend_Architecture.md)
- [API documentation](./API_DOCUMENTATION.md)
- [Authority credential setup reference](./AUTHORITY_CREDENTIALS.md)
- [Docker Compose configuration](./docker-compose.yml)

## License

Add the project's chosen license before publishing a public repository.
