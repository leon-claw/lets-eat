import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { resolve } from 'node:path';
import test from 'node:test';

const projectRoot = resolve(import.meta.dirname, '..');
const cliPath = resolve(import.meta.dirname, 'network-latency.mjs');

test('on creates the API proxy and adds latency in both TCP directions', async (context) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readJsonBody(request);
    requests.push({ method: request.method, url: request.url, body });
    response.writeHead(request.method === 'DELETE' ? 204 : 200, { 'content-type': 'application/json' });
    response.end(request.method === 'DELETE' ? undefined : JSON.stringify({ ok: true }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake server did not expose a TCP port');

  const result = await runCli(['on', '--', '1500', '200'], {
    TOXIPROXY_API_URL: `http://127.0.0.1:${address.port}`,
    TOXIPROXY_SKIP_DOCKER: '1',
  });

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(requests, [
    {
      method: 'GET',
      url: '/version',
      body: undefined,
    },
    {
      method: 'POST',
      url: '/populate',
      body: [{
        name: 'lets_eat_dev_api',
        listen: '0.0.0.0:8666',
        upstream: 'host.docker.internal:3001',
        enabled: true,
      }],
    },
    {
      method: 'DELETE',
      url: '/proxies/lets_eat_dev_api/toxics/latency_upstream',
      body: undefined,
    },
    {
      method: 'DELETE',
      url: '/proxies/lets_eat_dev_api/toxics/latency_downstream',
      body: undefined,
    },
    {
      method: 'POST',
      url: '/proxies/lets_eat_dev_api/toxics',
      body: {
        name: 'latency_upstream',
        type: 'latency',
        stream: 'upstream',
        toxicity: 1,
        attributes: { latency: 1500, jitter: 200 },
      },
    },
    {
      method: 'POST',
      url: '/proxies/lets_eat_dev_api/toxics',
      body: {
        name: 'latency_downstream',
        type: 'latency',
        stream: 'downstream',
        toxicity: 1,
        attributes: { latency: 1500, jitter: 200 },
      },
    },
  ]);
  assert.match(result.stdout, /1500ms ± 200ms/);
});

test('off keeps the API proxy but removes both latency toxics', async (context) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await readJsonBody(request);
    requests.push({ method: request.method, url: request.url, body });
    response.writeHead(request.method === 'DELETE' ? 204 : 200, { 'content-type': 'application/json' });
    response.end(request.method === 'DELETE' ? undefined : JSON.stringify({ ok: true }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake server did not expose a TCP port');

  const result = await runCli(['off'], {
    API_PORT: '3999',
    TOXIPROXY_API_URL: `http://127.0.0.1:${address.port}`,
    TOXIPROXY_SKIP_DOCKER: '1',
  });

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(requests, [
    { method: 'GET', url: '/version', body: undefined },
    {
      method: 'POST',
      url: '/populate',
      body: [{
        name: 'lets_eat_dev_api',
        listen: '0.0.0.0:8666',
        upstream: 'host.docker.internal:3999',
        enabled: true,
      }],
    },
    {
      method: 'DELETE',
      url: '/proxies/lets_eat_dev_api/toxics/latency_upstream',
      body: undefined,
    },
    {
      method: 'DELETE',
      url: '/proxies/lets_eat_dev_api/toxics/latency_downstream',
      body: undefined,
    },
  ]);
  assert.match(result.stdout, /已关闭人为延迟；端口 3002 继续透明转发到 API 3999/);
});

test('status reports the active upstream and downstream latency without changing it', async (context) => {
  const requests = [];
  const server = createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      name: 'lets_eat_dev_api',
      listen: '0.0.0.0:8666',
      upstream: 'host.docker.internal:3001',
      enabled: true,
      toxics: [
        {
          name: 'latency_upstream',
          type: 'latency',
          stream: 'upstream',
          attributes: { latency: 1200, jitter: 300 },
        },
        {
          name: 'latency_downstream',
          type: 'latency',
          stream: 'downstream',
          attributes: { latency: 1200, jitter: 300 },
        },
      ],
    }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fake server did not expose a TCP port');

  const result = await runCli(['status'], {
    TOXIPROXY_API_URL: `http://127.0.0.1:${address.port}`,
    TOXIPROXY_SKIP_DOCKER: '1',
  });

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(requests, [{
    method: 'GET',
    url: '/proxies/lets_eat_dev_api',
  }]);
  assert.match(result.stdout, /延迟已开启/);
  assert.match(result.stdout, /上行：1200ms ± 300ms/);
  assert.match(result.stdout, /下行：1200ms ± 300ms/);
});

function runCli(args, extraEnvironment) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: projectRoot,
      env: { ...process.env, ...extraEnvironment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
