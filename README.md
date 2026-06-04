# Tracker Service

GPS tracking backend + Expo mobile app. Devices register once, receive an `apiKey`, then POST location pings every 2 seconds while the app is in the foreground. Pings are stored in MongoDB and queryable by device.

---

## How it works

1. App registers the device → receives an `apiKey`
2. While screen is on, app POSTs a GPS ping every 2 seconds using that key
3. Backend stores each ping; optionally reverse-geocodes it via Google (optional, cached)

---

## Backend

### Option 1 — Local (Node + MongoDB)

**Requirements:** 

```bash
cd backend
cp ../.env.example .env      # edit MONGO_URI if needed
npm install
npm start
```

Backend listens on `http://localhost:8080`.

---

### Option 2 — Docker 

**Requirements:** 
```bash
git clone <repo-url>
cd tracker-service
cp .env.example .env         # edit if needed
docker compose up -d
```

Verify it's running:

```bash
docker compose logs -f
```

Expected:
```
mongo     | Waiting for connections on port 27017
backend   | [info] MongoDB connected
backend   | [info] Tracker service listening on port 8080
```

Stop: `docker compose down`  
Stop + wipe data: `docker compose down -v`

---

### Option 3 — Deploy to a server

```bash
ssh user@your-server
git clone <repo-url>
cd tracker-service
cp .env.example .env         
docker compose up -d
```

Backend is available at `http://your-server:8080`.

**HTTPS (required for iOS):** put a reverse proxy in front of port 8080.

Caddy (auto TLS):
```
tracker.yourcompany.com {
    reverse_proxy localhost:8080
}
```

After code changes:
```bash
git pull && docker compose up -d --build
```

---

## Environment Variables

Copy `.env.example` to `.env` in the project root.

| Variable         | Default                         | Description                              |
|------------------|---------------------------------|------------------------------------------|
| `PORT`           | `8080`                          | HTTP port                                |
| `MONGO_URI`      | `mongodb://mongo:27017/tracker` | MongoDB connection string                |
| `LOG_LEVEL`      | `info`                          | `error` / `warn` / `info` / `debug`      |
| `GOOGLE_API_KEY` | *(empty)*                       | Enables reverse geocoding — optional     |

---

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Returns `{"ok":true}` |
| `POST` | `/devices/register` | — | Register device, get `apiKey` |
| `GET` | `/devices` | — | List all devices |
| `POST` | `/location` | `x-api-key` | Record a GPS ping |
| `GET` | `/location/:deviceId/history` | — | Fetch ping history |

### Register a device

```
POST /devices/register
Content-Type: application/json

{ "deviceId": "phone-001", "name": "Anna's Bike", "type": "cyclist" }
```

Response includes `apiKey` — save it, the app uses it for all pings.

### Send a ping

```
POST /location
Content-Type: application/json
x-api-key: <apiKey>

{ "lat": 41.8902, "lng": 12.4922, "speed": 5.2 }
```

### Get history

```
GET /location/phone-001/history?limit=50
```

---

## Mobile App

The Expo app (`mobile/`) registers the device on first launch, then tracks in the foreground.

### Dev (Expo Go)

```bash
cd mobile
npm install
npx expo start
```

Set the backend URL in `mobile/.env`:
```env
EXPO_PUBLIC_API_BASE=http://<your-local-ip>:8080
```

| Target | URL |
|--------|-----|
| Android emulator | `http://10.0.2.2:8080` |
| iOS simulator | `http://localhost:8080` |
| Physical device (LAN) | `http://192.168.x.x:8080` |

---

### Build (EAS) + Share with colleagues

**Prerequisites:** Expo account ([expo.dev](https://expo.dev)), EAS CLI

```bash
npm install -g eas-cli
eas login
```

**1. Set the backend URL** in [mobile/eas.json](mobile/eas.json) for the target profile:

```json
"preview": {
  "env": { "EXPO_PUBLIC_API_BASE": "http://YOUR_SERVER_IP:8080" },
  "distribution": "internal",
  "android": { "buildType": "apk" }
}
```

> Use your server's public IP (not `localhost`) so colleagues' phones can reach it.

**2. Build:**

```bash
cd mobile
eas build --platform android --profile preview
```

First build asks to create a Keystore — select **Yes**. Build takes ~10–20 min in the cloud.

**3. Share:** EAS prints a link when done. Download the `.apk` from there or share the link directly. Colleagues install it on Android — they'll need **"Install from unknown sources"** enabled.

---

## Simulate GPS data

```bash
docker exec tracker-service_backend_1 node scripts/simulateApp.mjs
# then check what was stored:
docker exec tracker-service_backend_1 node scripts/checkDb.mjs
```
