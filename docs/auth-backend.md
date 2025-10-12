# Miko Auth Backend Overview

This document details endpoints, expected payloads, and flows for Google OAuth, Wallet (Aptos), and Email OTP + Corporate onboarding.

## Base
API Origin: `http://localhost:5001`
All responses are JSON.

## Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/health | Liveness check |
| GET | /api/auth/google | Initiate Google OAuth |
| GET | /api/auth/google/callback | OAuth callback (redirects with token or signup params) |
| GET | /api/auth/username/check?u= | Username availability check |
| GET | /api/auth/me | Current authenticated user + methods (JWT) |
| POST | /api/auth/otp/request | Request OTP (email) |
| POST | /api/auth/otp/verify | Verify OTP + login/signup decision |
| GET | /api/auth/wallet/challenge | Obtain login message + nonce |
| POST | /api/auth/wallet/verify | Verify signature and login/signup decision |
| POST | /api/auth/link/wallet | Link an additional wallet (JWT) |
| POST | /api/auth/link/email/request | Begin email link (OTP send) (JWT) |
| POST | /api/auth/link/email/verify | Complete email link via OTP (JWT) |
| GET | /api/auth/methods | Methods summary only (JWT) |
| POST | /api/auth/logout | Stateless logout placeholder (JWT) |
| GET | /api/auth/link/google/init | Initiate Google linking (JWT) |
| GET | /api/auth/link/google/callback | Google linking callback |
| POST | /api/auth/signup | Persist new user post-verification |
| POST | /api/profile/corporate | Submit corporate profile (JWT) |

## Signup Decision Flow
1. User proves control of credential (Google / Email+OTP / Wallet signature).
2. Server checks for user record:
   * Exists -> issue JWT (login).
   * Absent -> return `needsSignup:true` with `prefill` data.
3. Frontend collects remaining fields (username, role, corporate form if needed) and calls `/api/auth/signup` then `/api/profile/corporate` if role is CORPORATE.

## Payloads
### POST /api/auth/otp/request
```json
{ "email": "user@example.com" }
```
Response: `{ "success": true }`

### POST /api/auth/otp/verify
```json
{ "email": "user@example.com", "code": "123456" }
```
Responses (examples):
Existing user login:
```json
{
  "login": true,
  "token": "<JWT>",
  "user": { "id": "...", "role": "INDIVIDUAL", "username": "eco_builder" },
  "methods": { "google": false, "passwordless": true, "wallets": [] }
}
```
Needs signup:
```json
{ "login": false, "needsSignup": true, "prefill": { "email": "user@example.com" } }
```

### GET /api/auth/wallet/challenge
Response:
```json
{ "nonce": "mb3cix", "message": "Miko Auth :: mb3cix" }
```

### POST /api/auth/wallet/verify
```json
{
  "address": "0x...",
  "publicKey": "0x...",
  "signature": "0x...",
  "message": "Miko Auth :: mb3cix",
  "network": "aptos"
}
```
Responses mirror OTP verify (login vs needsSignup with `prefill.wallet`). Login response adds `existingUser:true` and `methods` summary.

### POST /api/auth/signup
```json
{
  "username": "eco_builder",
  "role": "INDIVIDUAL",
  "method": "otp",
  "email": "user@example.com"
}
```
Alternative google:
```json
{ "username": "eco_builder", "role": "INDIVIDUAL", "method": "google", "googleId": "123", "email": "user@example.com" }
```
Alternative wallet:
```json
{ "username": "eco_builder", "role": "CORPORATE", "method": "wallet", "wallet": { "address":"0x..", "publicKey":"0x..", "network":"aptos" } }
```
Responses:
Individual:
```json
{
  "created": true,
  "token": "<JWT>",
  "user": { "id": "...", "role": "INDIVIDUAL", "username": "eco_builder" },
  "methods": { "google": true, "passwordless": false, "wallets": [] }
}
```
Corporate:
```json
{
  "created": true,
  "corporatePending": true,
  "userId": "...",
  "methods": { "google": false, "passwordless": false, "wallets": [{"address":"0x..","network":"aptos"}] }
}
```

### GET /api/auth/me (JWT)
Returns the current user profile + linked methods.

