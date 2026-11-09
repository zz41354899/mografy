// `mografy --help`.

export const VERSION = '0.1.0';

/** Help text, grouped by what the user is doing. Brand colour only on an interactive terminal. */
export function helpText(color: boolean) {
  const paint = (code: string) => (text: string) => color ? `\x1b[${code}m${text}\x1b[0m` : text;
  const teal = paint('38;2;18;181;165'), bold = paint('1'), dim = paint('2');
  const row = (command: string, description: string) => `    ${command.padEnd(37)}${dim(description)}`;
  const section = (title: string, rows: string[]) => `  ${bold(title)}\n${rows.join('\n')}`;
  return [
    `  ${teal('●')} ${bold('Mografy')} ${dim(VERSION)}\n  ${dim('Local Canvas animation for Claude Code and Codex. Claude creates. Mografy shows.')}`,
    section('Start', [
      row('mografy dev', 'Open the player: built-in animations and your projects'),
      row('mografy dev <project>', 'Open a project in the player'),
    ]),
    section('Review and export', [
      row('mografy check <project>', 'Compile and trial-render in Chromium'),
      row('mografy check --motion <project>', 'Also find jumps, hard starts and hard stops'),
      row('mografy review <project>', 'Create visual-review sheets in renders/'),
      row('mografy export <project>', 'Export MP4, WebM, Lottie or SVGA'),
      row('mografy export <project> <project>...', 'Batch export: each project in turn, same options'),
      row('mografy export --all [folder]', 'Batch export every project in the folder (default: projects folder)'),
    ]),
    section('Add', [
      row('mografy add', 'List the reference films, helpers and templates you can add'),
      row('mografy add <film> [folder]', 'Copy a reference film into your library (showcase films are downloaded)'),
      row('mografy add <helper...> [project]', 'Add helpers to a project: cinema, cjk, three, music, walkthrough, stage'),
      row('mografy add <template...> [project]', 'Add Mografy Templates: hooks, captions, screens, end cards (9:16 and 16:9)'),
      row('', '--force replaces helper and template files you changed'),
    ]),
    section('Manage', [
      row('mografy stop [project]', "Stop a project's player"),
      row('mografy update [--check]', 'Update Mografy, or only check for updates'),
      row('mografy install-command', 'Put the mografy command on PATH'),
    ]),
    section('Export options', [
      row('--format <mp4|webm|mov|lottie|svga|html>', 'Output format (default: mp4); mov is ProRes; html writes a presentation file'),
      row('--preset <share|high|fast|master>', 'share: H.264, plays everywhere · high: H.265 10-bit · fast: hardware H.265 · master: ProRes MOV'),
      row('-o, --output <file>', 'File name, or a path inside renders/'),
      row('--orientation <landscape|portrait>', 'MP4/WebM/MOV at 16:9 or 9:16, fitting the whole scene'),
      row('--codec <h265|h264>', 'MP4 video codec (default: h265, about half the size; h264 plays everywhere)'),
      row('--resolution <720p|1080p>', 'MP4/WebM/MOV size (default with orientation: 720p)'),
      row('--workers <1-8|auto>', 'Frames drawn in parallel; 1 uses the least memory (about 1.3 GB each at 1080p)'),
      row('--cancel', "Cancel the project's current export"),
    ]),
    section('Player and review options', [
      row('--port <port>', 'Player port (default: 4173, then the next free port)'),
      row('--no-open', 'Start the player without opening a browser'),
      row('--video <file>', 'Video to compare against during review'),
    ]),
    `  ${teal('→')} ${dim('New animation: describe it to Claude Code or Codex in this folder.')}\n    ${dim('The agent creates the project and the player switches to it.')}`,
  ].join('\n\n');
}

export const HELP = helpText(false);
