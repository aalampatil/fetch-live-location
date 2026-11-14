import type * as Leaflet from 'leaflet';
import type { Socket } from 'socket.io-client';

import type {
  ClientToServerEvents,
  Coordinates,
  OidcUser,
  ServerToClientEvents,
} from '../types.js';

declare const L: typeof Leaflet;
declare const io: () => Socket<ServerToClientEvents, ClientToServerEvents>;

const socket = io();
const map = L.map('map').setView([51.505, -0.09], 13);
const remoteMarkers = new Map<string, Leaflet.Marker>();

fetch('/api/me')
  .then((response): Promise<{ user: OidcUser }> => response.json())
  .then(({ user }) => {
    const currentUser = document.getElementById('current-user');
    if (currentUser) {
      currentUser.textContent = ` - ${user.name ?? user.email ?? user.sub}`;
    }
  });

socket.on('connect_error', () => {
  window.location.href = '/auth/login';
});

socket.on('server:location:update', (data) => {
  const { id, name, email, latitude, longitude } = data;
  const label = name ?? email ?? id;
  const existingMarker = remoteMarkers.get(id);

  if (existingMarker) {
    existingMarker.setLatLng([latitude, longitude]);
    existingMarker.setPopupContent(label);
  } else {
    const marker = L.marker([latitude, longitude]).addTo(map).bindPopup(label);
    remoteMarkers.set(id, marker);
  }
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

function getUsersCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log(`Got user's location`, position);
          const { latitude, longitude } = position.coords;
          resolve({ latitude, longitude });
        },
        reject,
        { enableHighAccuracy: true },
      );
    } else {
      const message = 'Geolocation is not available in this browser';
      alert(message);
      reject(new Error(message));
    }
  });
}

let myCurrentLocationMarker: Leaflet.Marker | null = null;

function updateMyLocationMarker(latitude: number, longitude: number): void {
  if (!myCurrentLocationMarker) {
    myCurrentLocationMarker = L.marker([latitude, longitude])
      .addTo(map)
      .bindPopup('You are here');
  } else {
    myCurrentLocationMarker.setLatLng([latitude, longitude]);
  }
}

async function main(): Promise<void> {
  const { latitude, longitude } = await getUsersCurrentLocation();
  socket.emit('client:location:update', { latitude, longitude });
  map.setView([latitude, longitude], 15);
  updateMyLocationMarker(latitude, longitude);

  setInterval(async () => {
    const { latitude, longitude } = await getUsersCurrentLocation();
    socket.emit('client:location:update', { latitude, longitude });
    updateMyLocationMarker(latitude, longitude);
  }, 10 * 1000);
}

window.addEventListener('load', main);
