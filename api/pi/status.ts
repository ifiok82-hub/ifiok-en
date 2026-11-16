import type { IncomingMessage, ServerResponse } from 'node:http';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      success: true,
      ok: true,
      app: 'IFIOK-EN',
      appUrl: 'https://ifiok-en.vercel.app',
      environment: 'testnet',
      sandbox: true,
      sdkVersion: '2.0',
      direction: 'user_to_app',
      testAmountPi: 0.01,
      testnetWallet: process.env.PI_TESTNET_WALLET?.trim() || 'GDD4KZEBDEJMYJYP6O5SCBHE5GGIF6K3RTHCF4ZGIWWIPGAHLTTXZB2O',
      piServerKeyConfigured: Boolean(
        (process.env.PI_NETWORK_API_KEY && process.env.PI_NETWORK_API_KEY.trim().length > 10) ||
          (process.env.PI_API_KEY && process.env.PI_API_KEY.trim().length > 10)
      ),
    })
  );
}
