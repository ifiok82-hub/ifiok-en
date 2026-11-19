import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildSeedPublicSummary } from '../../src/data/seed.ts';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(buildSeedPublicSummary()));
}
