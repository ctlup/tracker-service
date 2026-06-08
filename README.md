# Tracker Service

GPS tracking backend + Expo mobile app. Devices register once, get an `apiKey`, then POST location pings every 2 seconds while the app is open. Pings are stored in MongoDB.

---

## How it works

1. App registers the device → receives an `apiKey`
2. While the screen is on, app POSTs a GPS ping every 2 seconds
3. Backend stores each ping; optionally reverse-geocodes via Google (cached)

---

## Backend

### Local (Node + MongoDB)

```bash
cd backend
cp ../.env.example .env
npm install
npm start
```

Runs on `http://localhost:8080`.

---

### Docker

```bash
git clone <repo-url>
cd tracker-service
cp .env.example .env
docker compose up -d
```

Check logs:
```bash
docker compose logs -f
```

Stop: `docker compose down`  
Stop + wipe data: `docker compose down -v`

---

### Deploy to a server

```bash
ssh user@your-server
git clone <repo-url>
cd tracker-service
cp .env.example .env
docker compose up -d
```

Backend available at `http://your-server:8080`.

**HTTPS (required for iOS):** put a reverse proxy in front of port 8080.

Caddy example:
```
tracker.example.com {
    reverse_proxy localhost:8080
}
```

After updates:
```bash
git pull && docker compose up -d --build
```

---

## Environment Variables

Copy `.env.example` to `.env` in the project root.

| Variable         | Default                         | Description                          |
|------------------|---------------------------------|--------------------------------------|
| `PORT`           | `8080`                          | HTTP port                            |
| `MONGO_URI`      | `mongodb://mongo:27017/tracker` | MongoDB connection string            |
| `LOG_LEVEL`      | `info`                          | `error` / `warn` / `info` / `debug`  |
| `GOOGLE_API_KEY` | *(empty)*                       | Enables reverse geocoding (optional) |

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

{ "deviceId": "phone-001", "name": "My Device", "type": "cyclist" }
```

Response includes `apiKey` — the app uses this for all subsequent pings.

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

Expo app (`mobile/`) — registers on first launch, tracks in the foreground.

### Dev (Expo Go)

```bash
cd mobile
npm install
npx expo start
```

Set backend URL in `mobile/.env`:
```env
EXPO_PUBLIC_API_BASE=http://<your-local-ip>:8080
```

| Target | URL |
|--------|-----|
| Android emulator | `http://10.0.2.2:8080` |
| iOS simulator | `http://localhost:8080` |
| Physical device (LAN) | `http://192.168.x.x:8080` |

---

### Build (EAS)

Needs an Expo account ([expo.dev](https://expo.dev)) and EAS CLI:

```bash
npm install -g eas-cli
eas login
```

Set the backend URL in [mobile/eas.json](mobile/eas.json):

```json
"preview": {
  "env": { "EXPO_PUBLIC_API_BASE": "http://YOUR_SERVER_IP:8080" },
  "distribution": "internal",
  "android": { "buildType": "apk" }
}
```

Build:

```bash
cd mobile
eas build --platform android --profile preview
```

First run will ask to create a Keystore — say yes. Takes ~10–20 min.

When done, EAS gives a download link. On Android, enable **"Install from unknown sources"** to install the `.apk`.

---

## Simulate GPS data

```bash
docker exec tracker-service_backend_1 node scripts/simulateApp.mjs
docker exec tracker-service_backend_1 node scripts/checkDb.mjs
```
