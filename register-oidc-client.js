import fs from 'node:fs';

const providerBase =
  process.env.OIDC_PROVIDER_BASE?.replace(/\/$/, '') ??
  'https://oidc-server.aalampatil.online';
const appUrl = process.env.APP_URL?.replace(/\/$/, '') ?? 'http://localhost:8000';

const registration = {
  name: process.env.OIDC_APP_NAME ?? 'Kafka Location Sharing',
  redirectUris: [process.env.OIDC_REDIRECT_URI ?? `${appUrl}/auth/callback`],
  scopes: process.env.OIDC_SCOPE ?? 'openid email profile',
};

const response = await fetch(`${providerBase}/o/3rd-party-client/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(registration),
});

if (!response.ok) {
  throw new Error(
    `OIDC client registration failed: ${response.status} ${await response.text()}`,
  );
}

const client = await response.json();
const env = [
  `PORT=${process.env.PORT ?? 8000}`,
  `KAFKA_BROKER=${process.env.KAFKA_BROKER ?? 'localhost:9092'}`,
  `OIDC_ISSUER=${providerBase}`,
  `OIDC_CLIENT_ID=${client.clientId}`,
  `OIDC_CLIENT_SECRET=${client.clientSecret}`,
  `OIDC_REDIRECT_URI=${registration.redirectUris[0]}`,
  `OIDC_SCOPE=${registration.scopes}`,
  '',
].join('\n');

console.log(env);

if (process.argv.includes('--write-env')) {
  fs.writeFileSync('.env', env);
  console.log('Wrote .env');
}
