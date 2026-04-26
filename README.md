# QRForge — Dynamic QR Generator

A polished, single-file QR code generator inspired by qr-code.io. Supports six QR types, full visual customization, and editable destinations via an optional redirect backend.

## Features

**Six QR types** — URL, plain text, Wi-Fi credentials, email (with subject/body), phone number, vCard contact

**Visual customization** — 8 preset colors + custom color picker, three module styles (square / rounded / dots), optional center logo

**Two operating modes**
- **Static** (default) — QR encodes content directly. Works on any phone, no backend needed.
- **Dynamic** — URL QRs encode `your-server/r/{slug}` so destinations stay editable post-print. Pair with the included Cloudflare Worker.

**Dashboard** — live stats, search, mini-QR grid, view/edit/copy/download/delete on each card

**Persistence** — localStorage keeps everything across sessions; export as JSON in Settings

**Smooth UX** — view transitions, modal animations, live preview while typing, dark-mode aware

## Files

| File | Purpose |
|------|---------|
| `index.html` | The full app — drop on any static host. ~91KB self-contained. |
| `worker.js` | Optional Cloudflare Worker for dynamic redirects. |
| `README.md` | This. |

## Run

Just open `index.html` in a browser. No build step. The QRCode library is bundled inline so it works offline.

### Deploy on GitHub Pages

```bash
git init
git add index.html README.md
git commit -m "Initial commit"
git push origin main
```

Then in your repo: **Settings → Pages → Source: main / root** → Save. Live at `https://<username>.github.io/<repo>/`.

## Make QRs editable post-print (dynamic mode)

By default, scanning a URL QR goes directly to the URL you typed. To make the destination editable *after* printing — without changing the QR image — you need a tiny redirect server.

The included `worker.js` runs on Cloudflare Workers (free tier handles 100k requests/day):

```bash
npm install -g wrangler
wrangler login
wrangler kv namespace create LINKS
# copy the id printed by the previous command

cat > wrangler.toml <<EOF
name = "qrforge-redirect"
main = "worker.js"
compatibility_date = "2024-01-01"
kv_namespaces = [
  { binding = "LINKS", id = "<paste-id-here>" }
]
EOF

wrangler secret put ADMIN_TOKEN
# pick a strong password
wrangler deploy
```

You'll get a URL like `https://qrforge-redirect.<your-subdomain>.workers.dev`.

In QRForge → **Settings**, paste:
```
https://qrforge-redirect.<your-subdomain>.workers.dev/r
```

The badge in the top-right turns green ("Dynamic"), and every URL QR now encodes `…/r/{slug}`. Edit the destination anytime from the dashboard — the printed QR keeps working.

### Register a slug with the worker

After saving a QR in dynamic mode, push its slug + destination to the worker:

```bash
curl -X POST https://qrforge-redirect.<your-subdomain>.workers.dev/api/links \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: YOUR_TOKEN" \
  -d '{"slug": "abc123", "destination": "https://example.com"}'
```

To change where a QR points: same call, same slug, new destination. Scans use the new URL immediately.

## QR types reference

| Type | Encodes | Notes |
|------|---------|-------|
| URL | The URL itself, or `prefix/slug` in dynamic mode | Editable post-print only with a backend |
| Text | Plain text | Up to ~1000 chars |
| Wi-Fi | `WIFI:T:WPA;S:network;P:pass;;` | Phones auto-connect on scan |
| Email | `mailto:` link with optional subject/body | Opens user's mail app |
| Phone | `tel:` link | Opens dialer |
| vCard | VCARD 3.0 record | Saves to phone contacts |

## Tested

Ships with a Playwright + ZXing test suite that decodes every generated QR to verify it actually scans correctly. **36/36 checks pass** including:
- All 6 QR types decode to the correct payload
- Color and module-style variants stay scannable
- Dynamic mode preserves QR image when destination changes
- Static mode regenerates QR when destination changes
- 1024px PNG downloads decode at full resolution
- localStorage persistence across reloads
- Search, delete, edit, view-modal flows

## License

MIT
