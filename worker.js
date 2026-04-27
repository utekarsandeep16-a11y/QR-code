/**
 * Cloudflare Worker — Dynamic QR Redirect Backend
 *
 * Pairs with the QR Generator HTML. Provides:
 *   GET  /r/:slug         -> 302 redirect to current destination (this is what QRs encode)
 *   GET  /api/links       -> list all links (admin only)
 *   POST /api/links       -> create/update a link  body: {slug, destination}
 *   DELETE /api/links/:slug -> delete a link
 *
 * SETUP:
 *   1. Create a free Cloudflare account
 *   2. Install Wrangler:    npm install -g wrangler
 *   3. wrangler login
 *   4. wrangler kv namespace create LINKS
 *      -> copy the id into wrangler.toml below
 *   5. wrangler secret put ADMIN_TOKEN
 *      -> set a strong password; you'll send this in the X-Admin-Token header
 *   6. wrangler deploy
 *
 * wrangler.toml example:
 *   name = "qr-redirect"
 *   main = "worker.js"
 *   compatibility_date = "2024-01-01"
 *   kv_namespaces = [
 *     { binding = "LINKS", id = "<paste-id-here>" }
 *   ]
 *
 * Then in the HTML's Settings, set the redirect prefix to:
 *   https://qr-redirect.<your-subdomain>.workers.dev/r
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Public redirect endpoint - this is what the QR codes hit
    const redirectMatch = path.match(/^\/r\/([a-z0-9_-]+)\/?$/i);
    if (redirectMatch && request.method === 'GET') {
      const slug = redirectMatch[1];
      const destination = await env.LINKS.get(slug);
      if (!destination) {
        return new Response('Link not found', { status: 404 });
      }
      // Increment scan count (optional)
      const statsKey = `_stats:${slug}`;
      const stats = JSON.parse((await env.LINKS.get(statsKey)) || '{"count":0}');
      stats.count = (stats.count || 0) + 1;
      stats.lastScan = Date.now();
      // Don't await; fire-and-forget
      env.LINKS.put(statsKey, JSON.stringify(stats));
      return Response.redirect(destination, 302);
    }

    // Admin API — requires X-Admin-Token header
    if (path.startsWith('/api/')) {
      const token = request.headers.get('X-Admin-Token');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return json({ error: 'Unauthorized' }, 401);
      }

      // POST /api/links — create or update
      if (path === '/api/links' && request.method === 'POST') {
        const body = await request.json().catch(() => null);
        if (!body || !body.slug || !body.destination) {
          return json({ error: 'Missing slug or destination' }, 400);
        }
        if (!/^[a-z0-9_-]+$/i.test(body.slug)) {
          return json({ error: 'Invalid slug' }, 400);
        }
        if (!/^https?:\/\//i.test(body.destination)) {
          return json({ error: 'Destination must be http(s)' }, 400);
        }
        await env.LINKS.put(body.slug, body.destination);
        return json({ ok: true, slug: body.slug, destination: body.destination });
      }

      // GET /api/links — list all
      if (path === '/api/links' && request.method === 'GET') {
        const list = await env.LINKS.list();
        const items = [];
        for (const k of list.keys) {
          if (k.name.startsWith('_stats:')) continue;
          const destination = await env.LINKS.get(k.name);
          const stats = JSON.parse((await env.LINKS.get(`_stats:${k.name}`)) || '{}');
          items.push({ slug: k.name, destination, scans: stats.count || 0, lastScan: stats.lastScan || null });
        }
        return json({ items });
      }

      // DELETE /api/links/:slug
      const delMatch = path.match(/^\/api\/links\/([a-z0-9_-]+)$/i);
      if (delMatch && request.method === 'DELETE') {
        await env.LINKS.delete(delMatch[1]);
        await env.LINKS.delete(`_stats:${delMatch[1]}`);
        return json({ ok: true });
      }

      return json({ error: 'Not found' }, 404);
    }

    // Root — friendly landing
    if (path === '/' || path === '') {
      return new Response(
        `QR Redirect Service — running.\n\n` +
        `QR codes that encode /r/{slug} on this domain will redirect to their stored destination.\n` +
        `Use the admin API to create/update links.\n`,
        { headers: { 'Content-Type': 'text/plain' } }
      );
    }

    return new Response('Not found', { status: 404 });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
