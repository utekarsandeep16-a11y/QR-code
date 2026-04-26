# QR Generator

A single-file QR code generator with two modes: simple static QRs that work instantly, or fully dynamic QRs (editable post-print) when paired with a tiny backend.

## Two modes

### Static mode (default — no setup)
The QR encodes the destination URL directly. Scan it → phone goes to that URL. Works on every phone, no server, no internet beyond the destination itself.

**Trade-off:** You can't change where the QR goes after printing. Editing the destination requires regenerating and redistributing the QR.

### Dynamic mode (requires backend)
The QR encodes a stable short URL like `https://yourapp.workers.dev/r/abc123`. The backend looks up `abc123` in storage and redirects to the current destination. Edit the destination anytime — the **printed QR keeps working**.

To enable: click **Settings** in the app, paste your backend URL, hit Save.

---

## Run the frontend

Just open `index.html` in a browser. That's it. The QRCode library is bundled inline (~24KB), so the file works offline and on any static host.

### GitHub Pages
1. Push `index.html` to a repo
2. Settings → Pages → Source: `main` / root
3. Live at `https://<username>.github.io/<repo>/`

---

## Deploy the dynamic backend (Cloudflare Workers, free tier)

The included `worker.js` is a single-file Cloudflare Worker that handles redirects and storage. Free tier covers 100k requests/day — more than enough for most use cases.

### Setup (5 minutes)

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Log in to Cloudflare (creates a free account if you don't have one)
wrangler login

# 3. Create a KV namespace for storing links
wrangler kv namespace create LINKS
# -> copy the "id" it prints

# 4. Create wrangler.toml in the same folder as worker.js:
cat > wrangler.toml <<EOF
name = "qr-redirect"
main = "worker.js"
compatibility_date = "2024-01-01"
kv_namespaces = [
  { binding = "LINKS", id = "PASTE_ID_HERE" }
]
EOF

# 5. Set an admin token (you'll use this to manage links)
wrangler secret put ADMIN_TOKEN
# -> type a strong password when prompted

# 6. Deploy
wrangler deploy
```

You'll get a URL like `https://qr-redirect.<your-subdomain>.workers.dev`.

### Connect the frontend to the backend

In the QR Generator app, click **Settings** and set:
```
https://qr-redirect.<your-subdomain>.workers.dev/r
```

Now every QR you generate will encode `your-worker-url/r/<slug>`.

### Add a link to the backend

The frontend currently doesn't sync to the worker — it stores locally in `localStorage`. To make the QR codes actually work when scanned, you need to register each slug with the worker:

```bash
# Replace TOKEN with what you set in step 5
# Replace abc123 with the slug shown in the app

curl -X POST https://qr-redirect.<your-subdomain>.workers.dev/api/links \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: TOKEN" \
  -d '{"slug": "abc123", "destination": "https://example.com"}'
```

To change where a QR redirects later, just call the same endpoint with the same slug and a new destination.

### Optional: add frontend → worker sync

If you want the app to push to the worker automatically (instead of `curl`), open `index.html` and look for the `save()` function. Add a fetch call after `localStorage.setItem`:

```js
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  if (settings.prefix && settings.adminToken) {
    items.forEach(it => {
      fetch(settings.prefix.replace('/r', '') + '/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': settings.adminToken,
        },
        body: JSON.stringify({ slug: it.slug, destination: it.destination }),
      }).catch(() => {});
    });
  }
}
```

And add an `adminToken` field to the settings panel. (Kept out of the main file to keep it secret-free for public hosting.)

---

## API reference (worker)

All admin endpoints require `X-Admin-Token: <your-token>` header.

| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/r/:slug` | — | 302 redirect to destination, or 404 |
| POST | `/api/links` | `{slug, destination}` | `{ok, slug, destination}` |
| GET | `/api/links` | — | `{items: [{slug, destination, scans, lastScan}]}` |
| DELETE | `/api/links/:slug` | — | `{ok}` |

Scan counts are recorded automatically on every redirect.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Self-contained frontend. Drop on any static host. |
| `worker.js` | Cloudflare Worker. Handles `/r/:slug` redirects + admin API. |
| `README.md` | This. |

---

## Tech

- Vanilla JS, zero dependencies in the runtime
- `localStorage` for client-side state
- `qrcode` (npm) bundled with esbuild and inlined into HTML
- Cloudflare Workers + KV for the optional dynamic backend
