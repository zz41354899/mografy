// The MCP setup the player's settings offer: one prompt to paste into Claude Code or Codex, with this installation's
// real folder and command filled in, plus the same steps as single commands for people who set it up by hand.

export interface McpTarget { folder: string; workspace: boolean; bin: string }

const GUIDE = 'https://www.mografy.app/docs/mcp';
/** JSON and shells on Windows both accept forward slashes; backslashes would need escaping in the config. */
const slashes = (path: string) => path.replace(/\\/g, '/');
const quote = (path: string) => /[\s"]/.test(path) ? JSON.stringify(path) : path;

export function mcpCommands(target: McpTarget, windows: boolean) {
  const folder = slashes(target.folder), npx = windows ? 'cmd /c npx' : 'npx';
  return {
    claude: `cd ${quote(folder)} && claude mcp add mografy -- ${npx} -y mografy mcp`,
    codex: `codex mcp add mografy --env MOGRAFY_WORKSPACE=${quote(folder)} -- ${npx} -y mografy mcp`,
    desktop: JSON.stringify({ mcpServers: { mografy: { command: '<full path of node>', args: [slashes(target.bin), 'mcp'], env: { MOGRAFY_WORKSPACE: folder } } } }, null, 2),
  };
}

export function mcpSetupPrompt(target: McpTarget, windows: boolean) {
  const folder = slashes(target.folder), bin = slashes(target.bin);
  const kind = target.workspace
    ? `My Mografy workspace is ${folder} (it has mografy.workspace.json, and Mografy is installed in node_modules/mografy).`
    : `My Mografy folder is ${folder}.`;
  const check = target.workspace ? 'If it has no mografy.workspace.json, stop and tell me.' : 'If the folder does not exist, stop and tell me.';
  return `Set up the Mografy MCP server for me. Guide: ${GUIDE}

${kind}

1. Work in that folder. ${check}
2. Add the server to yourself:
   - Claude Code: claude mcp add mografy -- npx -y mografy mcp (run it in that folder)
   - Codex: codex mcp add mografy --env MOGRAFY_WORKSPACE="${folder}" -- npx -y mografy mcp
${windows ? '   This is Windows: put cmd /c in front of npx.\n' : ''}3. Ask me whether I also use Claude Desktop. If I do, back up claude_desktop_config.json, then add a "mografy" server and keep the others: command = the full path of node (node -p process.execPath), args = ["${bin}", "mcp"], env MOGRAFY_WORKSPACE = "${folder}". Then tell me to restart Claude Desktop.
4. Check that mografy is connected: call list_projects.${target.workspace ? ` It should list ${folder}/projects.` : ''}

Do not change Mografy itself. If a step fails, tell me the error.`;
}
