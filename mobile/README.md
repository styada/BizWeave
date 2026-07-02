# Bizweave Mobile (Expo)

Chat-first companion app for the Bizweave operator. Reuses the web app's API
route handlers (no separate backend) and adds Expo push notifications.

## Setup

```bash
cd mobile
npm install
npm start           # then press i / a, or scan the QR with Expo Go
```

## Configuration

- `app.json` → `expo.extra.apiBaseUrl` — point at your deployed web app
  (e.g. `https://app.bizweave.site`). Defaults to `http://localhost:3000`.
- Push notifications require an EAS project id (`expo.extra.eas.projectId`) for
  standalone builds. In Expo Go on a physical device, a token is still issued.

## Architecture

- `src/api.ts` — thin client; captures the `bizweave_session` cookie at login
  (via `expo-secure-store`) and replays it as a `Cookie` header. Mirrors the web
  auth model, so no new auth surface is introduced.
- `src/push.ts` — requests permission, gets the Expo push token, and registers
  it with `POST /api/push/register`.
- `App.tsx` — three screens: Login → Business Picker → Operator Chat. Chat calls
  `POST /api/businesses/:id/chat`, the same operator used on web and by the
  SMS/WhatsApp/Telegram bridges.

## Parity

The chat screen has full feature parity with the web Operator Chat: the operator
classifies intent and can build sites, run ads, set up a receptionist, run
outreach, and dispatch deep tasks — all behind the same `guardAction` approvals.
