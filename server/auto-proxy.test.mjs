import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';

const account = { username: 'integration-user', password: 'integration-password', companyId: '1', costCenterId: '', sessionSecret: 'integration-secret', enabled: true };
const calls = [];
let logins = 0;
let expire = false;
mock.module('../server/traacs-credentials.mjs', { namedExports: { getTraacsCredentials: () => account } });
mock.module('node:https', {
  namedExports: {
    request(options, callback) {
      const upstream = new EventEmitter();
      upstream.setTimeout = () => upstream;
      upstream.end = (body = '') => {
        calls.push({ ...options, body });
        const response = new EventEmitter();
        response.statusCode = 200;
        response.headers = { 'content-type': 'application/json' };
        let payload = JSON.stringify({ arrDsrTicketsPhpKey: [{ dblSellingAmtPhpKey: 42 }], intDsrDetailsTicketOffSetPhpKey: 250 });
        if (options.path.endsWith('/loginajax')) payload = JSON.stringify({ arrDetailsUserCostcenters: [], costCenterAuth: false });
        else if (options.path.endsWith('/login')) {
          if (options.method === 'POST') {
            logins++;
            response.statusCode = 302;
            response.headers.location = '/nucorelib/basic_backgroundlogo/backgroundlogo';
            response.headers['set-cookie'] = [`traacs_traacs_wave_firstpremium=integration-session-${logins}; Path=/`];
          } else response.headers['set-cookie'] = ['traacs_traacs_wave_firstpremium=guest; Path=/'];
          payload = '<form id="logInForm"></form>';
        } else if (options.method === 'GET') payload = '<html>Authenticated report</html>';
        else if (expire) {
          expire = false;
          response.statusCode = 401;
          payload = JSON.stringify({ code: 'SESSION_EXPIRED' });
        }
        callback(response);
        response.emit('data', Buffer.from(payload));
        response.emit('end');
      };
      return upstream;
    },
  },
});
const { default: handler } = await import('../api/proxy.mjs');
const { rewrites } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const request = (url, method = 'GET', body = '') => ({ url, method, body, headers: { host: 'reports.example.test' } });
const recorder = () => ({
  headers: {}, body: '', statusCode: 0,
  setHeader(name, value) { this.headers[name] = value; },
  writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
  end(body) { this.body = String(body); },
});

test('deployed session checks automatically authenticate once without browser cookies', async () => {
  const results = await Promise.all(Array.from({ length: 4 }, async () => {
    const res = recorder();
    await handler(request('/api/proxy?action=session-status'), res);
    return res;
  }));
  assert.equal(logins, 1);
  for (const res of results) {
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { hasCookie: true, automatic: true, loginUrl: '' });
    assert.match(res.headers['Set-Cookie'], /HttpOnly/);
    assert.equal(res.headers['Cache-Control'], 'no-store, private');
    assert.ok(!JSON.stringify(res).includes(account.password));
    assert.ok(!JSON.stringify(res).includes('integration-session-1'));
  }
});

test('all deployed report endpoints accept automatic sessions and preserve request bodies', async () => {
  const routes = rewrites.filter((route) => route.source.startsWith('/api/reports/'));
  for (const route of routes) {
    const res = recorder();
    const body = new URLSearchParams({ intOffsetAjxKey: '250', arrSearchValueAjxKey: '{"period":"2026-01","centres":[1,73]}' }).toString();
    await handler(request(route.destination, 'POST', body), res);
    assert.equal(res.statusCode, 200, route.source);
    assert.equal(calls.at(-1).body, body);
    assert.match(calls.at(-1).headers.Cookie, /integration-session-1/);
    assert.equal(JSON.parse(res.body).intDsrDetailsTicketOffSetPhpKey, 250);
    assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  }
  assert.equal(logins, 1);
});

test('a deployed report renews an expired login once and returns the complete retried response', async () => {
  expire = true;
  const res = recorder();
  const route = rewrites.find((route) => route.source === '/api/reports/sales/dsr-tickets');
  await handler(request(route.destination, 'POST', 'intOffsetAjxKey=250'), res);
  assert.equal(logins, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).intDsrDetailsTicketOffSetPhpKey, 250);
  assert.equal(calls.at(-1).body, 'intOffsetAjxKey=250');
  assert.match(calls.at(-1).headers.Cookie, /integration-session-2/);
});
