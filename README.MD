# Kafka Learning Project

A TypeScript application demonstrating authenticated location sharing with Express, Socket.IO, and Kafka. The server, command-line utilities, and browser client use strict TypeScript checks and compile to Node.js/browser ES modules.

## Tech stack

- TypeScript and Node.js (ES modules)
- Express 5 and Socket.IO
- KafkaJS and Kafka in KRaft mode
- Leaflet for the browser map
- pnpm and Docker Compose

## Project structure

```text
.
├── client/
│   └── app.ts                  # Browser map and geolocation client
├── public/
│   └── index.html              # Page markup and CDN scripts
├── index.ts                    # HTTP server, OIDC login, and socket events
├── kafka-client.ts             # Shared Kafka connection configuration
├── kafka-admin.ts              # Creates the location-updates topic
├── database-processor.ts       # Logs consumed location events
├── load-env.ts                 # Loads optional .env variables
├── register-oidc-client.ts     # Registers this app with the OIDC provider
├── types.ts                    # Shared location, authentication, and event types
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── docker-compose.yml
└── README.MD
```

Compiled JavaScript and source maps go into `dist/`, which is ignored by Git. The server serves the compiled browser client from `dist/client/` alongside the HTML in `public/`.

## Setup

Install Node.js 18 or newer, pnpm, Docker, and Docker Compose. Run all commands from the project root.

```sh
pnpm install
docker compose up -d
pnpm kafka:setup
```

Docker Compose runs a single Kafka broker at `localhost:9092` in KRaft mode, without Zookeeper. The setup command creates the `location-updates` topic with two partitions.

## OIDC configuration

The default login provider frontend is `https://oidc-ap.aalampatil.online`, and its API/issuer is `https://oidc-server.aalampatil.online`.

Register this local application as a trusted client:

```sh
pnpm oidc:register:env
```

This writes a local `.env` file with the registered credentials. It replaces an existing `.env`, so preserve any custom values first. The file is ignored by Git because it contains the client secret. To print the registration configuration without writing `.env`, use `pnpm oidc:register`.

Alternatively, create `.env` with credentials for an existing client:

```dotenv
PORT=8000
KAFKA_BROKER=localhost:9092
OIDC_ISSUER=https://oidc-server.aalampatil.online
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=http://localhost:8000/auth/callback
OIDC_SCOPE=openid email profile
```

The registration utility also accepts `OIDC_PROVIDER_BASE`, `APP_URL`, and `OIDC_APP_NAME` from the shell environment. The server accepts optional `OIDC_AUTHORIZATION_ENDPOINT`, `OIDC_TOKEN_ENDPOINT`, and `OIDC_USERINFO_ENDPOINT` overrides.

## Run and check

```sh
pnpm typecheck
pnpm build
pnpm start
```

Open `http://localhost:8000`. Unauthenticated users are redirected to the OIDC login flow. Allow browser geolocation to share your location.

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | Check all TypeScript source without emitting files |
| `pnpm build` | Compile the server, utilities, and browser client into `dist/` |
| `pnpm start` | Build and start the HTTP/Socket.IO server |
| `pnpm kafka:setup` | Build and create the Kafka topic |
| `pnpm kafka:process` | Build and run the separate database processor |
| `pnpm oidc:register` | Build, register an OIDC client, and print its environment configuration |
| `pnpm oidc:register:env` | Build, register an OIDC client, and write `.env` |

Each executable script builds before running, so it works from a fresh checkout after installing dependencies. After `pnpm build`, you can also run the compiled entry points directly, such as `node dist/index.js` or `node dist/database-processor.js`.

## How it works

1. The user logs in through OIDC using authorization code flow with PKCE.
2. The authenticated browser connects to Socket.IO and publishes its coordinates.
3. The server adds the user's identity and produces location events to Kafka.
4. A Kafka consumer broadcasts location updates to connected clients.
5. Each client updates the corresponding Leaflet map markers.

The optional database processor consumes the same topic in a separate consumer group. It currently logs events; it does not persist them to a database.

## Local development notes

This is a learning project with in-memory sessions and a single Kafka node. A production deployment would need durable sessions, appropriate Kafka replication and networking, and operational monitoring. Docker Compose is intended for local development.
