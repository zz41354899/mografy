// Explicit installation of the editable built-in library.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TEMPLATE_DIR, libraryDir } from './installation.js';
import { createProject, ensureAgentFiles, isProject } from './project-scaffold.js';
import { seedComponentThumbnail } from './component-thumbnails.js';

export const COMPONENT_PRESETS = [
  { id: 'stagger-text', name: 'Stagger text' },
  { id: 'typewriter', name: 'Typewriter' },
  { id: 'pop-card', name: 'Pop card' },
  { id: 'progress-bar', name: 'Progress bar' },
  { id: 'pulse-dots', name: 'Pulse dots' },
  { id: 'logo-reveal', name: 'Logo reveal' },
  { id: 'social-card', name: 'Social card' },
  { id: 'youtube-subscribe', name: 'YouTube subscribe' },
  { id: 'ai-chat', name: 'AI chat' },
  { id: 'like-burst', name: 'Like burst' },
  { id: 'follow-badge', name: 'Follow badge' },
  { id: 'notification-toast', name: 'Notification toast' },
  { id: 'lower-third', name: 'Lower third' },
  { id: 'count-up', name: 'Count up' },
  { id: 'toggle-switch', name: 'Toggle switch' },
  { id: 'audio-wave', name: 'Audio wave' },
] as const;
export const componentRoot = () => join(libraryDir(), '.components');
export const DEFAULT_PROJECT = () => join(componentRoot(), COMPONENT_PRESETS[0].id);

const componentCreations = new Map<string, Promise<string>>();
const readyComponents = new Set<string>();
async function ensureComponentProject(preset: typeof COMPONENT_PRESETS[number]) {
  const dir = join(componentRoot(), preset.id);
  if (readyComponents.has(dir) && await isProject(dir)) return dir;
  let creation = componentCreations.get(dir);
  if (!creation) {
    creation = (async () => {
    try {
      if (await isProject(dir)) await ensureAgentFiles(dir);
      else await createProject(dir, preset.name, await readFile(join(TEMPLATE_DIR, 'scenes', `${preset.id}.ts`), 'utf8'), '9:16');
      await seedComponentThumbnail(dir, preset.id);
      readyComponents.add(dir);
      return dir;
    }
    finally { componentCreations.delete(dir); }
    })();
    componentCreations.set(dir, creation);
  }
  return creation;
}
/** Independently editable and exportable animations, installed with Mografy. */
export const ensureComponentProjects = () => Promise.all(COMPONENT_PRESETS.map(ensureComponentProject));
export async function ensureComponentsProject() { return (await ensureComponentProjects())[0]!; }

