import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { mock, test } from 'node:test';

const upstreamCalls = [];
const page = { arrDsrTicketsPhpKey: [{ dblSellingAmtPhpKey: 42 }], intDsrDetailsTicketOffSetPhpKey: 250 };

mock.module('node:https', {
  namedExports: {
    request(options, callback) {
      const call = { options, body: '' };
      upstreamCalls.push(call);
      const request = new EventEmitter();
      request.write = (body) => { call.body += body; };
      request.end = () => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.headers = { 'content-type': 'application/json' };
        callback(response);
        response.emit('data', Buffer.from(JSON.stringify(page)));
        response.emit('end');
      };
      return request;
    },
  },
});

const { default: handler } = await import('../api/proxy.mjs');
const { rewrites } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

function responseRecorder() {
  return {
    statusCode: 0, headers: {}, body: '',
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(body) { this.body = String(body); },
  };
}

test('the deployed pagination route forwards the requested offset and filters to TRAACS', async () => {
  const route = rewrites.find((item) => item.source === '/api/reports/sales/dsr-tickets');
  assert.ok(route, 'The deployed site must expose the next-page endpoint.');
  assert.ok(rewrites.indexOf(route) < rewrites.findIndex((item) => item.source === '/:path*'));
  const body = new URLSearchParams({
    intOffsetAjxKey: '250', intPerPageAjxKey: '250', tabClick: 'true',
    arrSearchValueAjxKey: JSON.stringify({ datDsrDetailsFromAjxKey: '01/01/2026', datDsrDetailsToAjxKey: '31/12/2026' }),
  }).toString();
  const response = responseRecorder();
  await handler({
    url: route.destination, method: 'POST', body,
    headers: { host: 'reports.example.test', cookie: 'traacs_traacs_wave_firstpremium=test-session' },
  }, response);
  const call = upstreamCalls.at(-1);
  assert.equal(call.options.path, '/traacs/basic_dsrdetails_dsrdetails/getdsrdetailsticketdata');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.body, body);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), page);
});

test('the deployed next-page route requires a TRAACS session', async () => {
  const route = rewrites.find((item) => item.source === '/api/reports/sales/dsr-tickets');
  const count = upstreamCalls.length;
  const response = responseRecorder();
  await handler({ url: route.destination, method: 'POST', body: '', headers: { host: 'reports.example.test' } }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(upstreamCalls.length, count);
});
