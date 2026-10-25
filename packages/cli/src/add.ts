// `mografy add`: one command for everything optional. A name is either a reference film, copied into
// the library as a project of its own, or a helper (extra), copied into a project. Several helpers
// can be added at once, and a folder or project may follow the names.
import { addExtra, EXTRAS, extrasList, printAdd } from './extras.js';
import { copyExample, examplesList, listExamples, printExample } from './examples.js';

export type AddKind = 'film' | 'helper';
export interface AddPlan { films: string[]; helpers: string[]; target?: string }

/** What `mografy install-command` suggests next: [arguments, why]. Films first, then helpers for a project. */
const SUGGESTED: [string, string][] = [
  ['film-starter', 'Start a new film from the 20 s model: one camera, one shot table, one light to follow'],
  ['mografy-montage', 'Copy a 60 s reference film to watch and study'],
  ['music cjk', 'In a project: the score generator, Chinese and Japanese type'],
];

export async function addKind(name: string): Promise<AddKind | undefined> {
  if (EXTRAS[name]) return 'helper';
  return (await listExamples()).some(e => e.name === name) ? 'film' : undefined;
}

/** Split `mografy add` arguments into known names and an optional trailing folder or project. */
export async function planAdd(args: string[]): Promise<AddPlan> {
  const plan: AddPlan = { films: [], helpers: [] };
  for (const [i, arg] of args.entries()) {
    const kind = await addKind(arg);
    if (kind === 'film') plan.films.push(arg);
    else if (kind === 'helper') plan.helpers.push(arg);
    else if (i === args.length - 1 && i > 0) plan.target = arg;
    else throw new Error(`Nothing called ${arg} can be added.\n\n${await addList()}`);
  }
  if (plan.films.length && plan.helpers.length || plan.target !== undefined && plan.films.length > 1)
    throw new Error('Add reference films and helpers separately; a folder can follow one film:\n  mografy add <film> [folder]\n  mografy add <helper...> [project]');
  return plan;
}

export async function addList() {
  return [
    'Reference films, copied into your library as a new project:',
    await examplesList(),
    '',
    'Helpers, copied into the current project or the one you name:',
    extrasList(),
    '',
    'Usage:',
    '  mografy add <film> [folder]',
    '  mografy add <helper...> [project]   for example: mografy add music cjk',
  ].join('\n');
}

/** Run a plan. `project` resolves the project helpers go into (the target, or the implicit project). */
export async function runAdd(plan: AddPlan, workspaceRoot: string, project: (target?: string) => Promise<string>, force = false) {
  for (const [i, name] of plan.films.entries()) {
    if (i) console.log('');
    printExample(name, await copyExample(name, plan.target));
  }
  if (!plan.helpers.length) return;
  const dir = await project(plan.target);
  for (const [i, name] of plan.helpers.entries()) {
    if (i) console.log('');
    printAdd(name, dir, await addExtra(workspaceRoot, dir, name, force));
  }
}

export async function addSuggestions() {
  const films = new Set((await listExamples()).map(e => e.name));
  const rows = SUGGESTED.filter(([args]) => args.split(' ').every(name => EXTRAS[name] || films.has(name)));
  if (!rows.length) return '';
  const all: [string, string][] = [...rows.map(([args, why]): [string, string] => [`mografy add ${args}`, why]), ['mografy add', 'List every reference film and helper']];
  const width = Math.max(...all.map(([command]) => command.length));
  return `\n\nNext, add what your films need:\n${all.map(([command, why]) => `  ${command.padEnd(width)}  ${why}`).join('\n')}`;
}
