# IncorpX – Company Formation Demo

This repository contains:
- A public landing page (index.html) adapted to a company formation business
- An Admin panel (portal/admin.html) to manage clients and their portals
- A Client portal (portal/client.html) in a modern dashboard style
- An optional Node/Express backend with file uploads and JSON persistence

You can run it in two modes:
1) Static mode (no backend) – everything runs in the browser using localStorage.
2) Server mode (recommended) – a minimal backend is used automatically by the UI.

## Quick start (server mode)

Requirements: Node 18+

1. Install dependencies
   npm install

2. Start the server
   npm run dev

3. Open
   http://localhost:3000/portal/admin.html  (Admin)
   http://localhost:3000/portal/client.html  (Client)

The UI auto-detects the backend via /api/health.
- Admin demo login is automatic with:
  email: admin@incorpx.local
  password: admin

Create a client in Admin. Then open the “Portal” link for that client, or log in at the client portal with the email/password you set.

Uploads are stored in uploads/ and served from /files/... (ignored by git).

## Static mode (no server)

Open the HTML files directly in your browser or serve the folder with any static server.
- Use the Admin panel to create clients; all data is stored in localStorage in your browser only.

## Tech

- Frontend: Vanilla HTML/CSS/JS
- Backend: Node/Express, JWT, Multer uploads, JSON file persistence (server/data/db.json)

## Next steps for production

- Replace demo auth with real credentials and admin user management
- Move persistence to PostgreSQL
- Use S3/GCS for file storage and signed URLs
- Add Stripe for payments and webhooks
- Add KYC and document request workflows
- Email notifications for status changes and tickets
