import { request } from 'node:https';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getTraacsCredentials } from './traacs-credentials.mjs';

const host = 'attar-firstpremium.traacs.io';
const origin = `https://${host}:9191`;
const loginPath = '/nucorelib/basic_users/login';
const verificationPath = '/traacs/basic_dsrdetails_dsrdetails/dsrdetails/strMenuId/mnu_reports';
const cookieName = 'traacs_traacs_wave_firstpremium';
const browserCookieName = 'premium_reports_session';
const cookieLifetime = 12 * 60 * 60 * 1000;

export class TraacsConnectionError extends Error {
  constructor(code, status = 503) {
    super('The automatic TRAACS connection could not be established.');
    this.code = code;
    this.status = status;
  }
}

export function requestTraacs({ path, method = 'GET', body = '', headers = {}, timeout = 60000 }) {
  return new Promise((resolve, reject) => {
    const upstream = request({
      hostname: host, port: 9191, path, method,
      headers: {
        Accept: '*/*', 'Accept-Encoding': 'identity', Host: `${host}:9191`,
        'User-Agent': 'Mozilla/5.0 PremiumReportsProxy/1.0', ...headers,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('aborted', () => reject(new TraacsConnectionError('TRAACS_RESPONSE_INCOMPLETE', 502)));
      response.on('end', () => resolve({
        statusCode: response.statusCode ?? 502, headers: response.headers, body: Buffer.concat(chunks),
      }));
    });
    upstream.setTimeout(timeout, () => upstream.destroy(new TraacsConnectionError('TRAACS_TIMEOUT', 504)));
    upstream.on('error', (error) => reject(error instanceof TraacsConnectionError ? error : new TraacsConnectionError('TRAACS_UNAVAILABLE', 502)));
    upstream.end(body || undefined);
  });
}

function looksLikeLogin(body) {
  return /<form\b[^>]*(?:id|name)=["']?logInForm\b|<input\b[^>]*name=["']?(?:txtPassword|password)\b/i.test(body);
}

export function isTraacsSessionExpired(response) {
  if (response.statusCode === 401) return true;
  const location = String(response.headers.location ?? '');
  if (response.statusCode >= 300 && response.statusCode < 400 && /\/basic_users\/login\b/i.test(location)) return true;
  const body = response.body.toString('utf8').trim();
  if (looksLikeLogin(body)) return true;
  if (!/^[{\["]/.test(body)) return false;
  try {
    const data = JSON.parse(body);
    const message = typeof data === 'string' ? data : [data?.code, data?.error, data?.message, data?.strError].filter((item) => typeof item === 'string').join(' ');
    return /SESSION[_ ]EXPIRED|LOGIN[_ ]REQUIRED|NOT[_ ]AUTHENTICATED|AUTHENTICATION[_ ]REQUIRED|session has expired/i.test(message);
  } catch { return false; }
}

export function createTraacsSession({ transport = requestTraacs, credentials = getTraacsCredentials, now = Date.now } = {}) {
  let jar = new Map();
  let verifiedAt = 0;
  let pending;
  let failure;
  let retryAfter = 0;

  const enabled = () => {
    const account = credentials();
    return account.enabled && Boolean(account.username && account.password);
  };
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  const hasCookie = () => Boolean(jar.get(cookieName));
  const encryptionKey = () => createHash('sha256').update(credentials().sessionSecret).digest();
  const accountIdentity = () => {
    const account = credentials();
    return createHash('sha256').update(JSON.stringify([account.username, account.password, account.companyId])).digest('hex');
  };

  function capture(headers) {
    const values = Array.isArray(headers['set-cookie']) ? headers['set-cookie'] : [headers['set-cookie']].filter(Boolean);
    for (const value of values) {
      const [pair] = value.split(';');
      const separator = pair.indexOf('=');
      if (separator < 1) continue;
      const name = pair.slice(0, separator).trim(), contents = pair.slice(separator + 1).trim();
      if (!contents || /max-age\s*=\s*0(?:;|$)/i.test(value)) jar.delete(name);
      else jar.set(name, contents);
    }
  }

  function restoreBrowserSession(req) {
    if (hasCookie()) return;
    const part = String(req?.headers?.cookie ?? '').split(';').map((value) => value.trim()).find((value) => value.startsWith(`${browserCookieName}=`));
    if (!part) return;
    try {
      const packed = Buffer.from(part.slice(browserCookieName.length + 1), 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), packed.subarray(0, 12));
      decipher.setAuthTag(packed.subarray(12, 28));
      const session = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8'));
      if (session.account !== accountIdentity()) return;
      if (!Number.isFinite(session.createdAt) || now() - session.createdAt > cookieLifetime || session.createdAt > now() + 60000) return;
      const restored = new Map(session.cookies.filter(([name, value]) => typeof name === 'string' && typeof value === 'string' && !/[\r\n;]/.test(name + value)));
      if (restored.get(cookieName)) jar = restored;
    } catch { /* An invalid or outdated cookie starts a fresh server login. */ }
  }

  function responseHeaders(req) {
    const headers = { 'Cache-Control': 'no-store, private' };
    if (!hasCookie() || !verifiedAt) return headers;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const data = Buffer.from(JSON.stringify({ createdAt: now(), account: accountIdentity(), cookies: [...jar] }));
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const sealed = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    const local = /^(?:localhost|127\.0\.0\.1)(?::|$)/.test(req?.headers?.host ?? '');
    const secure = String(req?.headers?.['x-forwarded-proto'] ?? (local ? 'http' : 'https')).split(',')[0].trim() === 'https';
    headers['Set-Cookie'] = `${browserCookieName}=${sealed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieLifetime / 1000}${secure ? '; Secure' : ''}`;
    return headers;
  }

  async function send(path, { method = 'GET', body = '', headers = {}, timeout = 20000, captureCookies = true } = {}) {
    const response = await transport({ path, method, body, timeout, headers: { Cookie: cookie(), ...headers } });
    if (captureCookies) capture(response.headers);
    return response;
  }

  async function validSession() {
    if (!hasCookie()) return false;
    const response = await send(verificationPath, { headers: { Accept: 'text/html,*/*' } });
    if (response.statusCode >= 500) throw new TraacsConnectionError('TRAACS_UNAVAILABLE', 502);
    return response.statusCode >= 200 && response.statusCode < 300 && !isTraacsSessionExpired(response);
  }

  async function login() {
    const account = credentials();
    jar.clear();
    verifiedAt = 0;
    const page = await send(loginPath);
    if (page.statusCode >= 400) throw new TraacsConnectionError('TRAACS_LOGIN_UNAVAILABLE');
    const ajaxHeaders = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', Origin: origin, Referer: `${origin}${loginPath}` };
    const check = await send('/nucorelib/basic_users/loginajax', {
      method: 'POST', headers: ajaxHeaders,
      body: new URLSearchParams({ txtLoginName: account.username, txtPassword: JSON.stringify(account.password.trim()), cmbCompany: account.companyId }).toString(),
    });
    if (check.statusCode >= 500) throw new TraacsConnectionError('TRAACS_UNAVAILABLE', 502);
    let details;
    try { details = JSON.parse(check.body.toString('utf8')); }
    catch { throw new TraacsConnectionError('TRAACS_LOGIN_UNAVAILABLE'); }
    if (!details || typeof details !== 'object' || details.strError || !Array.isArray(details.arrDetailsUserCostcenters)) {
      throw new TraacsConnectionError('TRAACS_CREDENTIALS_REJECTED');
    }
    const centers = details.arrDetailsUserCostcenters;
    const costCenter = account.costCenterId || String(details.intDefaultCostCenterId ?? centers[0]?.CostCenterId ?? '');
    if (details.costCenterAuth && !centers.some((center) => String(center.CostCenterId) === costCenter)) {
      throw new TraacsConnectionError('TRAACS_LOGIN_CENTER_REQUIRED');
    }
    const submitted = await send(loginPath, {
      method: 'POST', headers: { ...ajaxHeaders, 'X-Requested-With': '' },
      body: new URLSearchParams({ txtLoginName: account.username, txtPassword: account.password, cmbcompany: account.companyId, cmbcostCenter: costCenter, btnLoginSubmit: '' }).toString(),
    });
    if (submitted.statusCode >= 400 || !await validSession()) throw new TraacsConnectionError('TRAACS_LOGIN_FAILED');
    verifiedAt = now();
  }

  async function ensure(req, { renew = false, usedCookie } = {}) {
    if (!enabled()) throw new TraacsConnectionError('TRAACS_AUTO_LOGIN_DISABLED', 401);
    if (pending) return pending;
    if (renew && usedCookie && cookie() !== usedCookie && verifiedAt) return;
    restoreBrowserSession(req);
    if (!renew && hasCookie() && verifiedAt && now() - verifiedAt < 60000) return;
    if (failure && now() < retryAfter) throw failure;
    pending = (async () => {
      try {
        if (renew || !await validSession()) await login();
        verifiedAt = now();
        failure = undefined;
      } catch (error) {
        verifiedAt = 0;
        jar.clear();
        failure = error instanceof TraacsConnectionError ? error : new TraacsConnectionError('TRAACS_UNAVAILABLE', 502);
        retryAfter = now() + (failure.code === 'TRAACS_CREDENTIALS_REJECTED' ? 300000 : 15000);
        throw failure;
      } finally { pending = undefined; }
    })();
    return pending;
  }

  async function report(req, path, referer, body) {
    await ensure(req);
    const headers = { Accept: '*/*', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Origin: origin, Referer: `${origin}${referer}`, 'X-Requested-With': 'XMLHttpRequest' };
    let usedCookie = cookie();
    let response = await send(path, { method: 'POST', body, headers, timeout: 60000, captureCookies: false });
    if (isTraacsSessionExpired(response)) {
      await ensure(req, { renew: true, usedCookie });
      usedCookie = cookie();
      response = await send(path, { method: 'POST', body, headers, timeout: 60000, captureCookies: false });
      if (isTraacsSessionExpired(response)) {
        jar.clear(); verifiedAt = 0;
        failure = new TraacsConnectionError('TRAACS_SESSION_EXPIRED');
        retryAfter = now() + 15000;
        throw failure;
      }
    }
    if (cookie() === usedCookie) capture(response.headers);
    return response;
  }

  return { enabled, ensure, report, responseHeaders };
}

export const traacsSession = createTraacsSession();
