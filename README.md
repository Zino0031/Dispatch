# Print Kiosk — Automated Self-Service Printing System

[![GitHub issues](https://img.shields.io/github/issues/Zino0031/Dispatch.svg)](https://github.com/Zino0031/Dispatch/issues)
[![GitHub license](https://img.shields.io/github/license/Zino0031/Dispatch.svg)](https://github.com/Zino0031/Dispatch/blob/main/LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-4-blue)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-blue)](https://socket.io/)

# Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Web UI Setup](#web-ui-setup)
  - [Kiosk Client Setup](#kiosk-client-setup)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Socket Protocol](#socket-protocol)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Overview

Print Kiosk is an automated self-service printing system that allows users to upload documents from their phones or devices and print them at dedicated kiosk stations. The system consists of three main components:

1. **Backend** - Express.js + Socket.io API server that manages print jobs, kiosk connections, and real-time status updates
2. **Web UI** - Next.js 15 React application for users to upload documents, select kiosks, and track print status
3. **Kiosk Client** - Node.js daemon running on Mini PCs that connects to the backend, downloads documents, converts them if needed, and prints via CUPS

## Architecture

```
┌─────────────┐    HTTPS/REST + Socket.io    ┌──────────────┐
│   Web UI    │ ───────────────────────────▶ │  Backend     │
│  (Next.js)  │                              │  (Express)   │
└─────────────┘                              └──────┬───────┘
                                                    │
                                                      │ Socket.io
                                                    │
                                ┌──────────────┐ ◀──────┴───────┐
                                │   Kiosk     │                  │
                                │   Client    │ ◀──────────────┘ │
                                │  (Node.js)  │   Socket.io      │
                                └──────┬──────┘                  │
                                       │                          │
                                       ▼                          │
                                ┌──────────────┐                  │
                                │   CUPS       │                  │
                                │   (Printer)  │                  │
                                └──────────────┘                  │
                                                                  │
                                    ┌──────────────┐             │
                                    │  LibreOffice │             │
                                    │   (DOC/DOCX  │             │
                                    │    → PDF)    │             │
                                    └──────────────┘             │
                                                                  │
──────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Web UI**: User uploads a document, selects a kiosk, and submits a print job
2. **Backend**: Receives the job, creates a job record, emits `NEW_PRINT_JOB` to the kiosk via Socket.io
3. **Kiosk Client**: Receives the job, downloads the file, converts DOC/DOCX to PDF if needed, prints via CUPS
4. **Status Updates**: Kiosk emits status updates (`DOWNLOAD_START`, `DOWNLOAD_COMPLETE`, `PRINTING_STARTED`, `PRINT_SUCCESS`, `ERROR`) which are broadcast to the web UI

## Project Structure

```
print-kiosk/
├── apps/
│   ├── backend/                 # Express + Socket.io API
│   │   ├── src/
│   │   │   ├── index.ts         # App bootstrap
│   │   │   ├── config.ts        # Environment & CORS config
│   │   │   ├── socket.ts        # Socket.io handlers
│   │   │   ├── kioskRegistry.ts # Kiosk management
│   │   │   ├── kioskAuth.ts     # Kisk authentication
│   │   │   ├── supabase.ts      # Supabase client
│   │   │   ├── types.ts         # TypeScript types
│   │   │   ├── jobs/
│   │   │   │   ├── jobStore.ts  # In-memory job store
│   │   │   └── routes/
│   │   │       ├── printJob.ts  # Print job routes
│   │   │       └── admin.ts     # Admin routes
│   │   ├── scripts/
│   │   │   └── fake-kiosk.ts    # Simulated kiosk for testing
│   │   ├── supabase/
│   │   │   └── migrations/
│   │   │       └── 20251015_jobs.sql
│   │   ├── uploads/             # Uploaded documents
│   │   └── dist/                # Compiled output
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   └── jest.config.cjs
│
│   ├── web/                     # Next.js user interface
│   │   ├── app/
│   │   │   ├── page.tsx         # Main wizard (6 steps)
│   │   │   ├── admin/           # Operations console
│   │   │   ├── backend.ts       # API base URL helper
│   │   │   ├── scan.ts          # Canvas scan editor
│   │   │   ├── layout.tsx       # Root layout
│   │   │   └── globals.css      # Global styles
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── ...
│
│   └── kiosk-client/            # Mini PC print agent
│       ├── src/
│       │   ├── index.ts         # Socket client & main loop
│       │   ├── config.ts        # Configuration
│       │   ├── config.ts        # Environment config
│       │   ├── identity.ts      * Hardware ID from MAC
│       │   ├── config.ts        # Environment configuration
│       │   ├── downloader.ts    # Capped HTTP(S) download
│       │   ├── documentNormalizer.ts  # DOC/DOCX → PDF
│       │   ├── printer.ts       # CUPS printing
│       │   ├── types.ts         # Shared types
│       │   └── index.ts         # Socket client & main loop
│       ├── systemd/             # Systemd service unit
│   │   │   └── kiosk-client.service
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── ...
│
├── docs/
│   ├── API.md                   # REST API reference
│   ├── ARCHITECTURE.md          # System architecture
│   ├── PROJECT_STRUCTURE.md     # Project layout
│   ├── PLAN.md                  # Delivery plan
│   ├── PRD.md                   # Product requirements
│   ├── SOCKET_PROTOCOL.md       # Socket event reference
│   ├── GUIDELINES.md            # Development guidelines
│   └── OPERATIONS.md            # Operations & runbooks
│   └── PILOT.md                 # Pilot deployment checklist
│
├── scripts/
│   ├── check-contracts.sh       # Triple-contract sync check
│   ├── ci-smoke.sh              # CI smoke test
│   ├── check-env-examples.sh    # Env example validation
│   └── create-github-issues.sh  # GitHub issue creation
│
├── .github/
│   └── workflows/
│       ├── contracts.yml        # Contract sync CI
│       └── ci.yml               # CI pipeline
│
├── scripts/issues/              # GitHub issue templates (#1-#22)
├── scripts/issues/*.md          # Individual issue descriptions
│
├── docs/                        # Documentation
│   ├── API.md                   # REST API contract
│   ├── ARCHITECTURE.md          # System architecture
│   ├── PROJECT_STRUCTURE.md     # Project layout
│   ├── PLAN.md                  # Delivery plan
│   ├── PRD.md                   # Product requirements
│   ├── SOCKET_PROTOCOL.md       # Socket protocol reference
│   ├── GUIDELINES.md            # Development guidelines
│   ├── OPERATIONS.md            & Operations & runbooks
│   └── PILOT.md                 & Pilot deployment checklist
│
├── README.md                    # This file
├── .gitignore                   # Git ignore rules
├── package.json                 # Root package
├── package-lock.json            # Root lock file
└── .github/
    └── workflows/
        ├── contracts.yml        # Contract sync CI
        └── ci.yml               # CI pipeline
```

## Getting Started

### Prerequisites

- **Node.js 22+** (all apps)
- **CUPS** with a default printer (kiosk client only)
- **LibreOffice** (kiosk client, for DOC/DOCX conversion)
- **Supabase** (optional, for kiosk authentication persistence)
- **Git**

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd apps/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment example:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your configuration:
   ```env
   PORT=4000
   PUBLIC_URL=http://localhost:4000
   CORS_ORIGIN=http://localhost:3000
   ADMIN_TOKEN=your-admin-token
   KIOSK_ENROLLMENT_TOKEN=your-enrollment-token
   AUTO_ENROLL_KIOSKS=false
   ```

5. Start the backend:
   ```bash
   npm run dev
   ```

The backend will be available at `http://localhost:4000`.

### Web UI Setup

1. Navigate to the web directory:
   ```bash
   cd apps/web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser.

### Kiosk Client Setup

1. Install Node.js 22+, CUPS, and LibreOffice:
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install -y nodejs npm cups cups-client libreoffice
   ```

2. Navigate to the kiosk-client directory:
   ```bash
   cd apps/kiosk-client
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Copy the environment example:
   ```bash
   cp .env.example .env
   ```

5. Edit `.env` with your configuration:
   ```env
   SERVER_URL=http://localhost:4000
   KIOSK_ID=my-kiosk-1
   KIOSK_TOKEN=
   KIOSK_TOKEN_FILE=.kiosk-token
   TEMP_DIR=./temp
   MAX_DOWNLOAD_BYTES=52428800
   DOWNLOAD_TIMEOUT_MS=60000
   ```

6. Build and start:
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

### Backend (`apps/backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | `4000` |
| `PUBLIC_URL` | Public URL for file access | `http://localhost:4000` |
| `CORS_ORIGIN` | Allowed CORS origins | `http://localhost:3000` |
| `ADMIN_TOKEN` | Admin authentication token | Required |
| `KIOSK_ENROLLMENT_TOKEN` | Kiosk enrollment token | Required |
| `AUTO_ENROLL_KIOSKS` | Allow auto-enrollment | `false` |
| `SUPABASE_URL` | Supabase project URL | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Optional |
| `SUPABASE_STORAGE_BUCKET` | Supabase storage bucket | `print-documents` |
| `PRINT_DOCUMENT_RETENTION_HOURS` | Document retention hours | `24` |

### Web (`apps/web/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL | `http://localhost:4000` |

### Kiosk Client (`apps/kiosk-client/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_URL` | Backend URL | Required |
| `KIOSK_ID` | Kiosk identifier | MAC address |
| `KIOSK_TOKEN` | Kiosk authentication token | Optional |
| `KIOSK_TOKEN_FILE` | Token file path | `.kiosk-token` |
| `TEMP_DIR` | Temporary directory | `./temp` |
| `MAX_DOWNLOAD_BYTES` | Max download size | `52428800` (50 MB) |
| `DOWNLOAD_TIMEOUT_MS` | Download timeout | `60000` (60 s) |

## API Reference

### Upload Document

**POST** `/api/upload`

Upload a document for printing.

**Body:** `multipart/form-data` with `file` field

**Response:**
```json
{
  "fileUrl": "http://localhost:4000/uploads/abc123.pdf",
  "fileName": "document.pdf",
  "mimeType": "application/pdf",
  "size": 12345
}
```

### Create Print Job

**POST** `/api/print-job`

**Body:**
```json
{
  "kioskId": "printer-1",
  "fileUrl": "http://localhost:4000/uploads/abc123.pdf",
  "copies": 1,
  "color": "bw",
  "duplex": false,
  "pages": "1-3, 5"
}
```

**Response:**
```json
{
  "printJobId": "uuid-here",
  "accessToken": "abc123...",
  "status": "QUEUED"
}
```

### Get Job Status

**GET** `/api/print-job/:printJobId`

**Headers:** `x-print-job-token: <accessToken>`

**Response:**
```json
{
  "printJobId": "uuid-here",
  "kioskId": "printer-1",
  "copies": 1,
  "color": "bw",
  "duplex": false,
  "status": "PRINT_SUCCESS",
  "createdAt": "2026-10-15T10:00:00.000Z",
  "updatedAt": "2026-10-15T10:02:00.000Z",
  "history": [
    { "status": "QUEUED", "at": "2026-10-15T10:00:00.000Z" },
    { "status": "SENT_TO_KIOSK", "at": "2026-10-15T10:00:01.000Z" },
    { "status": "DOWNLOAD_START", "at": "2026-10-15T10:00:02.000Z" },
    { "status": "DOWNLOAD_COMPLETE", "at": "2026-10-15T10:00:05.000Z" },
    { "status": "PRINTING_STARTED", "at": "2026-10-15T10:00:06.000Z" },
    { "status": "PRINT_SUCCESS", "at": "2026-10-15T10:00:45.000Z" }
  ]
}
```

### List Online Kiosks

**GET** `/api/kiosks`

**Response:**
```json
{
  "kiosks": [
    {
      "kioskId": "printer-1",
      "displayName": "Library Lobby",
      "online": true,
      "connectedAt": "2026-10-15T10:00:00.000Z"
    }
  ]
}
```

## Socket Protocol

The backend uses Socket.io for real-time communication.

### Rooms

| Room | Members | Purpose |
|------|---------|---------|
| `kiosk:{kioskId}` | One kiosk socket | Targeted job delivery |
| `job:{printJobId}` | User socket(s) | Live status updates |

### Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `NEW_PRINT_JOB` | Backend → Kiosk | `{ printJobId, kioskId, fileUrl, copies, color, duplex }` |
| `kiosk_status` | Kiosk → Backend | `{ printJobId, event, message }` |
| `JOB_STATUS` | Backend → User | `{ printJobId, kioskId, event, message, at }` |
| `KIOSK_ENROLLED` | Backend → Kiosk | `{ kioskId, token }` |

### Kiosk Status Events

- `DOWNLOAD_START` - Kiosk started downloading the file
- `DOWNLOAD_COMPLETE` - File download completed
- `PRINTING_STARTED` - Printing started
- `PRINT_SUCCESS` - Print completed successfully
- `ERROR` - General error
- `PRINTER_ERROR` - Printer-specific error

## Testing

The project uses Jest for testing. Each app has its own test suite.

### Backend Tests

```bash
cd apps/backend
npm test
```

### Kiosk Client Tests

```bash
cd apps/kiosk-client
npm test
```

## Deployment

### Backend (Render)

The backend is designed to run on Render:

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the root directory to `apps/backend`
4. Set environment variables from `.env.example`
5. Deploy

### Web (Vercel)

The web UI is designed to deploy on Vercel:

1. Create a new project on Vercel
2. Connect your GitHub repository
3. Set the root directory to `apps/web`
4. Set `NEXT_PUBLIC_BACKEND_URL` environment variable
5. Deploy

### Kiosk Client (Mini PC)

1. Install Node.js 22+, CUPS, and LibreOffice
2. Clone the repository
3. Configure `.env` with `SERVER_URL` pointing to your backend
4. Run `npm install && npm run build && npm start`
5. Optionally set up systemd for auto-restart:

```bash
sudo cp apps/kiosk-client/systemd/kiosk-client.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kiosk-client
```

## Roadmap

- [x] Backend API (upload, print-job, kiosk list)
- [x] Socket.io real-time status tracking
- [x] Web user interface (6-step wizard)
- [x] Kiosk client (download, normalize, print)
- [ ] Job persistence (Supabase/Postgres)
- [ ] Secure uploads (signed URLs)
- [ ] Per-kiosk queueing with position UI
- [ ] Real payments integration
- [ ] Pilot deployment (2 kiosks, 2 weeks)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests (`npm test` in each app)
5. Commit your changes (`git commit -m 'feat: ...'`)
6. Push to the branch (`git push origin feature/your-feature`)
7. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built for Print-Kiosk project
- Built with Express, Socket.io, Next.js, React, Node.js, CUPS, LibreOffice
- Deployed on backend and web
- Inspired by campus printing needs

## Support

For issues, feature requests, or questions, please open an issue on GitHub.

---

**Note:** This is a pilot project. Some features (job persistence, real payments, multi-kiosk queueing) are planned for future releases. See the [Plan](docs/PLAN.md) and [PRD](docs/PRD.md) for details.