import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTraacsSession, isTraacsSessionExpired } from './traacs-session.mjs';

const account = { username: 'test-user', password: 'test-password', companyId: '1', costCenterId: '', sessionSecret: 'test-server-only-secret', enabled: true };
const req = { headers: { host: 'reports.example.test' } };
const reportPath = '/traacs/getdsrdetailsticketdata';
const response = (body, statusCode = 200, headers = {}) => ({ statusCode, headers, body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) });

function backend() {
  const state = { calls: [], logins: 0, checks: 0, active: '', rejected: false, expired: false, alwaysExpired: false, reportStatus: 200 };
  state.transport = async (options) => {
    state.calls.push(options);
    const isLogin = options.path.endsWith('/basic_users/login');
    if (isLogin && options.method === 'GET') return response('<form id="logInForm"><input name="txtPassword"></form>', 200, { 'set-cookie': ['traacs_traacs_wave_firstpremium=guest; Path=/'] });
    if (options.path.endsWith('/loginajax')) {
      state.checks++;
      if (state.rejected) return response({ strError: 'WRONG_PASSWORD' });
      const body = new URLSearchParams(options.body);
      assert.equal(body.get('txtLoginName'), account.username);
      assert.equal(body.get('txtPassword'), JSON.stringify(account.password));
      assert.equal(body.get('cmbCompany'), account.companyId);
      return response({ arrDetailsUserCostcenters: [{ CostCenterId: 73 }], costCenterAuth: true, intDefaultCostCenterId: 73 });
    }
    if (isLogin) {
      state.logins++;
      state.active = `valid-session-${state.logins}`;
      const body = new URLSearchParams(options.body);
      assert.equal(body.get('txtPassword'), account.password);
      assert.equal(body.get('cmbcostCenter'), '73');
      return response('', 302, { location: '/nucorelib/basic_backgroundlogo/backgroundlogo', 'set-cookie': [`traacs_traacs_wave_firstpremium=${state.active}; Path=/`] });
    }
    if (options.path.includes('/dsrdetails/strMenuId/')) {
      return options.headers.Cookie.includes(state.active) && state.active
        ? response('<html>Authenticated report page</html>')
        : response('', 302, { location: '/nucorelib/basic_users/login' });
    }
    if (state.alwaysExpired || state.expired || !options.headers.Cookie.includes(state.active)) {
      state.expired = false;
      return response('<form id="logInForm"><input name="txtPassword"></form>', 200, { 'content-type': 'text/html', 'set-cookie': ['traacs_traacs_wave_firstpremium=guest; Path=/'] });
    }
    return response({ count: 305, offset: 250, complete: true }, state.reportStatus, { 'content-type': 'application/json' });
  };
  return state;
}

test('initial parallel requests share one login and reuse the authenticated session', async () => {
  const upstream = backend();
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  await Promise.all(Array.from({ length: 8 }, () => session.ensure(req)));
  await session.ensure(req);
  assert.equal(upstream.logins, 1);
  assert.equal(upstream.checks, 1);
  assert.equal(upstream.calls.length, 4);
});

test('report requests preserve the pagination body and renew a login HTML response once', async () => {
  const upstream = backend();
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  await session.ensure(req);
  upstream.expired = true;
  const body = new URLSearchParams({ intOffsetAjxKey: '250', arrSearchValueAjxKey: '{"year":2026,"centers":[1,73]}' }).toString();
  const result = await session.report(req, reportPath, '/report-page', body);
  const reports = upstream.calls.filter((call) => call.path === reportPath);
  assert.equal(reports.length, 2);
  assert.ok(reports.every((call) => call.body === body));
  assert.equal(upstream.logins, 2);
  assert.equal(JSON.parse(result.body).offset, 250);
});

test('concurrent expired requests renew once without adopting anonymous response cookies', async () => {
  const upstream = backend();
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  await session.ensure(req);
  upstream.active = 'expired-on-server';
  const results = await Promise.all(Array.from({ length: 6 }, () => session.report(req, reportPath, '/report-page', 'offset=250')));
  assert.equal(upstream.logins, 2);
  assert.ok(results.every((result) => result.statusCode === 200 && JSON.parse(result.body).complete));
});