### POST /api/auth/link/wallet (JWT)
```json
{ "address": "0x..", "network": "aptos", "publicKey": "0x..." }
```
Response:
```json
{ "linked": true, "methods": { "google": true, "passwordless": true, "wallets": [{"address":"0x..","network":"aptos"}] } }
```

### Link Email Flow (JWT)
1. `POST /api/auth/link/email/request` `{ "email": "user@example.com" }`
2. `POST /api/auth/link/email/verify` `{ "email": "user@example.com", "code": "123456" }`
Both ensure the email is not already used by another user.

### POST /api/profile/corporate (JWT)
Authorization: `Bearer <JWT>` (only after signup if corporate)
```json
{ "companyName": "Eco Corp", "cin": "CINCODE", "gstin": "GSTINCODE" }
```
Response:
```json
{ "updated": true, "corporateProfile": { "companyName": "Eco Corp", "cin": "CINCODE", "gstin": "GSTINCODE", "verificationStatus": "PENDING" } }
```

## Google OAuth Redirect Handling
If existing user: redirects to `/auth/success?token=<JWT>`.
If new user: redirects to `/auth/onboard?authMethod=google&googleId=...&email=...`.
Frontend should parse query params and proceed directly to username + role stage.

## Environment Variables
See `.env.example` in `backend/` for required configuration.

### MongoDB
- `DATABASE_URL` – Atlas connection string (`mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true...`).
- `DATABASE_NAME` – Logical database inside the cluster (e.g., `miko`). If omitted, the database encoded in the URI is used.

There is no bundled MongoDB container anymore; ensure your Atlas IP access list allows the environment where the backend is running.

### Email (Resend Only)
Set the following (see `.env.example`):
```
RESEND_API_KEY=your_resend_key
EMAIL_FROM=noreply@yourverifieddomain.com
```
`EMAIL_FROM` must belong to a verified domain in your Resend dashboard (Domains section). Free sandbox domains (`onboarding@resend.dev`) are fine for quick tests but use your own domain for production.

Steps:
1. Add & verify sending domain (publish DKIM + return-path records).
2. Generate an API key (Full Access for dev, restrict scope later if needed).
3. Set environment variables & restart backend.
4. Trigger `POST /api/auth/otp/request` and confirm a 202/200 response and email receipt.

If sending fails you'll see `[mail][error]` logs; ensure domain is verified and key is valid.

## Security Notes / Next Steps
* Replace in-memory OTP store with Redis (attach nonce to prevent replay).
* Implement wallet challenge persistence & expiration.
* Add rate limiting (failed OTP / wallet attempts & link attempts).
* Add CSRF protection if using cookies for session tokens.
* Add refresh token rotation if longer sessions needed.
* Add Google OAuth state parameter & nonce for anti-CSRF.

## Frontend Helper Usage
```ts
import { requestOtp, verifyOtp, fetchWalletChallenge, verifyWalletSignature, signup, submitCorporate, googleAuthUrl } from '@/lib/authClient';
```

## Corporate Verification Lifecycle
`PENDING` -> manual or automated review process -> update to `VERIFIED` or `REJECTED` via an admin route (future scope).

## Methods Summary Object
Returned on login/signup/link endpoints:
```json
{
  "google": true,
  "passwordless": true,
  "wallets": [ { "address": "0x...", "network": "aptos" } ]
}
```

## Acceptance Criteria Mapping
| Criterion | Implemented Via |
|-----------|-----------------|
| Google signup -> individual login | `/api/auth/google/*` + `/api/auth/signup` (method=google) |
| Wallet-only signup -> login | `/api/auth/wallet/verify` + `/api/auth/signup` (method=wallet) |
| Prevent duplicate wallet for new signup when already linked | Duplicate checks in `/api/auth/signup` and `/api/auth/wallet/verify` |
| Login with any linked method | All verify routes issue JWT using same stored `authMethods` |
| Corporate flow with verification fields | `/api/auth/signup` (role=CORPORATE includes company fields) or `/api/profile/corporate` |
| Single record stores all methods | Schema `authMethods` aggregation + linking endpoints |
| Redirect after success | Backend issues token / redirect query params; frontend performs final navigation |
| Prevent duplicate signup if wallet method supplies existing email | Guard in `/api/auth/signup` wallet branch (EMAIL conflict => instruct login) |

