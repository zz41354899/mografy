// Small display helpers shared by the editor's panels.

/** Film time as m:ss.s, for shots, layers and the spotlight. */
export const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
/** Elapsed or remaining time as m:ss, for export progress. */
export const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** The last part of a path, on any platform. */
export const basename = (path: string) => path.split(/[\\/]/).pop() || path;
/** URL of a project file served by the editor, from its absolute path. */
export const projectFileUrl = (projectDir: string, file: string) =>
  `/__mografy/files/${file.slice(projectDir.length + 1).split(/[\\/]/).map(encodeURIComponent).join('/')}`;
