# BROKA Admin Android app

A dedicated, installable Android app for the BROKA Admin Control Center. The APK opens the existing hosted Next.js dashboard in a restricted Android WebView; the dashboard itself is unchanged.

## Architecture

- The wrapper lives in `android-wrapper/` as a minimal Kotlin Android project: one `MainActivity`, one `AdminApplication`, no native views, no Flutter, no React Native.
- The WebView loads `https://broka-admin-production.up.railway.app/` (configurable via the `brokaAdminDashboardUrl` property in `android-wrapper/gradle.properties`).
- Authentication stays exactly where it is today: the Next.js server-side session (HttpOnly `broka_admin_access` / `broka_admin_refresh` cookies), middleware validation and refresh, and the `/api/broka/[...path]` proxy. The APK does not receive tokens, does not inject credentials, and does not bypass any server-side check.
- The app is a thin display shell over the hosted dashboard, so every dashboard capability (login/logout, Service Communications lifecycle, worker diagnostics, dialogs, responsive layouts) comes from the real Next.js app and is verified against production behavior instead of being duplicated natively.

### Why a WebView wrapper does not replace Next.js

Rewriting the dashboard for Android would create a second admin implementation that has to track every security, contract, and backend-gap decision already encoded in this repository (allowlisted proxy, contract validation, fail-closed middleware). Rendering the actual hosted app keeps a single source of truth. The wrapper's only job is to present that app inside a hardened WebView.

## Application identity