test('a repeatedly expired report stops after one retry instead of looping logins', async () => {
  const upstream = backend();
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  await session.ensure(req);
  upstream.alwaysExpired = true;
  await assert.rejects(session.report(req, reportPath, '/report-page', ''), { code: 'TRAACS_SESSION_EXPIRED' });
  assert.equal(upstream.logins, 2);
  assert.equal(upstream.calls.filter((call) => call.path === reportPath).length, 2);
  await assert.rejects(session.ensure(req), { code: 'TRAACS_SESSION_EXPIRED' });
  assert.equal(upstream.logins, 2);
});

test('a bad password is not retried on every session check', async () => {
  const upstream = backend(); upstream.rejected = true;
  let time = 1000;
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account, now: () => time });
  await assert.rejects(session.ensure(req), { code: 'TRAACS_CREDENTIALS_REJECTED' });
  await assert.rejects(session.ensure(req), { code: 'TRAACS_CREDENTIALS_REJECTED' });
  assert.equal(upstream.checks, 1);
  assert.equal(upstream.logins, 0);
  time += 300001;
  upstream.rejected = false;
  await session.ensure(req);
  assert.equal(upstream.checks, 2);
});

test('the browser receives an encrypted HttpOnly cookie reusable across server instances', async () => {
  const upstream = backend();
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  await session.ensure(req);
  const headers = session.responseHeaders(req);
  assert.equal(headers['Cache-Control'], 'no-store, private');
  assert.match(headers['Set-Cookie'], /HttpOnly/);
  assert.match(headers['Set-Cookie'], /SameSite=Lax/);
  assert.match(headers['Set-Cookie'], /; Secure/);
  assert.ok(!headers['Set-Cookie'].includes(upstream.active));
  assert.ok(!headers['Set-Cookie'].includes(account.password));
  const second = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  await second.ensure({ headers: { ...req.headers, cookie: headers['Set-Cookie'].split(';')[0] } });
  assert.equal(upstream.logins, 1);
});

test('a forged browser session is discarded and cannot inject TRAACS cookies', async () => {
  const upstream = backend();
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  await session.ensure({ headers: { cookie: 'premium_reports_session=forged; traacs_traacs_wave_firstpremium=untrusted' } });
  assert.equal(upstream.logins, 1);
  assert.ok(upstream.calls.every((call) => !call.headers.Cookie.includes('untrusted')));
});

test('old sealed sessions expire and local HTTP cookies remain HttpOnly', async () => {
  const upstream = backend(); let time = 1000;
  const first = createTraacsSession({ transport: upstream.transport, credentials: () => account, now: () => time });
  await first.ensure(req);
  const cookie = first.responseHeaders(req)['Set-Cookie'].split(';')[0];
  time += 13 * 60 * 60 * 1000;
  const next = createTraacsSession({ transport: upstream.transport, credentials: () => account, now: () => time });
  const local = { headers: { host: 'localhost:4200', cookie } };
  await next.ensure(local);
  assert.equal(upstream.logins, 2);
  assert.ok(!next.responseHeaders(local)['Set-Cookie'].includes('; Secure'));
  assert.match(next.responseHeaders(local)['Set-Cookie'], /HttpOnly/);
});

test('server errors and permission failures do not trigger a new login', async () => {
  const upstream = backend();
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account });
  for (const status of [500, 403]) {
    upstream.reportStatus = status;
    const result = await session.report(req, reportPath, '/report-page', '');
    assert.equal(result.statusCode, status);
  }
  assert.equal(upstream.logins, 1);
});

test('session validation after idle time preserves a valid session', async () => {
  const upstream = backend(); let time = 1000;
  const session = createTraacsSession({ transport: upstream.transport, credentials: () => account, now: () => time });
  await session.ensure(req);
  time += 61000;
  await session.ensure(req);
  assert.equal(upstream.logins, 1);
  assert.equal(upstream.calls.length, 5);
});

test('only authentication responses are considered expired sessions', () => {
  assert.equal(isTraacsSessionExpired(response({ code: 'SESSION_EXPIRED' })), true);
  assert.equal(isTraacsSessionExpired(response({}, 401)), true);
  assert.equal(isTraacsSessionExpired(response('', 302, { location: '/nucorelib/basic_users/login' })), true);
  assert.equal(isTraacsSessionExpired(response({ message: 'Forbidden' }, 403)), false);
  assert.equal(isTraacsSessionExpired(response({ message: 'Internal error' }, 500)), false);
  assert.equal(isTraacsSessionExpired(response({ rows: [{ service: 'Login assistance' }] })), false);
});
