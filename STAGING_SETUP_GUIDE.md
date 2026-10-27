# Smart Healthcare — Cloud Staging Environment Setup Guide

This guide describes how to provision, configure, and operate a dedicated, isolated cloud staging environment for Smart Healthcare on Render and Firebase with zero cost ($0.00/month).

---

## Architecture & Isolation Guarantee

The staging environment is strictly segregated from production across compute, data storage, and external integrations:

| Component | Production | Staging | Isolation Guarantee |
| :--- | :--- | :--- | :--- |
| **Backend Service** | `smart-health-backend-2idf.onrender.com` | `smart-health-backend-staging.onrender.com` | Separate Render web service instances |
| **Frontend Service** | `smart-health-rontend.onrender.com` | `smart-health-frontend-staging.onrender.com` | Separate Render static site instances |
| **Git Branch** | `main` | `production-readiness-remediation` | Branch isolation |
| **Database** | `smart-health-care-cd723` RTDB | `smart-health-care-staging` RTDB | Completely separate Firebase projects |
| **Authentication Secrets** | Production `APP_AUTH_SECRET` | Auto-generated Staging Secret | Cryptographically distinct HMAC keys |
| **CORS Policy** | Production origins only | Staging origins only | Cross-origin isolation |
| **Notification Services** | Configured for live alerts | Muted (`SIMULATED` / Unconfigured) | Zero real SMS or emails sent |
| **Cost** | Free Tier ($0/mo) | Free Tier ($0/mo) | No financial commitment |

---

## Step 1: Create Free Staging Firebase Project (Owner Action)

1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and enter `smart-health-care-staging` (or similar available name).
3. Disable Google Analytics (optional, to keep it lightweight) and click **Create Project**.
4. Confirm the project is on the **Spark plan** (Free, $0.00/month).

### 1.1 Enable Firebase Realtime Database
1. In the Firebase Console left menu, go to **Build** -> **Realtime Database**.
2. Click **Create Database**.
3. Choose the region (e.g. `Singapore (asia-southeast1)` or closest to your target).
4. Start in **Locked Mode** (security rules will be applied).
5. Copy the Database URL (e.g., `https://smart-health-care-staging-default-rtdb.asia-southeast1.firebasedatabase.app`).

### 1.2 Generate Service Account Credentials for Backend
1. Go to **Project Settings** (gear icon) -> **Service accounts**.
2. Click **Generate new private key**, then confirm.
3. Open the downloaded JSON file and convert it into a single-line string (minified JSON) for use in Render.

### 1.3 Register Web App for Frontend
1. In **Project Settings** -> **General**, scroll down to **Your apps** and click the Web icon (`</>`).
2. App nickname: `Smart Health Staging Web`.
3. Do not enable Firebase Hosting.
4. Copy the `firebaseConfig` keys (`apiKey`, `authDomain`, `projectId`, `appId`, etc.).

---

## Step 2: Deploy Staging Services via Render Blueprint (Owner Action)

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **Blueprints** -> **New Blueprint Instance**.
3. Connect the repository: `https://github.com/Harshshukla49/Smart_Health_Care.git`.
4. Blueprint path: Specify `render-staging.yaml`.
5. Branch: `production-readiness-remediation`.
6. Under Blueprint environment variables, provide:
   - For `smart-health-backend-staging`:
     - `FIREBASE_DATABASE_URL`: `https://smart-health-care-staging-default-rtdb.asia-southeast1.firebasedatabase.app/`
     - `FIREBASE_CREDENTIALS_JSON`: *(Paste the minified single-line JSON of your staging service account)*
   - For `smart-health-frontend-staging`:
     - `VITE_FIREBASE_API_KEY`: *(Staging Web API Key)*
     - `VITE_FIREBASE_AUTH_DOMAIN`: `smart-health-care-staging.firebaseapp.com`
     - `VITE_FIREBASE_PROJECT_ID`: `smart-health-care-staging`
     - `VITE_FIREBASE_APP_ID`: `1:...:web:...`
     - `VITE_FIREBASE_DATABASE_URL`: `https://smart-health-care-staging-default-rtdb.asia-southeast1.firebasedatabase.app`
7. Click **Apply**.
8. Both services will build and deploy on Render's Free tier ($0/mo).

---

## Step 3: Run Staging Smoke Tests

Once deployed, run smoke tests against the live staging endpoints:

1. **Backend Health Check:**
   ```bash
   curl -i https://smart-health-backend-staging.onrender.com/health
   ```
   *Expected response:* `HTTP/1.1 200 OK`, JSON payload `{"status": "ok", "service": "smart-health-backend", ...}`.

2. **Frontend Routing & Direct Navigation:**
   - Open `https://smart-health-frontend-staging.onrender.com/login` directly in browser.
   - Verify SPA route renders login screen without 404.
   - Reload page (F5) to verify `dist/404.html` and Render SPA rewrite rule properly serve `/login`.

3. **Synthetic Patient Flow:**
   - Log in using staging credentials.
   - Add a synthetic patient (`SYNTH-PAT-001`).
   - Verify vital readings, medical report generation, and simulated SOS alert logging.
   - Check Render logs to verify zero external SMS or emails are sent.
