const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'service-worker.js'),
  'utf8'
);

function createHarness() {
  const local = {};
  const session = {};
  const requests = [];
  const badge = {};
  let messageListener;

  function storageArea(values) {
    return {
      async get(keys) {
        const result = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          if (key in values) result[key] = values[key];
        }
        return result;
      },
      async set(next) {
        Object.assign(values, next);
      },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
      },
    };
  }

  const chrome = {
    action: {
      setBadgeText({ text }) { badge.text = text; },
      setBadgeBackgroundColor({ color }) { badge.color = color; },
    },
    alarms: {
      create() {},
      onAlarm: { addListener() {} },
    },
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
    },
    storage: {
      local: storageArea(local),
      session: storageArea(session),
    },
  };

  async function fetch(url, options = {}) {
    requests.push({ url, options });
    const endpoint = new URL(url).pathname;
    const payload = endpoint.endsWith('/health')
      ? { status: 'healthy', version: 'test' }
      : { ok: true };
    return {
      ok: true,
      status: 200,
      async json() { return payload; },
    };
  }

  vm.runInNewContext(source, {
    AbortSignal,
    URL,
    chrome,
    console,
    fetch,
    setTimeout,
    clearTimeout,
  });

  async function send(message) {
    return new Promise((resolve) => {
      messageListener(message, {}, resolve);
    });
  }

  return { badge, local, requests, send, session };
}

test('rejects non-loopback daemon URLs', async () => {
  const harness = createHarness();
  const result = await harness.send({
    type: 'SET_SETTINGS',
    settings: { apiUrl: 'https://example.com' },
  });

  assert.match(result.error, /localhost/);
  assert.equal(harness.local.apiUrl, undefined);
});

test('normalizes loopback settings and stores the bearer secret', async () => {
  const harness = createHarness();
  const result = await harness.send({
    type: 'SET_SETTINGS',
    settings: {
      apiUrl: 'http://127.0.0.1:4111/path/',
      secret: '  local-secret  ',
    },
  });

  assert.equal(result.ok, true);
  assert.equal(harness.local.apiUrl, 'http://127.0.0.1:4111');
  assert.equal(harness.local.secret, 'local-secret');
});

test('uses authenticated health checks', async () => {
  const harness = createHarness();
  harness.local.secret = 'secret';

  const result = await harness.send({ type: 'STATUS' });
  const request = harness.requests.at(-1);

  assert.equal(result.connected, true);
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  assert.match(request.url, /\/agentmemory\/health$/);
});

test('captures observations with portable browser metadata', async () => {
  const harness = createHarness();
  await harness.send({
    type: 'OBSERVE',
    platform: 'chatgpt',
    sessionId: 'session-1',
    content: 'User: hello\n\nAssistant: hi',
  });

  const request = harness.requests.at(-1);
  const body = JSON.parse(request.options.body);

  assert.equal(body.project, 'chatgpt-web');
  assert.equal(body.cwd, 'browser:chatgpt');
  assert.equal(body.data.prompt, 'User: hello\n\nAssistant: hi');
});

test('persists queue count for badge updates', async () => {
  const harness = createHarness();
  const result = await harness.send({ type: 'SET_QUEUE_COUNT', count: 3 });

  assert.equal(result.ok, true);
  assert.equal(harness.session.oamQueueCount, 3);
  assert.equal(harness.badge.text, '3');
});
