// Run the Python compression tests with whichever Python this machine has; Windows often has no `python3`.
import { spawnSync } from 'node:child_process';

const args = ['-B', '-m', 'unittest', 'discover', '-s', 'scripts/tests', '-p', 'test_*.py'];
const candidates = [['python3'], ['python'], ['py', '-3']];
const available = candidates.find(([command, ...flags]) => spawnSync(command, [...flags, '--version'], { stdio: 'ignore' }).status === 0);
if (!available) { console.error('Python 3 was not found. Install it to run the compression tests.'); process.exit(1); }
const [command, ...flags] = available;
const { status } = spawnSync(command, [...flags, ...args], { stdio: 'inherit' });
process.exit(status ?? 1);
