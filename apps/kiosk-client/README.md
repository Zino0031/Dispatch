# Kiosk client (Phases 3–4)

Linux Node.js service for the Mini PC. It connects to the backend with Socket.IO,
downloads a job into a mode-600 temporary file, submits it to CUPS with `lp`,
reports lifecycle events, and removes the file after every terminal outcome.

## Kiosk identity

`KIOSK_ID` is optional. When omitted, the client detects the first physical
network interface MAC address and uses its lowercase value as both the stable
kiosk ID and initial display name. The backend must contain that ID in its
`KIOSK_CREDENTIALS` map before the client can connect.

Print the detected identity with:

```bash
npm run identity
```

Administrators can rename the display name from `/admin`; renaming never changes
the MAC-based ID, so jobs cannot be sent to a different kiosk by name collision.
The current development registry keeps renamed values in memory; persistence in
Supabase is part of the next backend persistence step.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The current client targets Linux/CUPS. Install `cups`, make sure `lp` and
`lpstat` are on the PATH, and configure one default CUPS destination on each
kiosk. The client always prints to that OS default destination.

PDF, JPEG, and PNG files are sent directly to CUPS without conversion. A
printer cannot interpret DOC/DOCX layout directly; those files require a
document renderer on the kiosk. The current renderer is LibreOffice:

```bash
sudo apt install libreoffice
```

`PRINT_SUCCESS` means CUPS accepted the job. Spooler observation and DOC/DOCX
normalization are the next hardening increments; ambiguous physical outcomes
must not be retried automatically.
