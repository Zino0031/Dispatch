 # Web application

Next.js App Router client for the campus print workflow. The first slice provides
file selection, print options, online kiosk discovery, and a local status preview.

Before submission, the browser previews PDFs in its built-in PDF viewer, images
directly, and DOC/DOCX through Mammoth HTML rendering. The user must approve the
preview before the real upload and print-job request are sent. DOCX preview is a
visual approximation; the original file is preserved for the kiosk renderer.

```bash
npm install
npm run dev
```

Set `NEXT_PUBLIC_BACKEND_URL` when the backend is not running at
`http://localhost:4000`. Submission is currently a client-side workflow preview;
the next slice will connect it to the authenticated Supabase upload and payment
flow.
# Web app (Phase 2)

Next.js (App Router) + React + TypeScript + Tailwind. Not implemented yet.

Planned: PDF upload (simulated cloud URL), print options, Socket.io job-status dashboard.
