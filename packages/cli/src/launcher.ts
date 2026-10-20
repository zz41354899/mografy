// The `mografy` command that `mografy install-command` puts on PATH.
// It finds Mografy when it runs instead of trusting paths saved at install time, so moving,
// renaming or deleting the checkout it was installed from, or upgrading Node, cannot break it.

/** Quote a value for POSIX sh (single quotes; embedded quotes become '\''). */
export function shQuote(value: string) {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * POSIX sh launcher. Order of preference:
 * 1. the Mografy checkout that contains the current folder (walking up, like bin/mografy.js);
 * 2. the checkout this launcher was installed from, if it still exists;
 * otherwise a clear message with the one command that repairs it.
 * Node is `node` on PATH, falling back to the Node that ran the installation.
 */
export function launcherScript(installedBin: string, installedNode: string) {
  return `#!/bin/sh
# Mografy launcher (created by \`mografy install-command\`).
# It looks for Mografy each time it runs, so a moved or deleted checkout or a Node upgrade
# does not break it. Reinstall from any checkout: node packages/cli/bin/mografy.js install-command
installed_bin=${shQuote(installedBin)}
installed_node=${shQuote(installedNode)}

bin=''
dir=$PWD
while [ -n "$dir" ]; do
  if [ -f "$dir/pnpm-workspace.yaml" ] && [ -f "$dir/packages/cli/bin/mografy.js" ] && grep -q '"mografy-workspace"' "$dir/package.json" 2>/dev/null; then
    bin="$dir/packages/cli/bin/mografy.js"
    break
  fi
  [ "$dir" = / ] && break
  dir=$(dirname "$dir")
done
if [ -z "$bin" ] && [ -f "$installed_bin" ]; then
  bin=$installed_bin
fi
if [ -z "$bin" ]; then
  echo "mografy: the Mografy folder this command was installed from no longer exists:" >&2
  echo "  $installed_bin" >&2
  echo "Run mografy from inside your Mografy folder, or repair this command once from there:" >&2
  echo "  node packages/cli/bin/mografy.js install-command" >&2
  exit 1
fi

node=$(command -v node 2>/dev/null || true)
if [ -z "$node" ] && [ -x "$installed_node" ]; then
  node=$installed_node
fi
if [ -z "$node" ]; then
  echo "mografy: Node.js was not found on PATH. Install Node.js 22.12 or newer." >&2
  exit 1
fi
exec "$node" "$bin" "$@"
`;
}
