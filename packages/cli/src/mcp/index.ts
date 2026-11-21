// `mografy mcp`: a local MCP server on stdio, for agents and apps that speak MCP instead of running the CLI.
// stdout carries only protocol messages, so every log from Mografy's own modules goes to stderr while it runs.
import { VERSION } from '../commands/help.js';
import { Hosts } from './hosts.js';
import { PROTOCOL_VERSIONS, serveStdio } from './rpc.js';
import { tools } from './tools.js';

const INSTRUCTIONS = `Mografy makes Canvas animations as TypeScript scene modules drawn as a pure function of time.
Before writing or changing a scene, read the Mografy Skill (read_guide, or the installed mografy Skill) and follow its hard rules.
After every scene change run check (motion: true before delivery) and review, and look at the images it returns.
Export only when the user asks for a file.`;

export async function runMcp() {
  const write = process.stdout.write.bind(process.stdout);
  const toStderr = (...values: unknown[]) => { process.stderr.write(values.map(v => typeof v === 'string' ? v : String(v)).join(' ') + '\n'); };
  console.log = toStderr; console.info = toStderr; console.debug = toStderr;
  // Anything else that writes to stdout would corrupt the protocol stream.
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => process.stderr.write(chunk, ...rest as [])) as typeof process.stdout.write;

  const hosts = new Hosts();
  const list = tools(hosts);
  const byName = new Map(list.map(tool => [tool.name, tool]));
  const stop = () => { void hosts.close().finally(() => process.exit(0)); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);

  await serveStdio({
    initialize: ({ protocolVersion }) => ({
      protocolVersion: protocolVersion && PROTOCOL_VERSIONS.includes(protocolVersion) ? protocolVersion : PROTOCOL_VERSIONS[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'mografy', title: 'Mografy', version: VERSION },
      instructions: INSTRUCTIONS,
    }),
    listTools: () => ({ tools: list.map(({ run: _run, ...tool }) => tool) }),
    async callTool(name, args, context) {
      const tool = byName.get(name);
      if (!tool) return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
      try { return await tool.run(args, context); }
      catch (error) { return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true }; }
    },
    close: () => hosts.close(),
  }, line => { write(line); });
  process.exit(0);
}
