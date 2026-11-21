// `mografy mcp` speaks MCP over stdio: handshake, tool list, a tool that needs no Chromium, and errors as tool results.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = resolve(fileURLToPath(import.meta.url), '../../bin/mografy.js');

test('mografy mcp answers the MCP handshake, lists its tools and reports tool errors as results', async () => {
  const child = spawn(process.execPath, [BIN, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, MOGRAFY_CHECKOUT_CHECKED: '1' } });
  let buffer = '', next = 0;
  const waiting = new Map<number, (message: { result?: any; error?: any }) => void>();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    for (let i; (i = buffer.indexOf('\n')) >= 0;) {
      const message = JSON.parse(buffer.slice(0, i)); buffer = buffer.slice(i + 1);
      waiting.get(message.id)?.(message);
    }
  });
  const request = (method: string, params: unknown = {}) => new Promise<{ result?: any; error?: any }>(done => {
    const id = ++next; waiting.set(id, done);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
  try {
    const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'mografy');
    assert.ok(init.result.capabilities.tools);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const names = (await request('tools/list')).result.tools.map((tool: { name: string }) => tool.name);
    for (const name of ['list_projects', 'project_info', 'check', 'render_frame', 'review', 'read_source', 'write_source', 'export', 'read_guide']) assert.ok(names.includes(name), name);

    const guide = await request('tools/call', { name: 'read_guide', arguments: { topic: 'taste' } });
    assert.match(guide.result.content[0].text, /^# Default taste/);
    const missing = await request('tools/call', { name: 'check', arguments: { project: '/definitely/not/a/project' } });
    assert.equal(missing.result.isError, true);
    assert.match(missing.result.content[0].text, /not a Mografy project/);
    assert.equal((await request('nope/method')).error.code, -32601);

  } finally {
    child.stdin.end();
    await new Promise(done => child.once('close', done));
  }
});
