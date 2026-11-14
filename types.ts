export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationUpdate extends Coordinates {
  id: string;
  name?: string;
  email?: string;
}

export interface OidcUser {
  sub?: string;
  name?: string;
  given_name?: string;
  email?: string;
}

export interface OidcTokenResponse {
  access_token: string;
  token_type?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

export interface Session {
  id: string;
  createdAt: number;
  returnTo?: string;
  user?: OidcUser;
  oidc?: {
    state: string;
    nonce: string;
    codeVerifier: string;
    redirectUri: string;
  };
  tokens?: {
    accessToken: string;
    refreshToken?: string;
    idToken?: string;
    expiresAt?: number;
  };
}

export interface ClientToServerEvents {
  'client:location:update': (coordinates: Coordinates) => void;
}

export interface ServerToClientEvents {
  'server:location:update': (location: LocationUpdate) => void;
}

export interface SocketData {
  session: Session;
}