- Application ID: `com.broka.admin` (distinct from the consumer app's `com.broka.app`).
- Display name: `BROKA Admin`.
- Version: `versionCode 1`, `versionName 1.0.0` (increment both together for upgrades).
- Min SDK 24 (Android 7.0+), target/compile SDK 35 (Android 15).

## Pinned toolchain

- Java 17 (Temurin in CI)
- Android Gradle Plugin 8.7.3
- Kotlin 2.0.21
- Gradle 8.10.2, pinned via `android-wrapper/gradle/wrapper/gradle-wrapper.properties` with `distributionSha256Sum=31c55713e40233a8303827ceb42ca48a47267a0ad4bab9177123121e71524c26`. The wrapper verifies the distribution checksum before downloading.
- No dynamic (`+`) version declarations anywhere.

## Local build

Prerequisites: JDK 17 and an Android SDK with `platforms;android-35` and `build-tools;35.0.0`. Set `sdk.dir` in `android-wrapper/local.properties` (this file is gitignored) or export `ANDROID_HOME`.

```bash
cd android-wrapper
./gradlew :app:assembleDebug          # debug APK  -> app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:lintDebug              # Android lint
./gradlew :app:assembleRelease        # release APK; requires signing environment variables (below)
./gradlew --version                   # verifies the pinned Gradle distribution checksum
```

To point a local build at a non-production dashboard: `./gradlew :app:assembleDebug -PbrokaAdminDashboardUrl=https://<host>/` (HTTPS only; the app rejects other hosts).

## GitHub Actions APK workflow

`.github/workflows/build-admin-apk.yml` is manual-only (`workflow_dispatch`), main-branch only:

1. A `require-main` job fails immediately when dispatched from any branch other than `main`.
2. In `release` mode the dashboard pipeline (`pnpm test`, `typecheck`, `lint`, `build`) runs before packaging, mirroring `ci.yml`. Debug mode is explicitly a debug-only build and skips that gate; it is for early device testing only.
3. The release job decodes the signing keystore into `$RUNNER_TEMP/broka-admin-signing` from `BROKA_ADMIN_KEYSTORE_B64`, builds with `assembleRelease`, verifies the APK (`aapt2` application ID check + `apksigner verify`), deletes the temporary signing files in an `always()` step, and uploads the artifact as `broka-admin.apk` with 30-day retention. Gradle wrapper verification and Gradle/dependency caching (keyed on the checked-in Gradle and dependency configuration files) are enabled via `setup-java`'s Gradle cache.

To run it: repository **Actions → BROKA Admin Android APK → Run workflow**, choose branch `main` and `build_mode` (`debug` or `release`). Download `broka-admin.apk` from the run's **Artifacts** section, unzip it locally if needed, then install it on the device (enable "Install unknown apps" for your file manager or use `adb install broka-admin.apk`).

The workflow never deploys anything to Railway and does not publish to releases.

## Signing

Two distinct modes:

- **Debug (early device testing):** signed with AGP's auto-generated debug keystore on the CI runner. Debug keys change between runs and must never be used as a release key. Installing a new debug build over an old one may require uninstalling the previous debug APK first.
- **Release (installable distribution):** signed with a dedicated, persistent BROKA Admin keystore supplied at build time from repository secrets.

Required repository secrets:

| Secret | Contents |
| --- | --- |
| `BROKA_ADMIN_KEYSTORE_B64` | The release keystore, base64-encoded (`base64 -w 0 broka-admin.keystore`) |
| `BROKA_ADMIN_KEYSTORE_PASSWORD` | Keystore password |
| `BROKA_ADMIN_KEY_ALIAS` | Key alias inside the keystore |
| `BROKA_ADMIN_KEY_PASSWORD` | Key password |

Generate the keystore outside the repository and never commit it:

```bash
keytool -genkeypair -v \
  -keystore broka-admin.keystore \
  -alias broka-admin \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass '<one shared password>' \
  -dname 'CN=BROKA Admin, O=BROKA, C=KE'
```

Use the same value for `BROKA_ADMIN_KEYSTORE_PASSWORD` and `BROKA_ADMIN_KEY_PASSWORD`: modern `keytool` writes PKCS12 keystores where the key is encrypted with the keystore password, and Gradle decrypts the key with `BROKA_ADMIN_KEY_PASSWORD`; mismatched values fail with a padding error.

### Signing-key continuity

Android only lets a signed installed app be upgraded (replaced) by an APK whose certificate matches. If the release keystore changes, users must uninstall first and lose nothing (session cookies are the only device-local state), but the update is genuinely a fresh install. Keep the keystore exported and its passwords in the secrets manager; rotating credentials is covered below.

### Safe credential handling

- The workflow decodes secret values into `$RUNNER_TEMP` only, never prints them, and deletes the directory in an `always()` cleanup step.
- No keystore, password, or private key is committed to the repository, written into an artifact, or logged.
- If signing is compromised, rotate per section "Signing-key rotation".

## Security restrictions in the wrapper

- Navigation is allowed only to `https` requests on the exact approved dashboard host; any other URL is either opened in the user's browser via a deliberate external-browser intent (after scheme validation) or blocked with a toast. `javascript:`, `file:`, `content:`, `intent:`, `blob:`, and every other non-http(s) scheme is blocked.
- SSL/TLS errors are always rejected (`handler.cancel()`); there is no path that calls `proceed()`, and certificate validation is the platform default. Cleartext HTTP is denied by both the manifest (`usesCleartextTraffic="false"`) and the WebView (`MIXED_CONTENT_NEVER_ALLOW`).
- File access, content-provider access, and file-URL cross-origin access are all disabled; no `JavaScriptInterface` is exposed, so the dashboard cannot reach native facilities.
- Safe Browsing is enabled (API 26+), and WebView remote debugging is only on in debug builds (`AdminApplication` sets `setWebContentsDebuggingEnabled(BuildConfig.DEBUG)`).
- Third-party cookies are disabled; first-party HTTPS cookies on the dashboard host are left to the platform `CookieManager` (needed by the existing session flow) and are never read, logged, or copied anywhere by the wrapper.
- Backups are disabled (`allowBackup="false"` with explicit empty `fullBackupContent`/`dataExtractionRules` exclusions) so session cookies are never exported to cloud backups or device transfers.
- The only permissions in the manifest are `INTERNET` and `ACCESS_NETWORK_STATE`.

## Network access and why Railway remains

The app needs `INTERNET` because the dashboard is a hosted application: pages, session validation, and all admin API access happen server-side against the deployed Next.js app, and the server proxy talks to the BROKA FastAPI API. If the dashboard host is unreachable, the app shows a plain error screen with a retry button; it never fakes an offline dashboard.

Railway continues to host the dashboard as it does today. Moving hosting is a separate, explicitly scoped task; the APK is decoupled from hosting details because the dashboard URL is one build property (`brokaAdminDashboardUrl`).

## Testing a build on a device

Install the APK, then verify at minimum:

1. Fresh install launches to the hosted dashboard (login page when signed out).
2. Login, logout (server-side `POST /auth/token/revoke` run by the dashboard), and re-login work.
3. Closing and reopening the app keeps the session (WebView first-party cookies); an expired session returns to the login page.
4. Back navigation moves through the WebView history and exits at the end.
5. Airplane mode shows the recoverable error screen; retry reconnects.
6. Links to other sites open in the device browser, not inside the trusted WebView.

Production host testing must stay read-only (dashboards, filters, previews); mutation workflows (drafts, scheduling, retries) should be tested against a seed non-production environment when available. Do not trigger real notifications during testing.

## Known limitations

- File uploads/downloads inside the dashboard are not supported by the wrapper (a toast explains this; the dashboard currently offers neither).
- `mailto:`/`tel:` links are deliberately blocked.
- Android WebView certificate pinning is not used; normal platform TLS validation applies (Railway-hosted certificates are managed by Railway).
- The error screen surfaces generic cause text (network/HTTP/TLS) but does not auto-retry.

## Signing-key rotation

1. With the app closed everywhere, generate a new keystore (or replace the key inside it) following the commands above.
2. Re-encode and update `BROKA_ADMIN_KEYSTORE_B64` and password/alias secrets; keep values only in GitHub secrets and the secret manager.
3. Publish the new build; because the certificate differs, existing installs cannot be upgraded in place — the new APK is effectively a fresh install, and the old install can be uninstalled afterwards. There is no user data loss beyond the WebView session.
4. Only then delete the compromised key/keystore material from the secret manager.
