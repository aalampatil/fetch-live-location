import './load-env.js';

import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';

import express from 'express';
import { Server } from 'socket.io';

import { kafkaClient } from './kafka-client.js';

const OIDC_ISSUER =
  process.env.OIDC_ISSUER?.replace(/\/$/, '') ??
  'https://oidc-server.aalampatil.online';
const OIDC_AUTHORIZATION_ENDPOINT =
  process.env.OIDC_AUTHORIZATION_ENDPOINT ??
  `${OIDC_ISSUER}/o/3rd-party-client/authorize`;
const OIDC_TOKEN_ENDPOINT =
  process.env.OIDC_TOKEN_ENDPOINT ?? `${OIDC_ISSUER}/o/token`;
const OIDC_USERINFO_ENDPOINT =
  process.env.OIDC_USERINFO_ENDPOINT ?? `${OIDC_ISSUER}/o/userinfo`;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID;
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const OIDC_SCOPE = process.env.OIDC_SCOPE ?? 'openid email profile';
const SESSION_COOKIE = 'kafka_location_sid';
const sessions = new Map();

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function codeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((cookie) => cookie.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function getOrigin(req) {
  const protocol = req.headers['x-forwarded-proto'] ?? req.protocol;
  return `${protocol}://${req.get('host')}`;
}

function getRedirectUri(req) {
  return process.env.OIDC_REDIRECT_URI ?? `${getOrigin(req)}/auth/callback`;
}

function createSession() {
  const id = randomToken();
  const session = { id, createdAt: Date.now() };
  sessions.set(id, session);
  return session;
}

function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let session = cookies[SESSION_COOKIE] && sessions.get(cookies[SESSION_COOKIE]);

  if (!session) {
    session = createSession();
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 1000 * 60 * 60 * 24,
    });
  }

  req.session = session;
  next();
}

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.redirect(`/auth/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
}

function requireOidcConfig(req, res, next) {
  if (OIDC_CLIENT_ID && OIDC_CLIENT_SECRET) return next();

  return res.status(500).send(`
    <h1>OIDC client is not configured</h1>
    <p>Register this app with the OIDC service, then set:</p>
    <pre>OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_REDIRECT_URI=${getRedirectUri(req)}</pre>
    <p>Run: <code>node register-oidc-client.js</code></p>
  `);
}

async function exchangeCodeForTokens({ code, redirectUri, codeVerifier }) {
  const response = await fetch(OIDC_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: OIDC_CLIENT_ID,
      client_secret: OIDC_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function fetchUserInfo({ accessToken, tokenType }) {
  const response = await fetch(OIDC_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `${tokenType ?? 'Bearer'} ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`UserInfo failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function getSessionFromSocket(socket) {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  return cookies[SESSION_COOKIE] && sessions.get(cookies[SESSION_COOKIE]);
}

async function main() {
  const PORT = process.env.PORT ?? 8000;

  const app = express();
  app.set('trust proxy', 1);
  app.use(sessionMiddleware);

  const server = http.createServer(app);
  const io = new Server();

  const kafkaProducer = kafkaClient.producer();
  await kafkaProducer.connect();

  const kafkaConsumer = kafkaClient.consumer({
    groupId: `socket-server-${PORT}`,
  });
  await kafkaConsumer.connect();

  await kafkaConsumer.subscribe({
    topics: ['location-updates'],
    fromBeginning: true,
  });

  kafkaConsumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat }) => {
      const data = JSON.parse(message.value.toString());
      console.log(`KafkaConsumer Data Received`, { data });
      io.emit('server:location:update', {
        id: data.id,
        name: data.name,
        email: data.email,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      await heartbeat();
    },
  });

  io.attach(server);

  io.use((socket, next) => {
    const session = getSessionFromSocket(socket);
    if (!session?.user) {
      return next(new Error('unauthorized'));
    }

    socket.session = session;
    return next();
  });

  io.on('connection', (socket) => {
    const user = socket.session.user;
    console.log(`[Socket:${socket.id}]: Connected Success...`, {
      user: user.email ?? user.sub,
    });

    socket.on('client:location:update', async (locationData) => {
      const { latitude, longitude } = locationData;
      console.log(
        `[Socket:${socket.id}]:client:location:update:`,
        locationData,
      );

      await kafkaProducer.send({
        topic: 'location-updates',
        messages: [
          {
            key: user.sub ?? socket.id,
            value: JSON.stringify({
              id: user.sub ?? socket.id,
              name: user.name ?? user.given_name ?? user.email ?? 'Authenticated user',
              email: user.email,
              latitude,
              longitude,
            }),
          },
        ],
      });
    });
  });

  app.get('/health', (req, res) => {
    return res.json({ healthy: true });
  });

  app.get('/auth/login', requireOidcConfig, (req, res) => {
    const redirectUri = getRedirectUri(req);
    const state = randomToken();
    const nonce = randomToken();
    const codeVerifier = randomToken(64);

    req.session.returnTo = req.query.returnTo || '/';
    req.session.oidc = {
      state,
      nonce,
      codeVerifier,
      redirectUri,
    };

    const authorizeUrl = new URL(OIDC_AUTHORIZATION_ENDPOINT);
    authorizeUrl.searchParams.set('client_id', OIDC_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', OIDC_SCOPE);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('code_challenge', codeChallenge(codeVerifier));
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('app', 'Kafka Location Sharing');

    return res.redirect(authorizeUrl.toString());
  });

  app.get('/auth/callback', requireOidcConfig, async (req, res, next) => {
    try {
      const { code, state, error, error_description } = req.query;
      if (error) {
        return res.status(401).send(error_description ?? error);
      }

      if (!code || !state || state !== req.session.oidc?.state) {
        return res.status(400).send('Invalid OIDC callback state.');
      }

      const tokens = await exchangeCodeForTokens({
        code,
        redirectUri: req.session.oidc.redirectUri,
        codeVerifier: req.session.oidc.codeVerifier,
      });
      const user = await fetchUserInfo({
        accessToken: tokens.access_token,
        tokenType: tokens.token_type,
      });

      req.session.user = user;
      req.session.tokens = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresAt: tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined,
      };
      delete req.session.oidc;

      const returnTo = req.session.returnTo ?? '/';
      delete req.session.returnTo;
      return res.redirect(returnTo);
    } catch (error) {
      return next(error);
    }
  });

  app.post('/auth/logout', (req, res) => {
    sessions.delete(req.session.id);
    res.clearCookie(SESSION_COOKIE);
    return res.redirect('/');
  });

  app.get('/api/me', requireAuth, (req, res) => {
    return res.json({ user: req.session.user });
  });

  app.use(requireAuth, express.static(path.resolve('./public')));

  server.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`),
  );
}

main();
