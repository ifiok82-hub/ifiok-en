import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      settings: {
        heroHeadline: 'IFIOK-EN Global Digital Empowerment Network',
        heroSubheadline: 'Empower. Connect. Earn. Grow. Powered by Pi Network Testnet.',
        announcementBanner: 'IFIOK SCHOOL & Testnet Commerce Active',
        supportEmail: 'ifiok82@gmail.com',
        freelanceCommissionPct: 8,
        marketplaceCommissionPct: 5,
        subscriptionProPi: 12,
        subscriptionBusinessPi: 35,
        subscriptionEnterprisePi: 90,
        informationalUsdPerPi: 1.0,
        piEnvironment: 'testnet',
        mainnetEnabled: false,
      },
      stats: {
        members: 0,
        verifiedBusinesses: 0,
        approvedCourses: 0,
        approvedOpportunities: 0,
        approvedProducts: 0,
        approvedServices: 0,
      },
      courses: [],
      businesses: [],
      opportunities: [],
      products: [],
      services: [],
      communityPosts: [],
    })
  );
}
