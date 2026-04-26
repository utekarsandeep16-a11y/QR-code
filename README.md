# Dynamic QR Generator

A single-file, zero-dependency dynamic QR code generator. Works offline. Drop it on GitHub Pages and you're done.

## Features

- Generate QR codes pointing to short URLs (e.g. `qr.short/r/abc123`)
- Edit the destination URL anytime — **the QR never changes**
- Download as PNG (1024×1024) or SVG
- Persists across browser sessions via `localStorage`
- Copy short link to clipboard
- Delete codes you no longer need

## Use

Just open `index.html` in a browser. That's it. No build step, no server, no npm install.

The QRCode library is bundled inline (~24KB), so the file works offline.

## Deploy on GitHub Pages

1. Create a new repo, drop `index.html` in the root, push.
2. Repo **Settings → Pages → Source: main branch / root**.
3. Live at `https://<username>.github.io/<repo>/`.

## How the dynamic redirect works

The QR code encodes `qr.short/r/{slug}` — a stable short URL that never changes. The destination is stored separately. To get the redirect to actually fire when someone scans the QR, you need a tiny backend:

```js
// Minimal Express version
const express = require('express');
const app = express();
const links = new Map(); // slug -> destination

app.get('/r/:slug', (req, res) => {
  const dest = links.get(req.params.slug);
  if (!dest) return res.status(404).send('Not found');
  res.redirect(302, dest);
});

app.listen(3000);
```

Replace the `DOMAIN` constant in `index.html` (line ~140) with your real domain (e.g. `relay.yoursite.com`), point that domain at this server, and you have a working dynamic QR system. The frontend stores everything client-side, so for a multi-user setup you'd swap `localStorage` for a fetch to your API.

## Tech

- Vanilla JS, no framework
- `localStorage` for persistence
- `qrcode` npm package, bundled with esbuild and inlined
- Single HTML file, ~35KB total
