# Sowan — Wedding RSVP MVP

Stack: Go/Gin/GORM/PostgreSQL + React 19/Vite/Tailwind CSS v4.

## Docker

```bash
docker compose up --build
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

## Verification

```bash
cd backend && go test ./... && go vet ./...
cd frontend && npm run build
```
