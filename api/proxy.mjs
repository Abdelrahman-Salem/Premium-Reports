import { request } from 'node:https';

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

function resolveCookie(req) {
  if (req.headers.cookie) {
    return req.headers.cookie;
  }

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

function rewriteSetCookieHeaders(setCookieHeaders) {
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders].filter(Boolean);

  return headers.map((header) => {
    const parts = String(header).split(';').map((part) => part.trim()).filter(Boolean);
    const [cookiePair, ...attributes] = parts;
    const nextAttributes = [];
    let hasPath = false;

    for (const attribute of attributes) {
      if (/^domain=/i.test(attribute)) {
        continue;
      }

      if (/^path=/i.test(attribute)) {
        if (!hasPath) {
          nextAttributes.push('Path=/');
          hasPath = true;
        }
        continue;
      }

      nextAttributes.push(attribute);
    }

    if (!hasPath) {
      nextAttributes.push('Path=/');
    }

    return [cookiePair, ...nextAttributes].join('; ');
  });
}

function collectBody(req) {
  if (typeof req.body === 'string') {
    return Promise.resolve(req.body);
  }

  if (Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body.toString('utf8'));
  }

  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(new URLSearchParams(req.body).toString());
  }

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

function localOrigin(req) {
  const host = req.headers.host || 'localhost';
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return `${proto}://${host}`;
}

function targetOrigin() {
  return `https://${targetHost}:9191`;
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

function rewriteProxyUrlsToTarget(value, req) {
  const host = req.headers.host || '';
  return [
    localOrigin(req),
    `https://${host}`,
    `http://${host}`,
  ].reduce((nextValue, search) => (search ? replaceAll(nextValue, search, targetOrigin()) : nextValue), String(value));
}

function getQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }

  return typeof value === 'string' ? value : '';
}

function getProxyPath(req) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const queryPath = getQueryValue(req.query?.path || url.searchParams.get('path'));

  if (queryPath) {
    return queryPath.startsWith('/') ? queryPath : `/${queryPath}`;
  }

  return '/';
}

function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
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

function sanitizeResponseHeaders(headers, req) {
  const responseHeaders = { ...headers };
  const rewrittenCookies = rewriteSetCookieHeaders(responseHeaders['set-cookie']);

  delete responseHeaders.connection;
  delete responseHeaders['content-encoding'];
  delete responseHeaders['content-length'];
  delete responseHeaders['set-cookie'];
  delete responseHeaders['transfer-encoding'];

  if (responseHeaders.location) {
    responseHeaders.location = rewriteLocation(responseHeaders.location, req);
  }

  if (rewrittenCookies.length > 0) {
    responseHeaders['set-cookie'] = rewrittenCookies;
  }

  return responseHeaders;
}

async function proxyTraacsRequest(req, res, upstreamPath) {
  const cookie = resolveCookie(req);
  const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET');
  const body = hasBody ? await collectBody(req) : '';
  const headers = {
    ...req.headers,
    Accept: req.headers.accept ?? '*/*',
    'Accept-Encoding': 'identity',
    Host: `${targetHost}:9191`,
    Origin: targetOrigin(),
  };

  delete headers.connection;
  delete headers['content-length'];
  delete headers.host;
  delete headers['x-forwarded-for'];
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (req.headers.referer) {
    headers.Referer = rewriteProxyUrlsToTarget(req.headers.referer, req);
  } else if (hasBody) {
    headers.Referer = `${targetOrigin()}${upstreamPath.split('?')[0]}`;
  }

  if (hasBody) {
    headers['Content-Length'] = Buffer.byteLength(body);
  }

  const upstreamReq = request(
    {
      hostname: targetHost,
      port: 9191,
      path: upstreamPath,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      captureSetCookies(upstreamRes.headers['set-cookie']);
      const responseHeaders = sanitizeResponseHeaders(upstreamRes.headers, req);

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
        res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders);
        res.end(rewrittenBody);
      });
    },
  );

  upstreamReq.on('error', (error) => {
    writeJson(res, 502, { message: error.message });
  });

  if (hasBody) {
    upstreamReq.write(body);
    upstreamReq.end();
    return;
  }

  upstreamReq.end();
}

async function proxyReportRequest(req, res) {
  const cookie = resolveCookie(req);

  if (!cookie) {
    writeJson(res, 401, { message: 'TRAACS login is required.' });
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
          const responseHeaders = sanitizeResponseHeaders(upstreamRes.headers, req);
          responseHeaders['content-type'] = upstreamRes.headers['content-type'] ?? 'application/json';
          res.writeHead(upstreamRes.statusCode ?? 502, responseHeaders);
          res.end(payload);
        });
      },
    );

    upstreamReq.on('error', (error) => {
      writeJson(res, 502, { message: error.message });
    });

    upstreamReq.write(body);
    upstreamReq.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error.';
    writeJson(res, 500, { message });
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const action = getQueryValue(req.query?.action || url.searchParams.get('action'));
  const proxyPath = getProxyPath(req);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (action === 'session-status' && req.method === 'GET') {
    writeJson(res, 200, { hasCookie: Boolean(resolveCookie(req)), loginUrl: `${localOrigin(req)}${loginPagePath}` });
    return;
  }

  if (action === 'session-cookie' && req.method === 'POST') {
    try {
      const body = await collectBody(req);
      const parsedBody = JSON.parse(body || '{}');
      const nextCookie = normalizeCookie(parsedBody.cookie);

      if (!nextCookie) {
        writeJson(res, 400, { message: 'Cookie is required.' });
        return;
      }

      runtimeCookie = nextCookie;
      captureSetCookies(nextCookie);
      writeJson(res, 200, { hasCookie: true });
    } catch {
      writeJson(res, 400, { message: 'Invalid request body.' });
    }

    return;
  }

  if (action === 'report' && req.method === 'POST') {
    await proxyReportRequest(req, res);
    return;
  }

  if (action) {
    writeJson(res, 404, { message: 'Route not found.' });
    return;
  }

  await proxyTraacsRequest(req, res, proxyPath);
}
