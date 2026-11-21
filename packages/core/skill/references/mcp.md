# The Mografy MCP tools

`mografy mcp` runs a local MCP server over stdio, so an agent can make and check films through tool calls instead of a shell. Connect it once:

```sh
claude mcp add mografy -- mografy mcp
codex mcp add mografy -- mografy mcp
```

Every tool takes `project`: an absolute folder, or a folder name from `list_projects`; it defaults to `MOGRAFY_PROJECT` or the current folder. While the player has the project open, the tools work through the player, so the user sees each change there; otherwise the server opens the project itself and rebuilds it from disk before each call.

## Tools and their commands

| Tool | Command | Use it to |
| --- | --- | --- |
| `list_projects` | (the player's project list) | Find a project's folder; `include_builtin` adds the sixteen component projects |
| `project_info` | (the player's inspector) | Read size, duration, shots, tempo, source files, params, settings and the last build error |
| `create_project` | (the player's New project) | Start a project from the starter scene; `aspect_ratio: "9:16"` for a portrait film. Then write `style.md`, the scene, and check it |
| `read_source` | (read the files) | Read the scene entry and every file of its current build |
| `write_source` | (edit the files) | Replace scene files. They are compiled and trial-rendered first and written only if that passes; a failure returns the error and changes nothing |
| `check` | `mografy check [--motion]` | Shot table, tempo, frame cost, `style.md`; `motion: true` adds the jump, hard start and hard stop scan |
| `render_frame` | (none; `mografy review` writes sheets) | Look at one moment as a PNG; `kind: "output"` is the exported frame, `"raw"` the scene at exactly that time |
| `review` | `mografy review` | Write the stop-frame and transition sheets to `renders/` and return them as images |
| `open_player` | `mografy dev` | Show the project in the player, or switch the open player to it |
| `export` | `mografy export` | Write a file to `renders/` (only when the user asks for one); `format`, `preset`, `codec`, `orientation`, `output` |
| `read_guide` | (this Skill) | Read `SKILL.md` or a reference, when the Skill is not installed for the host |

## How to work with them

- Read the guide first: when the host has not installed this Skill, call `read_guide` (no topic) before writing a scene, then the references its table names.
- Change scenes with `write_source` even when you also have file access, when you want the change checked before it lands. Send each file whole.
- After every `write_source`, run `check` and fix its warnings; before delivery run `check` with `motion: true` and `review`, and look at every sheet it returns.
- Never send `scenes/timeline.json` through `write_source`: it holds the user's edits from the editor (see [layers.md](layers.md)). `mografy.json` is settings, not source.
- `export` blocks until the file is written and reports progress; cancelling the call cancels the export.
