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
| POST | /api/auth/otp/request | Request OTP (email) |
| POST | /api/auth/otp/verify | Verify OTP + login/signup decision |
| GET | /api/auth/wallet/challenge | Obtain login message + nonce |
| POST | /api/auth/wallet/verify | Verify signature and login/signup decision |
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
Responses:
Login:
```json
{ "login": true, "token": "<JWT>", "user": { "id": "...", "role": "INDIVIDUAL" } }
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
Responses mirror OTP verify (login vs needsSignup with `prefill.wallet`).

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
{ "created": true, "token": "<JWT>", "user": { "id": "...", "role": "INDIVIDUAL" } }
```
Corporate:
```json
{ "created": true, "corporatePending": true, "userId": "..." }
```

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
* Add rate limiting (failed OTP / wallet attempts).
* Add CSRF protection if using cookies for session tokens.
* Add refresh token rotation if longer sessions needed.
* Add Google OAuth state parameter & nonce for anti-CSRF.

## Frontend Helper Usage
```ts
import { requestOtp, verifyOtp, fetchWalletChallenge, verifyWalletSignature, signup, submitCorporate, googleAuthUrl } from '@/lib/authClient';
```

## Corporate Verification Lifecycle
`PENDING` -> manual or automated review process -> update to `VERIFIED` or `REJECTED` via an admin route (future scope).

