import worker from '../worker/src/index.js';

const origin = 'https://pls455.github.io';
const env = { ALLOWED_ORIGINS: origin };

async function request(path, init = {}) {
  return worker.fetch(new Request(`https://worker.test${path}`, init), env);
}

const options = await request('/ai', {
  method: 'OPTIONS',
  headers: { Origin: origin },
});
if (options.status !== 204) {
  throw new Error(`AI CORS preflight failed: HTTP ${options.status}`);
}
if (options.headers.get('Access-Control-Allow-Origin') !== origin) {
  throw new Error('AI CORS origin was not echoed for the allowed site');
}

const invalid = await request('/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ action: '__invalid__' }),
});
const invalidBody = await invalid.json();
if (invalid.status !== 400 || invalidBody?.ok !== false || invalidBody?.error !== 'Invalid action') {
  throw new Error(`AI action validation failed: HTTP ${invalid.status}`);
}

const malformed = await request('/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: '{not-json',
});
const malformedBody = await malformed.json();
if (malformed.status !== 400 || malformedBody?.error !== 'Invalid JSON') {
  throw new Error(`AI JSON validation failed: HTTP ${malformed.status}`);
}

const wrongMethod = await request('/ai', { method: 'GET', headers: { Origin: origin } });
if (wrongMethod.status !== 404) {
  throw new Error(`AI method guard failed: HTTP ${wrongMethod.status}`);
}

console.log('AI Worker contract test passed locally (CORS, action validation, malformed JSON, method guard).');
