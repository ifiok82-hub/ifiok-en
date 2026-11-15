import type { IncomingMessage, ServerResponse } from 'node:http';

type Req = IncomingMessage & { query?: { slug?: string | string[] } };

export default function handler(req: Req, res: ServerResponse) {
  const urlPath = (req.url || '').split('?')[0];
  const rawSlug = Array.isArray(req.query?.slug) ? req.query?.slug[0] : req.query?.slug;
  const slug = (rawSlug || urlPath.split('/').pop() || '').toLowerCase();

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  if (slug === 'courses') return res.end(JSON.stringify({ courses: [] }));
  if (slug === 'businesses') return res.end(JSON.stringify({ businesses: [] }));
  if (slug === 'services') return res.end(JSON.stringify({ services: [] }));
  if (slug === 'opportunities') return res.end(JSON.stringify({ opportunities: [] }));
  if (slug === 'products') return res.end(JSON.stringify({ products: [] }));
  if (slug === 'community') return res.end(JSON.stringify({ posts: [], members: [] }));
  if (slug === 'search') return res.end(JSON.stringify({ query: '', results: [] }));

  return res.end(JSON.stringify({ ok: true }));
}
