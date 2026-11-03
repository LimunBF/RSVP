# Sowan — Wedding RSVP MVP

Stack: Go/Gin/GORM/PostgreSQL + React 19/Vite/Tailwind CSS v4.

## Docker

`JWT_SECRET` is required and must be at least 32 characters; the backend refuses to start
without it, so Compose has no default.

```bash
JWT_SECRET="$(openssl rand -hex 32)" docker compose up --build
```

Frontend: http://localhost:5173  
Backend health: http://localhost:8080/health

## Local development

Requires PostgreSQL 16 database matching `DATABASE_URL`.

```bash
cd backend
go run ./cmd/server

cd ../frontend
npm install
npm run dev
```

Seed demo data after database is ready:

```bash
cd backend
go run ./cmd/seed
```

Demo: `demo@rsvp.local` / `demopassword`, public path `/w/anisa-bima`.

## Guest check-in

The entrance poster QR points at `/w/<slug>/check-in?t=<token>`. The token is minted per
wedding from the dashboard (`GET /api/weddings/:id/check-in-token`) and expires after 14 days.
Without it the guest list cannot be searched or checked in, so a leaked slug is not enough
to enumerate guests or mark someone else as present.

## Verification

```bash
cd backend && go test ./... && go vet ./...
cd frontend && npm run build
```
