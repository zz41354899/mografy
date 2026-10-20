# Configuration

Most people never need these settings. A default installation creates projects in the checkout's `projects/` folder and works without any configuration.

## The mografy command

`install-command` installs a launcher into a writable PATH directory. When run inside a Mografy checkout or its subfolders, the command uses that checkout's build, even if the PATH launcher was installed by an older clone. An unbuilt checkout reports the required install/build commands. Outside a checkout, it uses the installation that created the launcher. The launcher itself finds the checkout each time it runs: if the installing checkout was moved or deleted, it still works from inside any other checkout, and outside one it prints the single repair command (`node packages/cli/bin/mografy.js install-command`, run from your Mografy folder) instead of a Node stack trace. It uses `node` from PATH, so upgrading Node does not break it. Run `mografy update --check` to check the installation selected by the launcher, or `mografy update` to update it and restart its active player. The command prints the checkout path and revision. Older installations need a one-time `git pull --ff-only` and `pnpm install` after stopping the player. The updater handles shared Skill synchronization automatically.

Inside the source checkout, `mografy dev` opens the current project when the folder contains `mografy.json`, otherwise the last project used by that installation. First launch opens Stagger text and initializes the sixteen independent built-in animations. Outside the checkout, pass a project path or run the command from a folder containing `mografy.json`.

## Where projects live

Source installations create projects under `projects/` by default. Set `MOGRAFY_HOME` to choose another library directory. The Projects panel switches between projects and built-in animations in the same player.

All paths are resolved on your computer. Explicit project arguments resolve from the terminal's current folder; exports go to that project's `renders/`. To keep new animations in your own library:

```sh
export MOGRAFY_HOME="$HOME/Animations"
mografy dev
```

Each installation keeps its own recent-project and active-player state under `~/.mografy/installations/`.

## Environment variables

| Environment variable | Purpose |
| --- | --- |
| `MOGRAFY_HOME` | Project library directory |
| `MOGRAFY_PROJECT` | Default project when no path is passed; explicit paths take priority |
| `MOGRAFY_STATE` | State directory; using the same override across installations shares their history and active player |
| `MOGRAFY_FFMPEG` | FFmpeg executable override; otherwise use the bundled binary, then `ffmpeg` on PATH |
