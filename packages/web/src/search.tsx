// Matching shared by the projects panel and the spotlight: how well a label answers a query, and the label with
// the matched text marked.

/** Loose match: every typed character appears in order, so "lpc" finds lunar-pop-club. */
export function fuzzy(text: string, query: string) {
  let i = 0;
  for (const ch of text.toLowerCase()) { if (ch === query[i]) i++; if (i === query.length) return true; }
  return i === query.length;
}
/** The start of the label, then the start of a word, then anywhere, then loosely; 0 is no match. */
export function score(text: string, query: string) {
  const s = text.toLowerCase(), at = s.indexOf(query);
  if (at === 0) return 4;
  if (at > 0) return /[\s\-_(·/]/.test(s[at - 1]!) ? 3 : 2;
  return fuzzy(s, query) ? 1 : 0;
}
/** The label with the characters a query matched in a <mark>. */
export function marked(text: string, query: string) {
  if (!query) return text;
  const at = text.toLowerCase().indexOf(query);
  if (at >= 0) return <>{text.slice(0, at)}<mark>{text.slice(at, at + query.length)}</mark>{text.slice(at + query.length)}</>;
  let i = 0;
  return [...text].map((ch, k) => { const hit = i < query.length && ch.toLowerCase() === query[i]; if (hit) i++; return hit ? <mark key={k}>{ch}</mark> : ch; });
}
