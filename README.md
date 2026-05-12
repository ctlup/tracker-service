# Tracker Service

A GPS tracking backend for mobile devices (cyclists, cars, scooters). Devices register once, then POST location pings continuously from the background. All pings are stored in MongoDB and queryable via a history endpoint.

---
**Data flow:**

1. Mobile app registers the device on first launch → receives an `apiKey`
2. App stores `apiKey` in secure storage
3. Background task sends a GPS ping every ~2 seconds to `POST /location` using the `apiKey`
4. Backend optionally enriches each ping with city/country via Google Geocoding (cached, ~100m grid)
5. All pings are stored in MongoDB with a compound index on `(deviceId, timestamp)`

---

## Project Structure

```
tracker-service/
├── backend/
│   ├── src/
│   │   ├── index.mjs                  # Express bootstrap
│   │   ├── db.mjs                     # MongoDB connection
│   │   ├── logger.mjs                 # Winston logger
│   │   ├── controllers/
│   │   │   ├── deviceController.mjs   # Register + list devices
│   │   │   └── locationController.mjs # Record ping + history
│   │   ├── middleware/
│   │   │   └── apiKey.mjs             # x-api-key auth middleware
│   │   ├── models/
│   │   │   ├── Device.mjs             # Mongoose device schema
│   │   │   └── Location.mjs           # Mongoose location schema
│   │   ├── routes/
│   │   │   ├── devices.mjs
│   │   │   └── locations.mjs
│   │   └── services/
│   │       └── geocodingService.mjs   # Google Geocoding (optional, cached)
│   ├── scripts/
│   │   ├── simulateApp.mjs            # Simulates GPS pings for testing
│   │   └── checkDb.mjs                # Prints DB contents to terminal
│   ├── Dockerfile
│   └── package.json
├── mobile/
│   ├── app/
│   │   ├── _layout.jsx                # Expo Router root layout
│   │   ├── index.jsx                  # Registration screen
│   │   └── tracking.jsx               # Live tracking screen
│   ├── components/
│   │   └── RegisterForm.jsx           # Name + type form
│   ├── services/
│   │   ├── api.js                     # All HTTP calls to backend
│   │   ├── locationTask.js            # Background GPS task (expo-task-manager)
│   │   └── storage.js                 # Secure storage wrapper
│   └── app.json                       # Expo config (apiBase URL goes here)
├── docker-compose.yml
└── .env.example
```

---

## Quick Start (Docker)

