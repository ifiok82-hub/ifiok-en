import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  filterAndMergeCourses,
  filterAndMergeOpportunities,
  filterAndMergeProducts,
  filterAndMergeServices,
  searchSeedCatalog,
} from '../../src/data/seed.ts';

type Req = IncomingMessage & { query?: Record<string, string | string[] | undefined> };

function getParam(req: Req, searchParams: URLSearchParams, key: string): string {
  const fromQuery = req.query?.[key];
  if (typeof fromQuery === 'string') return fromQuery;
  if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string') return fromQuery[0];
  return searchParams.get(key) || '';
}

export default function handler(req: Req, res: ServerResponse) {
  const fullUrl = req.url || '/';
  const [urlPath, rawSearch = ''] = fullUrl.split('?');
  const searchParams = new URLSearchParams(rawSearch);
  const rawSlug = Array.isArray(req.query?.slug) ? req.query?.slug[0] : req.query?.slug;
  const slug = (rawSlug || urlPath.split('/').pop() || '').toLowerCase();

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  if (slug === 'courses') {
    const courses = filterAndMergeCourses([], {
      subject: getParam(req, searchParams, 'subject'),
      category: getParam(req, searchParams, 'category'),
      language: getParam(req, searchParams, 'language'),
      q: getParam(req, searchParams, 'q'),
    });
    return res.end(JSON.stringify({ courses }));
  }

  if (slug === 'businesses') {
    return res.end(JSON.stringify({ businesses: [] }));
  }

  if (slug === 'services') {
    const services = filterAndMergeServices([], {
      category: getParam(req, searchParams, 'category'),
      q: getParam(req, searchParams, 'q'),
    });
    return res.end(JSON.stringify({ services }));
  }

  if (slug === 'opportunities') {
    const opportunities = filterAndMergeOpportunities([], {
      type: getParam(req, searchParams, 'type'),
      q: getParam(req, searchParams, 'q'),
    });
    return res.end(JSON.stringify({ opportunities }));
  }

  if (slug === 'products') {
    const products = filterAndMergeProducts([], {
      type: getParam(req, searchParams, 'type'),
      suite: getParam(req, searchParams, 'suite'),
      category: getParam(req, searchParams, 'category'),
      q: getParam(req, searchParams, 'q'),
    });
    return res.end(JSON.stringify({ products }));
  }

  if (slug === 'community') {
    return res.end(JSON.stringify({ posts: [], members: [] }));
  }

  if (slug === 'search') {
    const q = getParam(req, searchParams, 'q');
    return res.end(JSON.stringify({ query: q, results: searchSeedCatalog(q) }));
  }

  return res.end(JSON.stringify({ ok: true }));
}
