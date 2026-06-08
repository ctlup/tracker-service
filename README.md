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

### Docker (recommended)

```bash
git clone <repo-url>
cd tracker-service
cp .env.example .env
docker compose up -d --build
```

Check logs:
```bash
docker compose logs -f
```

Stop: `docker compose down`  
Stop + wipe all data: `docker compose down -v`

---

### Deploy to a server

On a public server, put nginx in front so the backend port is not directly exposed:

```yaml
# docker-compose.yml — remove ports from backend, add nginx
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend

  backend:
    # no ports: section — only reachable internally
```

An `nginx/nginx.conf` is included in the repo. For HTTPS with a domain (Caddy):

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

## Windows — Docker Desktop networking

Docker Desktop on Windows (WSL2) does not expose container ports to physical network interfaces automatically. If physical Android devices cannot reach the backend, add a Windows port proxy.

**Find the WSL2 IP:**
```bash
wsl ip addr show eth0 | grep "inet "
```

**Add the port proxy** (run PowerShell as Administrator — replace `YOUR_PC_IP` and `WSL2_IP`):
```powershell
netsh interface portproxy add v4tov4 listenaddress=YOUR_PC_IP listenport=9090 connectaddress=WSL2_IP connectport=8080
netsh advfirewall firewall add rule name="Docker 9090" protocol=TCP dir=in localport=9090 action=allow profile=any
```

**Update the app** to use port 9090 in `mobile/eas.json` and `mobile/app.json`.

> The WSL2 IP changes every time Docker Desktop restarts — re-run the portproxy command with the new IP after each restart.

**Verify:**
```powershell
netsh interface portproxy show all
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

## Monitoring

**See registered devices:**
```bash
curl http://localhost:8080/devices
```

**Watch live GPS pings (real-time logs):**
```bash
docker logs -f tracker-service_backend_1
```

**Query MongoDB directly:**
```bash
# all devices (including apiKey)
docker exec -it tracker-service_mongo_1 mongosh tracker --eval "db.devices.find().pretty()"

# location history for a device
docker exec -it tracker-service_mongo_1 mongosh tracker --eval "db.locations.find({deviceId:'DEVICE_ID'}).sort({timestamp:-1}).limit(20).pretty()"

# ping count per device
docker exec -it tracker-service_mongo_1 mongosh tracker --eval "db.locations.aggregate([{'\$group':{_id:'\$deviceId',count:{'\$sum':1}}}]).pretty()"
```

---

## Mobile App

Expo app (`mobile/`) — registers on first launch, tracks in the foreground. The backend URL is baked into the APK at build time — no config needed on the phone.

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
| Physical device (same LAN) | `http://<your-pc-ip>:8080` |
| Physical device (Windows Docker) | `http://<your-pc-ip>:9090` |

---

### Build (EAS) — Android APK

Needs an Expo account ([expo.dev](https://expo.dev)) and EAS CLI:

```bash
npm install -g eas-cli
eas login
```

Set the backend URL in [mobile/eas.json](mobile/eas.json):

```json
"preview": {
  "distribution": "internal",
  "env": { "EXPO_PUBLIC_API_BASE": "http://YOUR_SERVER_IP:8080" },
  "android": { "buildType": "apk" }
}
```

Also update `mobile/app.json` → `extra.apiBase` to the same URL.

Build:

```bash
cd mobile
eas build --platform android --profile preview
```

First run will ask to create a Keystore — say yes. Takes ~10–20 min.

When done, EAS gives a download link. Open it on the phone's browser and install. Enable **"Install from unknown sources"** on Android if prompted.

---

## Simulate GPS data

```bash
docker exec tracker-service_backend_1 node scripts/simulateApp.mjs
docker exec tracker-service_backend_1 node scripts/checkDb.mjs
```
