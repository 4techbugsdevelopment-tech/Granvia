# Login Process Change

## Purpose

The public website now opens the Super Admin login directly. Other users continue to use the Android universal app. The previous multi-login portal page has been retained at a separate route; no portal, login flow, or application page was deleted.

## Route changes

| Path | Current behavior |
| --- | --- |
| `/` | Opens the Super Admin login directly. If a Super Admin session already exists, it opens the Super Admin dashboard. |
| `/home-1` | Backup/retained location of the former main multi-login landing page containing all portal choices. |
| `/admin` | Retained legacy Super Admin route, including its existing splash-to-login flow. |
| `/app` | Universal Android login/application for Associates, Employers, Sales Executives, and Sub Admins. |
| `/guard` | Retained Associate portal. |
| `/employer` | Retained Employer portal. |
| `/sales` | Retained Sales Executive portal. |
| `/sub-admin` | Retained Sub Admin portal. |

The packaged Android WebView behavior is unchanged: when it boots at `/`, it is routed to the universal app instead of the website Super Admin login.

## Login screen changes

- Removed the `Main landing page` navigation link from the Super Admin login screen.
- Removed the `Main landing page` navigation link from the universal login screen.
- Removed only the unused callback props and arrow icons associated with those two links.
- Other portal login screens and their source code remain available.

## Terminology change

- User-facing references to `Partner`, `Service Partner`, and `Guard` now use `Associate`.
- `PARTNER APP` and `GUARD APP` now display as `ASSOCIATE APP`.
- The Android application display name is now `Granvia Associate`.
- Internal compatibility identifiers are intentionally unchanged, including the `guard` role value, `/guard` API and frontend routes, database fields, package name, and source filenames.

## Source changes

- `frontend/src/App.tsx`
  - Maps `/home-1` to the retained multi-login landing page.
  - Maps `/` and unmatched website paths to the Super Admin flow.
  - Starts unauthenticated website visitors at the Super Admin login without the splash screen.
  - Keeps `/admin` as the legacy splash-to-login route.
  - Preserves the Android WebView boot override.
- `frontend/src/web-admin/LoginScreen.tsx`
  - Removes the landing-page link and its now-unused callback.
- `frontend/src/universal-mobile/UniversalLogin.tsx`
  - Removes the landing-page link and its now-unused callback.
- `frontend/src/universal-mobile/UniversalMobileApp.tsx`
  - Removes the now-unused exit callback passed to the universal login.

## Expected deployment result

After this frontend build is deployed, opening `granvia.llc` at the domain root (`https://granvia.llc/`) displays the Super Admin login. The former multi-login page remains accessible at `https://granvia.llc/home-1`.
