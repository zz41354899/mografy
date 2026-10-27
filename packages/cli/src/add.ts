// `mografy add`: one command for everything optional. A name is either a reference film, copied into
// the library as a project of its own, a helper (extra), or a template from Mografy Templates, both copied into a
// project. Several helpers and templates can be added at once, and a folder or project may follow the names.
import { addExtra, EXTRAS, extrasList, printAdd } from './extras.js';
import { copyExample, examplesList, listExamples, printExample } from './examples.js';
import { addTemplate, isTemplate, listTemplates, printTemplate, printTemplatesDone, ROOT, templateProject, templatesList } from './templates.js';

export type AddKind = 'film' | 'helper' | 'template';
export interface AddPlan { films: string[]; helpers: string[]; templates?: string[]; target?: string }

/** What `mografy install-command` suggests next: [arguments, why]. Films first, then helpers for a project. */
const SUGGESTED: [string, string][] = [
  ['hook-impact cta-endcard projects/my-post', 'Start a 9:16 post from Mografy Templates (creates the project)'],
  ['film-starter', 'Start a new film from the 20 s model: one camera, one shot table, one light to follow'],
  ['mografy-montage', 'Copy a 60 s reference film to watch and study'],
  ['music cjk', 'In a project: the score generator, Chinese and Japanese type'],
];

export async function addKind(name: string): Promise<AddKind | undefined> {
  if (EXTRAS[name]) return 'helper';
  if ((await listExamples()).some(e => e.name === name)) return 'film';
  return await isTemplate(ROOT, name) ? 'template' : undefined;
}

/** Split `mografy add` arguments into known names and an optional trailing folder or project. */
export async function planAdd(args: string[]): Promise<AddPlan> {
  const plan: AddPlan = { films: [], helpers: [] };
  const templates: string[] = [];
  for (const [i, arg] of args.entries()) {
    const kind = await addKind(arg);
    if (kind === 'film') plan.films.push(arg);
    else if (kind === 'helper') plan.helpers.push(arg);
    else if (kind === 'template') templates.push(arg);
    else if (i === args.length - 1 && i > 0) plan.target = arg;
    else throw new Error(`Nothing called ${arg} can be added.\n\n${await addList()}`);
  }
  if (templates.length) plan.templates = templates;
  if (plan.films.length && (plan.helpers.length || templates.length) || plan.target !== undefined && plan.films.length > 1)
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
    'Mografy Templates, ready-made templates copied into the current project or the one you name:',
    await templatesList(),
    '',
    'Usage:',
    '  mografy add <film> [folder]',
    '  mografy add <helper...> [project]   for example: mografy add music cjk',
    '  mografy add <template...> [project]     for example: mografy add hook-impact cta-endcard projects/my-film',
    '                                      (a missing project is created for the templates)',
  ].join('\n');
}

/**
 * Run a plan. `target` resolves where helpers and templates go: the named folder, or the current project, or undefined
 * when there is none. Helpers need an existing project. Templates create one when the folder has no project yet (in the
 * library, named after the first template, when no folder was named), so a missing project is never an error for templates
 * and nothing is ever added silently to another, last-opened project.
 */
export async function runAdd(plan: AddPlan, workspaceRoot: string, target: (name?: string) => Promise<string | undefined>, force = false,
  isProject: (dir: string) => Promise<boolean> = async () => true) {
  for (const [i, name] of plan.films.entries()) {
    if (i) console.log('');
    printExample(name, await copyExample(name, plan.target));
  }
  const templates = plan.templates ?? [];
  if (!plan.helpers.length && !templates.length) return;
  let dir = await target(plan.target), created = false;
  if (templates.length) ({ dir, created } = await templateProject(workspaceRoot, dir, templates));
  if (!dir || !await isProject(dir)) {
    const named = plan.target ?? 'projects/<name>';
    throw new Error(`${dir ? `${dir} has no mografy.json` : 'This folder is not a Mografy project'}, so there is nowhere to add ${plan.helpers.join(', ')}.\n`
      + `  Name the project:   mografy add ${plan.helpers.join(' ')} ${named}\n`
      + `  Or start one from templates, which creates the project: mografy add hook-impact ${named}`);
  }
  for (const [i, name] of plan.helpers.entries()) {
    if (i) console.log('');
    printAdd(name, dir, await addExtra(workspaceRoot, dir, name, force));
  }
  if (!templates.length) return;
  if (plan.helpers.length) console.log('');
  console.log(`Adding ${templates.length === 1 ? 'a template' : `${templates.length} templates`}:`);
  for (const id of templates) await printTemplate(workspaceRoot, id, dir, await addTemplate(workspaceRoot, dir, id, force));
  const all = await listTemplates(workspaceRoot), aspect = all.find(s => s.id === templates[0])!.aspect;
  printTemplatesDone(dir, templates, created, aspect, created ? templates.filter(id => all.find(s => s.id === id)!.aspect !== aspect) : []);
}

export async function addSuggestions() {
  const films = new Set((await listExamples()).map(e => e.name)), templates = new Set((await listTemplates(ROOT)).map(t => t.id));
  // Every name must exist in this installation; a trailing folder (projects/…) is not a name.
  const rows = SUGGESTED.filter(([args]) => args.split(' ').filter(name => !name.includes('/')).every(name => EXTRAS[name] || films.has(name) || templates.has(name)));
  if (!rows.length) return '';
  const all: [string, string][] = [...rows.map(([args, why]): [string, string] => [`mografy add ${args}`, why]), ['mografy add', 'List every template, reference film and helper']];
  const width = Math.max(...all.map(([command]) => command.length));
  return `\n\nNext, add what your films need:\n${all.map(([command, why]) => `  ${command.padEnd(width)}  ${why}`).join('\n')}`;
}