**Requirements:** [Docker Desktop](https://www.docker.com/products/docker-desktop)

```bash
git clone <repo-url>
cd tracker-service
docker compose up -d
```

Verify containers are running:

```bash
docker compose logs -f
```

Expected output:

```
tracker-service_mongo_1    | Waiting for connections on port 27017
tracker-service_backend_1  | [info] MongoDB connected
tracker-service_backend_1  | [info] Tracker service listening on port 8080
```

Press `Ctrl+C` to stop following logs. Containers keep running in the background.

**Stop containers:**
```bash
docker compose down
```

**Stop and wipe all data:**
```bash
docker compose down -v
```

---

## Environment Variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

| Variable          | Default                         | Description                                    |
|-------------------|---------------------------------|------------------------------------------------|
| `PORT`            | `8080`                          | HTTP port the backend listens on               |
| `MONGO_URI`       | `mongodb://mongo:27017/tracker` | MongoDB connection string                      |
| `LOG_LEVEL`       | `info`                          | Winston log level (error/warn/info/debug)      |
| `GOOGLE_API_KEY`  | *(empty)*                       | Google Geocoding API key — optional, see below |

### Google Geocoding (optional)

If `GOOGLE_API_KEY` is set, every GPS ping is reverse-geocoded to get city and country. Results are cached in-memory (~100m grid, max 5000 entries) so a stationary device does not keep calling the API.

If the key is missing or the API call fails, the ping is still recorded — `city` and `country` will be `null`.

---

## API Reference

### Health

#### `GET /health`

Returns `200 OK` if the service is running.

```json
{ "ok": true }
```

---

### Devices

#### `POST /devices/register`

Register a new device. If the same `deviceId` is sent again (e.g. after app reinstall), returns the existing record and its original `apiKey`.

**Request body:**

```json
{
  "deviceId": "phone-001",
  "name": "Anna's Bike",
  "type": "cyclist"
}
```

| Field      | Type   | Required | Values                            |
|------------|--------|----------|-----------------------------------|
| `deviceId` | string | yes      | Any unique string                 |
| `name`     | string | yes      | Human-readable label              |
| `type`     | string | yes      | `cyclist` `car` `scooter`         |

**Response `201 Created`:**

```json
{
  "deviceId": "phone-001",
  "name": "Anna's Bike",
  "type": "cyclist",
  "apiKey": "3f2a1b...c9d8e7",
  "createdAt": "2026-05-06T18:00:00.000Z"
}
```

> Save the `apiKey` — it is required for all subsequent GPS pings.

---

#### `GET /devices`

List all registered devices. API keys are **not** included in the response.

**Response `200 OK`:**

```json
[
  {
    "_id": "...",
    "deviceId": "phone-001",
    "name": "Anna's Bike",
    "type": "cyclist",
    "createdAt": "2026-05-06T18:00:00.000Z"
  }
]
```

---

### Location

#### `POST /location`

Record a GPS ping. Requires the `x-api-key` header issued at registration.

**Headers:**

| Header         | Value                              |
|----------------|------------------------------------|
| `x-api-key`    | API key from `/devices/register`   |
| `Content-Type` | `application/json`                 |

**Request body:**

```json
{
  "lat": 41.8902,
  "lng": 12.4922,
  "speed": 5.2,
  "timestamp": "2026-05-06T12:00:00.000Z"
}
```

| Field       | Type   | Required | Description                          |
|-------------|--------|----------|--------------------------------------|
| `lat`       | number | yes      | Latitude (-90 to 90)                 |
| `lng`       | number | yes      | Longitude (-180 to 180)              |
| `speed`     | number | no       | Speed in m/s (defaults to 0)         |
| `timestamp` | string | no       | ISO 8601 — defaults to server time   |

**Response `201 Created`:**

```json
{
  "ok": true,
  "id": "664abc...123",
  "timestamp": "2026-05-06T12:00:00.000Z",
  "city": "Rome",
  "country": "Italy"
}
```

**Error responses:**

| Status | Reason                         |
|--------|--------------------------------|
| `400`  | Missing or invalid lat/lng     |
| `401`  | Missing or invalid `x-api-key` |

---

#### `GET /location/:deviceId/history`

Fetch GPS history for a device, newest first.

**Query parameters:**

| Param   | Default | Max     | Description               |
|---------|---------|---------|---------------------------|
| `limit` | `1000`  | `10000` | Number of pings to return |

**Example:**

```
GET /location/phone-001/history?limit=50
```

**Response `200 OK`:**

```json
{
  "deviceId": "phone-001",
  "count": 2,
  "locations": [
    {
      "_id": "...",
      "deviceId": "phone-001",
      "lat": 41.8903,
      "lng": 12.4925,
      "speed": 5.4,
      "city": "Rome",
      "country": "Italy",
      "timestamp": "2026-05-06T12:00:05.000Z"
    },
    {
      "_id": "...",
      "deviceId": "phone-001",
      "lat": 41.8902,
      "lng": 12.4922,
      "speed": 5.2,
      "city": "Rome",
      "country": "Italy",
      "timestamp": "2026-05-06T12:00:00.000Z"
    }
  ]
}
```

---

## Testing with Postman

Run these requests in order. After step 2, copy the `apiKey` from the response and use it in steps 3+.

### 1. Health check

```
GET http://localhost:8080/health
```

Expected: `{"ok":true}`

---

### 2. Register a device

```
POST http://localhost:8080/devices/register
Content-Type: application/json

{
  "deviceId": "test-phone-001",
  "name": "Test Phone",
  "type": "cyclist"
}
```

Expected: `201` with an `apiKey` field — **copy this value**.

---

### 3. Send a GPS ping

```
POST http://localhost:8080/location
Content-Type: application/json
x-api-key: <paste apiKey here>

{
  "lat": 41.8902,
  "lng": 12.4922,
  "speed": 5.2
}
```

Expected: `{"ok":true,"id":"...","timestamp":"...","city":null,"country":null}`

---

### 4. Fetch history

```
GET http://localhost:8080/location/test-phone-001/history
```

Expected: JSON with `count` and `locations` array.

---

### 5. List all devices

```
GET http://localhost:8080/devices
```

Expected: Array of registered devices (no API keys exposed).

---

### 6. Error cases

**Missing API key → 401:**
```
POST http://localhost:8080/location
Content-Type: application/json

{ "lat": 41.8902, "lng": 12.4922 }
```

**Wrong API key → 401:**
```
POST http://localhost:8080/location
Content-Type: application/json
x-api-key: not-a-real-key

{ "lat": 41.8902, "lng": 12.4922 }
```

**Invalid coordinates → 400:**
```
POST http://localhost:8080/location
Content-Type: application/json
x-api-key: <valid key>

{ "lat": 999, "lng": 12.4922 }
```

---

### VS Code REST Client (alternative to Postman)

Install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension, then open [`backend/test.http`](backend/test.http). Click **Send Request** above each block — the `apiKey` is captured automatically from the register response.

---

## Simulate GPS data

Run this inside the backend container to generate a stream of fake pings:

```bash
docker exec tracker-service_backend_1 node scripts/simulateApp.mjs
```

Press `Ctrl+C` to stop. Check what was stored:

```bash
docker exec tracker-service_backend_1 node scripts/checkDb.mjs
```

---

## Mobile App

The Expo mobile app (`mobile/`) handles registration on first launch, then runs a background GPS task that POSTs pings to the backend even when the screen is off.

### Prerequisites

- Node.js 20+ — [nodejs.org](https://nodejs.org)
- EAS CLI: `npm install -g eas-cli`
- Expo account — [expo.dev](https://expo.dev) (free)
- Backend deployed at a **public HTTPS URL** (see Deploy section)

### 1. Set the backend URL

Open `mobile/app.json` and replace:

```json
"apiBase": "REPLACE_WITH_YOUR_BACKEND_URL"
```

with your server URL:

```json
"apiBase": "https://tracker.yourcompany.com"
```

> **This URL is baked into the APK at build time and cannot be changed afterwards without rebuilding.**

### 2. URL reference for different targets

| Target                | URL to use in app.json            |
|-----------------------|-----------------------------------|
| Android emulator      | `http://10.0.2.2:8080`            |
| iOS simulator         | `http://localhost:8080`           |
| Physical device (LAN) | `http://192.168.x.x:8080`         |
| Production            | `https://tracker.yourcompany.com` |

### 3. Build APK

```bash
cd mobile
npm install
eas login
eas init          # first time only — generates projectId
eas build --platform android --profile preview
```

On first build it will ask to create a Keystore — say **Yes** (Expo manages it). Build takes ~10-20 minutes in the cloud queue.

Download the `.apk` from the link printed in the terminal or from [expo.dev](https://expo.dev/accounts/[user]/projects/tracker-mobile/builds).

### 4. Install on phones

Send the `.apk` to each user via email, WhatsApp, USB, or a download link.

On Android: enable **"Install from unknown sources"** if prompted, then tap the file and tap **Install**.

### 5. Location permission (critical)

On first launch the app will ask for location permission. Users **must** select:

- Android: **Allow all the time**
- iOS: **Always**

Selecting "Only while using" will stop background tracking.

---

## Deploy to Production

### Server with Docker (recommended)

```bash
ssh user@your-server
git clone <repo-url>
cd tracker-service
cp .env.example .env
nano .env          # add GOOGLE_API_KEY if you have one
docker compose up -d
```

The backend is now reachable at `http://your-server:8080`.

### HTTPS (required for iOS)

iOS blocks plain HTTP by default. Set up a reverse proxy with a TLS certificate in front of port 8080:

- **Caddy** (easiest — handles certificates automatically):
  ```
  tracker.yourcompany.com {
      reverse_proxy localhost:8080
  }
  ```
- **nginx** with Let's Encrypt / Certbot
- **Traefik** with Docker labels

### Update backend after code changes

```bash
git pull
docker compose down
docker compose up -d --build
```

---

## Known Limitations

| Limitation | Notes |
|---|---|
| History endpoint is unauthenticated | Intentional — designed for internal read-only dashboard use. Add auth middleware if exposing publicly. |
| No rate limiting | Add `express-rate-limit` before going to high-traffic production. |
| CORS is open (`*`) | Fine for mobile apps. Restrict origins if adding a web frontend. |
| Geocoding cache resets on restart | Acceptable for this use case. Use Redis for persistence across restarts. |

---

## Troubleshooting

### Phone not connecting to backend

1. Open `https://tracker.yourcompany.com/health` in a browser → should return `{"ok":true}`
2. If HTTPS: verify the certificate is valid (no browser warning — if the browser shows one, the app won't connect either)
3. Verify the URL in `app.json` matches exactly (no trailing slash)
4. Check the phone has internet access

### Background tracking stopped

- **Android**: Battery saver may have killed the app. Go to Settings → Battery → find the Tracker app → disable optimization
- **iOS**: Location permission may have changed to "While using". Settings → Privacy → Location → Tracker → set to **Always**

### Docker containers won't start

```bash
docker compose logs backend
docker compose logs mongo
```

### EAS build failed

Check the build log at expo.dev. Common causes:

- Wrong version in `package.json`
- Missing Apple credentials (iOS only)
- `bundleIdentifier` conflict in `app.json`
