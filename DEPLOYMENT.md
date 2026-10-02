# Granvia Deployment

## Local URLs

Run the Vite app:

```powershell
npm install
npm run dev
```

Open these direct portal URLs:

```text
Landing page: http://localhost:5173/
Admin panel: http://localhost:5173/admin
Guard app:   http://localhost:5173/guard
```

If Vite uses another port, keep the same paths. Example:

```text
Landing page: http://127.0.0.1:5174/
Admin panel: http://127.0.0.1:5174/admin
Guard app:   http://127.0.0.1:5174/guard
```

## Netlify

Use these settings:

```text
Build command: npm run build
Publish directory: dist
```

After deployment, use:

```text
Landing page: https://your-site.netlify.app/
Admin panel: https://your-site.netlify.app/admin
Guard app:   https://your-site.netlify.app/guard
```

The `public/_redirects` file is included so direct page refreshes work on Netlify.

## Expo APK For Guard App

This project is a Vite React web app. Expo builds Android apps from React Native code, so the fastest APK path is an Expo WebView wrapper that loads the Netlify guard URL.

Create the Expo wrapper:

```powershell
npx create-expo-app granvia-guard-apk --template blank-typescript
cd granvia-guard-apk
npx expo install react-native-webview
```

Replace `App.tsx` in the Expo project:

```tsx
import { SafeAreaView, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const GUARD_URL = 'https://your-site.netlify.app/guard';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: GUARD_URL }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
});
```

Create or update `eas.json` in the Expo project:

```json
{
  "cli": {
    "version": ">= 13.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

Build the APK:

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview
```

## Employment agreement download (backend)

The backend build packages `nodebackend/documents/Employment Agreement.docx` into `nodebackend/dist/documents`. Deploy the complete dist directory, including documents. From the backend directory, run `npm run build`, then restart the existing backend service using its configured process manager. No database migration is required for this packaging fix.

For a 404 on `GET /api/me/documents/employment-agreement?application_id=...`, inspect the authenticated response body:

- `Document file not found.`: the old deployment is missing the document template. Rebuild and deploy the backend including dist/documents.
- `Employment agreement not found.`: the application does not exist or its current status is not hired. Check the exact application ID and current status; a past notification does not establish current eligibility.
- A generic server/proxy 404: verify that the deployed backend includes the shared documents route and that /api reaches that backend.

Retest the same notification link while signed in as the owning employer or a super admin. Expect HTTP 200, a DOCX content type, and an attachment named Employment Agreement.docx. A missing template now returns 503 and logs the checked locations.

## Release / termination attachments (2026-10-02)

Apply `nodebackend/prisma/migrations/20261002120000_application_release_attachments/migration.sql` to SQL Server before deploying this backend. It adds the nullable `job_applications.release_attachments` column. Follow the existing controlled migration procedure; this checkout does not contain a complete initial database baseline. Regenerate Prisma Client, build and restart the API, then deploy the frontend build. Keep `storage/app/application-releases` on persistent storage alongside existing private document folders.

Employers can optionally submit up to five PDF/image files (10 MB each) with the release reason. Both parties can view them in application details. Associate links are regenerated through their scoped application API when clicked and use the existing signed download endpoint on https://aip.granvia.llc. Verify a real employer upload and the corresponding Associate view after deployment; local builds and mocked controller tests do not verify live database or browser behavior.
