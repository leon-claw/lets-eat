#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const PROXY_NAME = 'lets_eat_dev_api';
const PROXY_LISTEN = '0.0.0.0:8666';
const CONTROL_URL = (process.env.TOXIPROXY_API_URL ?? 'http://127.0.0.1:8474').replace(/\/$/, '');
const API_PORT = process.env.API_PORT ?? '3001';
const TOXIC_NAMES = ['latency_upstream', 'latency_downstream'];

async function main() {
  const action = process.argv[2];
  if (action === 'status') {
    await showStatus();
    return;
  }
  if (action !== 'on' && action !== 'off') throw new Error('操作必须是 on、off 或 status');
  const actionArguments = process.argv.slice(3);
  if (actionArguments[0] === '--') actionArguments.shift();
  const latency = action === 'on' ? readMilliseconds(actionArguments[0], 1200, '延迟') : 0;
  const jitter = action === 'on' ? readMilliseconds(actionArguments[1], 300, '抖动') : 0;

  startToxiproxy();
  await waitForToxiproxy();
  await request('/populate', {
    method: 'POST',
    body: [{
      name: PROXY_NAME,
      listen: PROXY_LISTEN,
      upstream: `host.docker.internal:${API_PORT}`,
      enabled: true,
    }],
  });
  await removeLatencyToxics();
  if (action === 'off') {
    console.log(`[latency] 已关闭人为延迟；端口 3002 继续透明转发到 API ${API_PORT}`);
    return;
  }
  await addLatencyToxic('upstream', latency, jitter);
  await addLatencyToxic('downstream', latency, jitter);
  console.log(`[latency] 已开启双向延迟：${latency}ms ± ${jitter}ms`);
  console.log('[latency] 小程序调试地址：http://<当前电脑局域网 IP>:3002');
}

async function showStatus() {
  let proxy;
  try {
    proxy = await request(`/proxies/${PROXY_NAME}`);
  } catch (cause) {
    if (cause instanceof TypeError) {
      console.log('[latency] Toxiproxy 未运行，端口 3002 当前不可用');
      return;
    }
    throw cause;
  }
  const latencyToxics = Array.isArray(proxy?.toxics)
    ? proxy.toxics.filter((toxic) => toxic?.type === 'latency')
    : [];
  if (latencyToxics.length === 0) {
    console.log('[latency] 人为延迟已关闭；端口 3002 正在透明转发');
    return;
  }
  console.log('[latency] 延迟已开启');
  for (const stream of ['upstream', 'downstream']) {
    const toxic = latencyToxics.find((candidate) => candidate.stream === stream);
    if (!toxic) continue;
    const label = stream === 'upstream' ? '上行' : '下行';
    console.log(`[latency] ${label}：${toxic.attributes?.latency ?? 0}ms ± ${toxic.attributes?.jitter ?? 0}ms`);
  }
}

function startToxiproxy() {
  if (process.env.TOXIPROXY_SKIP_DOCKER === '1') return;
  const result = spawnSync('docker', ['compose', '--profile', 'latency', 'up', '-d', 'toxiproxy'], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Toxiproxy Docker 服务启动失败');
}

async function waitForToxiproxy() {
  let lastCause;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await request('/version');
      return;
    } catch (cause) {
      lastCause = cause;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
    }
  }
  throw new Error(`Toxiproxy 管理接口未就绪：${formatCause(lastCause)}`);
}

async function removeLatencyToxics() {
  for (const toxicName of TOXIC_NAMES) {
    await request(`/proxies/${PROXY_NAME}/toxics/${toxicName}`, {
      method: 'DELETE',
      allowNotFound: true,
    });
  }
}

async function addLatencyToxic(stream, latency, jitter) {
  await request(`/proxies/${PROXY_NAME}/toxics`, {
    method: 'POST',
    body: {
      name: `latency_${stream}`,
      type: 'latency',
      stream,
      toxicity: 1,
      attributes: { latency, jitter },
    },
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${CONTROL_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (response.status === 404 && options.allowNotFound) return undefined;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Toxiproxy 请求失败（${response.status}）：${detail || path}`);
  }
  if (response.status === 204) return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

function readMilliseconds(raw, defaultValue, label) {
  const value = raw === undefined ? defaultValue : Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label}必须是大于等于 0 的整数毫秒值`);
  return value;
}

function formatCause(cause) {
  return cause instanceof Error ? cause.message : String(cause ?? '未知错误');
}

main().catch((cause) => {
  console.error(`[latency] 错误：${formatCause(cause)}`);
  process.exitCode = 1;
});
