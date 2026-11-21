# The `mografy` npm package

A second way to install Mografy, for people who only make films: `npm install -g mografy`. The source checkout
(README, Get started) stays the way to work on Mografy itself, and both can live on one computer: inside a checkout
installed on this computer, the package's `mografy` command runs that checkout instead.

## What is in it

`apps/cli/pack.mjs` assembles the package from a built checkout:

| Path | Contents |
| --- | --- |
| `bin/mografy.js` | The command |
| `lib/node_modules/@mografy/*` | The six workspace packages, vendored as built: `dist/` without sourcemaps, plus the server's built-in components and previews, the CLI's `bin/`, and the player's `web/dist` |
| `examples/` | `catalog.json` and the intro film; the Stage films download on demand |

npm installs the third-party dependencies beside them (esbuild, protobufjs, ws, zod). There is no install script and no
browser library: Mografy drives Chromium over the DevTools Protocol and renders in the Chrome or Edge already on the
computer (or Playwright's headless shell, when one is installed). FFmpeg downloads the first time a video export needs
it, into `~/.mografy/tools`; the headless shell downloads (through `npx playwright-core`, into Playwright's browser
folder) only on a computer with no Chromium at all. Both are shared by every installation; `mografy setup` fetches
them ahead of time. Templates,
helpers and Stage films download from GitHub at the release tag `v<version>`, falling back to `main`.

The packages are vendored under `lib/node_modules` rather than declared as `bundleDependencies`: a global npm install
of a package with bundled dependencies installs every platform's optional esbuild binary (about 280 MB).

`installation` in `@mografy/server` recognises the layout (`kind: 'package'`): projects go to `~/Mografy`,
`mografy update` checks the npm registry and prints the `npm install -g` command, and `mografy install-command` is
not needed.

The package carries no agent Skill. Users install it once with `npx skills add mografy/mografy -g` (the skills CLI
reads `.agents/skills/mografy` from GitHub, which `pnpm build` regenerates in the checkout) and update it with
`npx skills update`. `mografy dev` prints that command when neither the project nor the home folder has a Skill.

## Check it

```sh
pnpm build
pnpm pack:cli        # apps/cli/dist/mografy-<version>.tgz, with its packed and unpacked size; fails above 12 MB
pnpm test:package    # pack, npm install -g into a temporary prefix, run version, setup --check, add and check
```

`packages/cli/tests/package.test.ts` (part of `pnpm check`) checks what the tarball contains.

## Release

1. Set `version` in `apps/cli/package.json` (`0.2.0-beta.1` for a beta).
2. `pnpm build && pnpm check && pnpm test:package`.
3. Tag the commit `v<version>` and push the tag, so the package's downloads find matching files.
4. `npm publish apps/cli/dist/mografy-<version>.tgz --tag beta` (or `--tag latest` for a release). A pre-release
   version checks the `beta` tag in `mografy update`, a release the `latest` tag.
