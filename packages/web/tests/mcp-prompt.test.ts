import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mcpCommands, mcpSetupPrompt } from '../src/mcp-prompt.js';

const ws = { folder: '/Users/me/Desktop/mografy', workspace: true, bin: '/Users/me/Desktop/mografy/node_modules/mografy/bin/mografy.js' };

test('the MCP prompt names the real workspace, its projects and the Desktop command', () => {
  const prompt = mcpSetupPrompt(ws, false);
  assert.match(prompt, /My Mografy workspace is \/Users\/me\/Desktop\/mografy \(it has mografy\.workspace\.json/);
  assert.match(prompt, /MOGRAFY_WORKSPACE="\/Users\/me\/Desktop\/mografy"/);
  assert.match(prompt, /args = \["\/Users\/me\/Desktop\/mografy\/node_modules\/mografy\/bin\/mografy\.js", "mcp"\]/);
  assert.match(prompt, /It should list \/Users\/me\/Desktop\/mografy\/projects\./);
  assert.doesNotMatch(prompt, /cmd \/c/);
  assert.doesNotMatch(prompt, /<|>/, 'no placeholders left');
});

test('on Windows the prompt and commands use cmd /c and forward slashes', () => {
  const win = { folder: 'C:\\Users\\me\\Desktop\\my mografy', workspace: true, bin: 'C:\\Users\\me\\Desktop\\my mografy\\node_modules\\mografy\\bin\\mografy.js' };
  assert.match(mcpSetupPrompt(win, true), /put cmd \/c in front of npx/);
  const commands = mcpCommands(win, true);
  assert.equal(commands.claude, 'cd "C:/Users/me/Desktop/my mografy" && claude mcp add mografy -- cmd /c npx -y mografy mcp');
  assert.match(commands.codex, /--env MOGRAFY_WORKSPACE="C:\/Users\/me\/Desktop\/my mografy" -- cmd \/c npx/);
  assert.equal(JSON.parse(commands.desktop).mcpServers.mografy.args[0], 'C:/Users/me/Desktop/my mografy/node_modules/mografy/bin/mografy.js');
});

test('a folder that is not a workspace (a checkout, or an older project) still gets a working prompt', () => {
  const prompt = mcpSetupPrompt({ folder: '/src/mografy', workspace: false, bin: '/src/mografy/packages/cli/bin/mografy.js' }, false);
  assert.match(prompt, /My Mografy folder is \/src\/mografy\./);
  assert.doesNotMatch(prompt, /workspace\.json|should list/);
});
