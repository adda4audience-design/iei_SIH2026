# IEI — Institutional Evidence Intelligence
### SIH 2026 · Production-Ready Webapp

> A privacy-preserving platform for document verification, forensic review and institutional evidence consistency.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running locally (or Docker)

### 1. Database Setup

```bash
# Start PostgreSQL (or use the Docker shortcut below)
docker run -d --name iei-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=iei_db -p 5432:5432 postgres:16
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env          # Edit DATABASE_URL and JWT_SECRET
npm run db:generate           # Generate Prisma client
npm run db:push               # Push schema to DB
npm run db:seed               # Seed demo accounts
npm run dev                   # Start on :5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                   # Start on :3000
```

### 4. Open the app
Visit **http://localhost:3000**

---

## 🔐 Demo Login Credentials

| Portal | Email | Password | Role |
|--------|-------|----------|------|
| Officer | `officer1@iei.gov.in` | `officer@IEI2026` | OFFICER |
| Officer | `officer2@iei.gov.in` | `officer@IEI2026` | OFFICER |
| Institute | `admin@techuniversity.ac.in` | `institute@IEI2026` | INSTITUTE |
| Institute | `registrar@globaltech.edu.in` | `institute@IEI2026` | INSTITUTE |
| Admin | `admin@iei.gov.in` | `admin@IEI2026` | ADMIN |

---

## 📁 Project Structure

```
eod/
├── backend/                  # Express + Prisma API
│   ├── src/
│   │   ├── controllers/      # Business logic
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth, upload
│   │   └── utils/            # Prisma client, logger
│   ├── prisma/
│   │   ├── schema.prisma     # Full data model
│   │   └── seed.ts           # Demo data
│   └── uploads/              # Uploaded documents (local storage)
│
└── frontend/                 # Next.js 14 + Tailwind
    ├── app/
    │   ├── login/            # Dual-portal login page
    │   ├── register/         # Institution registration
    │   ├── officer/          # Officer dashboard, review, findings, audit
    │   └── institute/        # Institute dashboard, applications, upload
    ├── components/
    │   ├── layout/           # Sidebars
    │   ├── shared/           # EvidenceGraph (ReactFlow)
    │   └── ui/               # Design system components
    ├── lib/                  # API client, utils
    └── store/                # Zustand auth store
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Dual Login** | Separate Officer and Institute portals with role-based routing |
| **Document Upload** | PDF, images, DOCX with SHA-256 integrity hash |
| **Contradiction Detection** | Auto-detects cross-document claim mismatches |
| **Mock Gov API** | AICTE, UGC, DTE verification (clearly labelled as mock) |
| **Forensic Analysis** | Metadata, typography, pixel, PDF structure, AI-edit indicator (mocked) |
| **Evidence Graph** | Interactive ReactFlow graph of all entities and relationships |
| **Audit Trail** | Full audit log of all system actions |
| **RBAC** | Admin / Officer / Institute roles with enforced permissions |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, ReactFlow |
| State | Zustand, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (RS256-compatible) + bcrypt |
| File Storage | Local disk (multer) + SHA-256 hash |

---

## ⚠️ Privacy & Security Notes

- **No third-party OCR/AI APIs** — all processing stays local
- **Government API calls are mocked** — real integration requires authorized access
- **Forensic results are simulated** — production requires calibrated local models
- **JWT secrets** must be changed before production deployment
- **HTTPS** must be configured for production (use a reverse proxy like nginx)

---

*IEI does not issue automatic fraud verdicts. Final decisions remain with authorized human reviewers.*
