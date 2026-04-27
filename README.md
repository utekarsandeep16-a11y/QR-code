# QRForge — Dynamic QR Generator with Editable Destinations

A polished, single-file QR code generator. Six QR types, full visual customization, and **destinations editable after printing** — paired with a tiny Cloudflare Worker.

## The problem this solves

A printed QR encodes a URL. If you later want to change where it goes, you'd normally have to reprint everything. **Dynamic mode fixes this:** the QR encodes a short redirect URL on your worker. The worker looks up the current destination and forwards the user there. Edit the destination in QRForge → backend updates → same printed QR now points to a new place.

## Features

- **Six QR types** — URL, plain text, Wi-Fi credentials, email, phone, vCard
- **Visual customization** — 8 preset colors + custom picker, three module styles (square / rounded / dot), optional center logo
- **Two modes**
  - **Static** (default) — QR encodes content directly, works without any backend
  - **Dynamic** — URL QRs route through your worker; destinations stay editable
- **Auto-publish** — saving a URL QR in dynamic mode pushes the slug+destination to the backend automatically
- **Auto-update** — editing a destination updates the backend; printed QRs pick up the change immediately
- **Auto-delete** — deleting a QR removes it from the backend
- **Sync badges** — every card shows ✓ Live (synced) or ⚠ Not synced (with retry button)
- **Sync All** — bulk publish QRs that were created while disconnected
- **Dashboard** — stats, search, view/edit/copy/download/delete on each card
- **Persistence** — localStorage; export as JSON in Settings

## Files

| File | Purpose |
|------|---------|
| `index.html` | The full app — drop on any static host. ~91KB self-contained. |
| `worker.js` | Cloudflare Worker — handles redirects + admin API. |
| `README.md` | This. |

## Quick start (static mode)

Just open `index.html` in a browser. No build step. Works offline.

To put it on the web: push to GitHub → enable Pages.

## Make destinations editable (dynamic mode)

### 1. Deploy the worker

```bash
npm install -g wrangler
wrangler login
wrangler kv namespace create LINKS
# copy the printed namespace id

cat > wrangler.toml <<EOF
name = "qrforge-redirect"
main = "worker.js"
compatibility_date = "2024-01-01"
kv_namespaces = [{ binding = "LINKS", id = "<paste-id-here>" }]
EOF

wrangler secret put ADMIN_TOKEN
# pick a strong password — you'll paste this in the app

wrangler deploy
```

You'll get a URL like `https://qrforge-redirect.<your-subdomain>.workers.dev`.

### 2. Connect the app

In QRForge → **Settings**:

1. Paste the worker URL (no trailing `/r` needed)
2. Paste the admin token
3. Click **Test & save** — should show ✓ Connected

The badge in the top-right turns green ("Dynamic"). That's it. Now every URL QR you create is automatically published to the backend.

### 3. Edit a destination

Dashboard → click the pencil icon on any URL card → change the URL → Save. The backend updates immediately. The printed QR keeps working — it now redirects to the new destination.

## How auto-sync works

| Action | What happens |
|--------|-------------|
| Save new URL QR (dynamic mode) | `POST /api/links` with `{slug, destination}`. Card gets ✓ Live badge. |
| Edit destination | `POST /api/links` with same slug, new destination. Backend overwrites. |
| Delete QR | `DELETE /api/links/{slug}`. Backend slug removed. |
| Save while disconnected | Card gets ⚠ Not synced badge + retry button. |
| Reconnect → Sync All | All unsynced URL QRs get pushed in one batch. |

Each item stores the worker URL it was created against (`workerUrl`), so swapping the worker URL later doesn't break previously-printed QRs — they keep pointing at the original worker.

## API reference (the worker)

All admin endpoints require `X-Admin-Token` header.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/r/:slug` | Public redirect (302). What QRs encode. |
| `POST` | `/api/links` | Create or update. Body: `{slug, destination}` |
| `GET` | `/api/links` | List all (used for connection test) |
| `DELETE` | `/api/links/:slug` | Remove a slug |

## QR types reference

| Type | Encodes | Editable? |
|------|---------|-----------|
| URL | The URL itself, or `worker/r/slug` in dynamic mode | Yes (dynamic mode) |
| Text | Plain text | No — encoded directly |
| Wi-Fi | `WIFI:T:WPA;S:network;P:pass;;` | No |
| Email | `mailto:` link | No |
| Phone | `tel:` link | No |
| vCard | VCARD 3.0 record | No |

Only URL types support post-print editing. Other types encode their content directly into the QR pattern, so changing them requires regenerating the QR.

## Tested

Two test suites totalling **58 checks**, all passing:

- **`big-test.js`** (36 checks) — UI flows, all six QR types decode correctly, color/style customization stays scannable, persistence, search/edit/delete, 1024px PNG downloads decode at full resolution
- **`integration-test.js`** (22 checks) — full backend integration with a fake worker:
  - Connect & connection test
  - Auto-publish on save → backend gets correct slug+destination
  - "Print" the QR → decode pixels → hit redirect URL → 302 to original destination
  - Edit destination → backend updates → same printed QR now resolves to new destination
  - Delete → backend slug removed
  - Sync All for bulk publish

## License

MIT
