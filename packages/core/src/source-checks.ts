// Static checks on scene source.


export interface SceneSourceIssue { line: number; rule: string; message: string }
const forbidden: [RegExp, string, string][] = [
  [/\bMath\.random\b/, 'unseeded-random', 'Math.random is not reproducible. Use ctx.random() in setup or ctx.noise() per frame.'],
  [/\bDate\.now\b|\bnew\s+Date\s*\(/, 'clock', 'Scenes cannot read the clock. Use the t passed to renderFrame.'],
  [/\bperformance\.now\b/, 'clock', 'Scenes cannot read the clock. Use the t passed to renderFrame.'],
  [/\b(requestAnimationFrame|setTimeout|setInterval)\s*\(/, 'async-timer', 'Scenes cannot schedule work. The picture comes only from renderFrame(t).'],
  [/\bcrypto\.getRandomValues\b|\brandomUUID\b/, 'unseeded-random', 'Unseeded randomness is not reproducible. Use ctx.noise().'],
];
/** Heuristic lint only. It does not prove renderFrame is pure; runtime guards and render comparisons do the rest. */
export function checkSceneSource(source: string): SceneSourceIssue[] {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const issues: SceneSourceIssue[] = [];
  stripped.split('\n').forEach((text, index) => {
    for (const [pattern, rule, message] of forbidden) if (pattern.test(text)) issues.push({ line: index + 1, rule, message });
  });
  return issues;
}
