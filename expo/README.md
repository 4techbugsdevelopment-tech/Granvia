# Granvia Partner — Expo APK wrapper

A thin native shell that packages the **universal mobile app**
(`frontend/src/universal-mobile`) as an Android APK. It loads the deployed web
app's `/app` route inside a full-screen WebView.

One login, every role except Super Admin: Service Partner (guard), Employer,
Sales Executive and Sub Admin. The web app detects APK mode
(`window.__GRANVIA_APK__`, set here before the page loads) and boots straight
into the universal app in full-screen.

## How it fits together

```
frontend/src/universal-mobile/   ← the actual app (React web, reused pages)
        │  built + deployed (Netlify) → https://<site>/app
        ▼
expo/App.tsx  →  <WebView source={/app} injected __GRANVIA_APK__ />  →  APK
```

Because it is a WebView wrapper, **no screens are rewritten**: every role reuses
its existing pages, made responsive, with a bottom nav + top-left master-entry
drawer (see `MobileChrome.tsx`).

## Configure the URL

Set the URL the APK loads in `app.json` → `expo.extra.appUrl`:

- Production (current): `https://granvia.llc/app`
- Local device testing: `http://<your-LAN-IP>:5199/app` (run `npm run dev` in
  `frontend/` first; phone and PC must be on the same network — never `localhost`)

You can override the configured URL without editing `app.json`:

```powershell
$env:EXPO_PUBLIC_APP_URL='http://localhost:5173/app'
npm start
```

`localhost` works in a desktop Expo/WebView preview. For an Android emulator,
use `http://10.0.2.2:5173/app`, or run `adb reverse tcp:5173 tcp:5173` first.
For a physical phone, use the PC's LAN IP. A release APK should use a deployed
HTTPS URL because a local Vite server is not bundled into this thin WebView APK.

The API endpoint is NOT set here — it is baked into the web build via
`frontend/.env.production` (`VITE_API_URL=https://aip.granvia.llc/api`). The
WebView page (`granvia.llc`) calls that API directly (cross-origin), so the
backend must allow the `https://granvia.llc` origin (set
`CORS_ORIGINS=https://granvia.llc`, or leave it unset to reflect any origin).

## Build the APK

Prerequisites: Node, `npm i -g eas-cli`, an Expo account (`eas login`).

```bash
cd expo
npm install
eas init            # once — creates the EAS project, fills extra.eas.projectId
npm run build:apk   # cloud build → downloadable .apk (preview profile)
```

Local build alternative (needs Android SDK / JDK installed):

```bash
npm run build:apk:local
# or, to run on a connected device/emulator during development:
npm run android
```

The `preview` profile in `eas.json` produces an installable `.apk`; the
`production` profile produces an `.aab` for the Play Store.

## Notes
- Update `android.versionCode` (and `version`) in `app.json` for each release.
- Location/camera permissions are declared for radius job-search and document
  capture; the WebView passes them through to the web app.
- The Android hardware back button navigates WebView history (see `App.tsx`).
