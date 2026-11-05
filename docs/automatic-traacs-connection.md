# Automatic TRAACS connection

The reports server authenticates automatically when the site opens or the first report is requested. The same implementation serves the local Node proxy and the deployed Vercel handler. Report filters, request bodies, pagination, completeness checks and accounting calculations are unchanged.

## Account configuration

`server/traacs-credentials.mjs` is server-only configuration. The supplied account is stored in that repository file at the owner's explicit request. It must never be imported from Angular (`src/`) or copied into `public/`. Environment variables override the repository values: `TRAACS_USERNAME`, `TRAACS_PASSWORD`, `TRAACS_COMPANY_ID`, `TRAACS_LOGIN_COST_CENTER`, and `TRAACS_SESSION_SECRET`.

Everyone who can open the reports site uses this account's report permissions. Changing the account password also invalidates saved browser sessions. Do not log credentials, raw login responses, raw TRAACS cookies, or encrypted session cookies.

## Session lifecycle

1. Reuse a verified server session. Parallel requests in one instance share the same authentication promise.
2. Across cold starts, restore a server-encrypted session from an HttpOnly, SameSite=Lax cookie. HTTPS responses mark it Secure. The session is checked against a protected TRAACS report page before reuse in a new instance, and after 60 seconds of inactivity in the current instance.
3. If needed, GET the login page, POST `loginajax` using TRAACS's JSON-encoded password format, then POST the original form using its raw password format and company/default centre. Verify access to the protected report page before marking the connection ready.
4. On an authentication response, renew and retry the exact report request once. Read-only report requests retain their original dates, centres and pagination offsets. Generic 403 permission failures and 5xx upstream errors do not trigger a login retry.
5. A rejected password suppresses further login attempts for five minutes in that server instance. Transient connection failures and repeated expiry have a short cooldown. Failures return a safe error code; incomplete responses never become a successful report.

The encrypted cookie expires after 12 hours. Its contents include an account binding and are verified with authenticated encryption before use. The browser receives neither the account credentials nor the raw TRAACS cookie. The encryption secret must be identical across instances; keep its repository value stable or set `TRAACS_SESSION_SECRET` consistently.

`TRAACS_AUTO_LOGIN=false` restores the previous manual-cookie flow for troubleshooting. The normal interface shows connection status and a Reconnect button, without asking viewers to log into TRAACS.

## Validation

`npm run test:proxy` verifies concurrent login, renewal, exact request replay, encrypted cookie restoration, failed-login cooldown and deployed report routing. `npm test -- --watch=false` verifies the report UI and accounting behavior. `npm run build` builds only the public Angular application; server configuration is not a static asset.

On 5 November 2026, a fresh Chrome context with no cookies authenticated automatically and loaded the sales, customer, cost-centre and executive reports for 1–31 January 2026 against live TRAACS. All ten API responses succeeded. A separate fresh server instance restored and validated the encrypted session against live TRAACS without another login. The Vercel handler was exercised locally against TRAACS; a production deployment was not performed. All 65 Angular tests, 16 proxy/session tests and the production build passed. The 44 browser build assets were checked for the configured username, password and encryption secret, with no matches.
