import { createServer } from 'node:http';
import { request } from 'node:https';

const port = Number(process.env.PORT ?? 3333);
const targetHost = 'attar-firstpremium.traacs.io';
const targetPath = '/traacs/basic_dsrdetails_dsrdetails/getdsrdetailsdetails';
const reportPagePath = '/traacs/basic_dsrdetails_dsrdetails/dsrdetails/strMenuId/mnu_reports';
const loginPagePath = '/nucorelib/basic_users/login';
const sessionCookieName = 'traacs_traacs_wave_firstpremium';
let runtimeCookie = '';
const cookieJar = new Map();

function normalizeCookie(rawCookie) {
  const trimmedCookie = String(rawCookie ?? '').trim();

  if (!trimmedCookie) {
    return '';
  }

  return trimmedCookie.includes('=') ? trimmedCookie : `${sessionCookieName}=${trimmedCookie}`;
}

function resolveCookie() {
  if (cookieJar.size > 0) {
    return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  return runtimeCookie || normalizeCookie(process.env.TRAACS_COOKIE);
}

function captureSetCookies(setCookieHeaders) {
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders].filter(Boolean);

  for (const header of headers) {
    const [cookiePair] = String(header).split(';');
    const separatorIndex = cookiePair.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();

    if (name && value) {
      cookieJar.set(name, value);
    }
  }
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function writeCorsHeaders(req, res) {
  const origin = req.headers.origin ?? '';
  const allowedOrigin = /^http:\/\/(localhost|127\.0\.0\.1):(4200|4201)$/.test(origin) ? origin : 'http://localhost:4200';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Accept');
}

function localOrigin(req) {
  const host = req.headers.host || `localhost:${port}`;
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto}://${host}`;
}

function replaceAll(value, search, replacement) {
  return String(value).split(search).join(replacement);
}

function rewriteTargetUrls(value, origin) {
  return [
    `https://${targetHost}:9191`,
    `http://${targetHost}:9191`,
    `https://${targetHost}`,
    `http://${targetHost}`,
  ].reduce((nextValue, search) => replaceAll(nextValue, search, origin), String(value));
}

function rewriteLocation(locationHeader, req) {
  if (!locationHeader) {
    return locationHeader;
  }

  return rewriteTargetUrls(locationHeader, localOrigin(req));
}

function shouldRewriteBody(headers) {
  const contentType = String(headers['content-type'] || '');
  return /text\/html|application\/javascript|text\/javascript|text\/css/i.test(contentType);
}

function proxyTraacsRequest(req, res) {
  const cookie = resolveCookie();
  const headers = {
    ...req.headers,
    Accept: req.headers.accept ?? '*/*',
    'Accept-Encoding': 'identity',
    Host: `${targetHost}:9191`,
    Origin: `https://${targetHost}:9191`,
  };

  delete headers.connection;
  delete headers['proxy-connection'];

  if (cookie) {
    delete headers.cookie;
    headers.Cookie = cookie;
  }

  const upstreamReq = request(
    {
      hostname: targetHost,
      port: 9191,
      path: req.url,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      captureSetCookies(upstreamRes.headers['set-cookie']);

      const responseHeaders = { ...upstreamRes.headers };
      delete responseHeaders['set-cookie'];
      if (responseHeaders.location) {
        responseHeaders.location = rewriteLocation(responseHeaders.location, req);
      }

      if (!shouldRewriteBody(responseHeaders)) {
        res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders);
        upstreamRes.pipe(res);
        return;
      }

      const chunks = [];
      upstreamRes.on('data', (chunk) => {
        chunks.push(chunk);
      });
      upstreamRes.on('end', () => {
        const originalBody = Buffer.concat(chunks).toString('utf8');
        const rewrittenBody = rewriteTargetUrls(originalBody, localOrigin(req));
        delete responseHeaders['content-length'];
        res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders);
        res.end(rewrittenBody);
      });
    },
  );

  upstreamReq.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: error.message }));
  });

  req.pipe(upstreamReq);
}

const server = createServer(async (req, res) => {
  writeCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/session/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hasCookie: Boolean(resolveCookie()), loginUrl: `${localOrigin(req)}${loginPagePath}` }));
    return;
  }

  if (req.url === '/api/session/cookie' && req.method === 'POST') {
    try {
      const body = await collectBody(req);
      const parsedBody = JSON.parse(body || '{}');
      const nextCookie = normalizeCookie(parsedBody.cookie);

      if (!nextCookie) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Cookie is required.' }));
        return;
      }

      runtimeCookie = nextCookie;
      captureSetCookies(nextCookie);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasCookie: true }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Invalid request body.' }));
    }

    return;
  }

  if (!req.url?.startsWith('/api/')) {
    proxyTraacsRequest(req, res);
    return;
  }

  if (req.url !== '/api/reports/sales/dsr' || req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Route not found.' }));
    return;
  }

  const cookie = resolveCookie();
  if (!cookie) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'TRAACS_COOKIE environment variable is required.' }));
    return;
  }

  try {
    const body = await collectBody(req);
    const upstreamReq = request(
      {
        hostname: targetHost,
        port: 9191,
        path: targetPath,
        method: 'POST',
        headers: {
          Accept: '*/*',
          'Accept-Encoding': 'identity',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': Buffer.byteLength(body),
          Cookie: cookie,
          Host: `${targetHost}:9191`,
          Origin: `https://${targetHost}:9191`,
          Referer: `https://${targetHost}:9191${reportPagePath}`,
          'User-Agent': 'Mozilla/5.0 PremiumReportsProxy/1.0',
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
      (upstreamRes) => {
        const chunks = [];

        upstreamRes.on('data', (chunk) => {
          chunks.push(chunk);
        });

        upstreamRes.on('end', () => {
          const payload = Buffer.concat(chunks);
          res.writeHead(upstreamRes.statusCode ?? 502, {
            'Content-Type': upstreamRes.headers['content-type'] ?? 'application/json',
          });
          res.end(payload);
        });
      },
    );

    upstreamReq.on('error', (error) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: error.message }));
    });

    upstreamReq.write(body);
    upstreamReq.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error.';
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message }));
  }
});

server.listen(port, () => {
  console.log(`TRAACS proxy listening on http://localhost:${port}`);
});
