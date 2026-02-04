import * as vscode from 'vscode';

const T = (t) => String(t).trim();
const reEscape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const opt = (r, key, def) => r?.options?.[key] ?? def;

const base = (r) => Math.min(36, Math.max(2, Number(opt(r, 'base', 10))));
const nary = {
  pattern: (r) => (base(r) <= 10 ? '(?<![-.])\\d+(?!\\.\\d)' : `[0-9a-${String.fromCharCode(86 + base(r))}]+`),
  match: (t, r) => /^[0-9a-z]+$/i.test(T(t)) && !Number.isNaN(parseInt(T(t), base(r))),
  step: (t, delta, r) => { const n = parseInt(T(t), base(r)); return Number.isNaN(n) ? t : (n + delta).toString(base(r)); }
};

const fraction = {
  pattern: /-?\d*\.?\d+/,
  match: (t) => /^-?\d*\.?\d+$/.test(T(t)),
  step: (t, delta, r) => {
    const s = T(t);
    const n = Number(s);
    if (Number.isNaN(n)) return t;
    const explicitStep = opt(r, 'step');
    const decimals = (s.split('.')[1] || '').length;
    const step = explicitStep !== undefined ? Number(explicitStep) : (decimals ? 10 ** -decimals : 1);
    const next = n + delta * step;
    const rounded = decimals ? Math.round(next * 10 ** decimals) / 10 ** decimals : Math.round(next);
    return decimals ? rounded.toFixed(decimals) : String(rounded);
  }
};

const pair = (r) => opt(r, 'pair', []);
const pairList = {
  pattern: (r) => (pair(r).length === 2 ? pair(r).map(reEscape).join('|') : '(?!)'),
  match: (t, r) => pair(r).includes(T(t)),
  step: (t, _, r) => { const [a, b] = pair(r); const s = T(t); return s === a ? b : a; }
};

const list = (r) => opt(r, 'list', []);
const constants = {
  pattern: (r) => (list(r).length ? list(r).map(reEscape).join('|') : '(?!)'),
  match: (t, r) => list(r).includes(T(t)),
  step: (t, delta, r) => { const arr = list(r); const i = arr.indexOf(T(t)); return i === -1 ? t : arr[(i + delta + arr.length) % arr.length]; }
};

const letter = (t, delta) => {
  const c = T(t)[0];
  if (!c) return t;
  const b = c.charCodeAt(0) >= 97 ? 97 : 65;
  return String.fromCharCode(b + ((c.charCodeAt(0) - b + delta + 26) % 26));
};

const hex = (t, delta) => {
  const s = T(t).replace(/^#/, '');
  const len = s.length === 3 ? 3 : 6;
  let n = parseInt(s, 16);
  if (Number.isNaN(n)) return t;
  if (len === 3) n = (n & 0xf) | ((n >> 4 & 0xf) << 4) | ((n >> 8 & 0xf) << 8);
  n = (n + delta + (len === 3 ? 0xfff : 0xffffff) + 1) % (len === 3 ? 0x1000 : 0x1000000);
  return len === 3 ? '#' + [(n >> 8) & 0xf, (n >> 4) & 0xf, n & 0xf].map(d => d.toString(16)).join('') : '#' + n.toString(16).padStart(6, '0');
};

const seg = (r) => ({ major: 0, minor: 1, patch: 2 }[(opt(r, 'segment', 'patch')).toLowerCase()] ?? 2);
const semver = {
  pattern: /\d+\.\d+\.\d+/,
  match: (t) => /^\d+\.\d+\.\d+$/.test(T(t)),
  step: (t, delta, r) => {
    const parts = T(t).split('.').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return t;
    const idx = seg(r);
    parts[idx] = Math.max(0, parts[idx] + delta);
    if (idx < 2) parts[1] = Math.max(0, parts[1]);
    if (idx < 1) parts[0] = Math.max(0, parts[0]);
    return parts.join('.');
  }
};

const quotePattern = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/;
const quote = {
  pattern: quotePattern,
  match: (t) => quotePattern.test(T(t)),
  step: (t) => {
    const s = T(t);
    const quoteChar = s[0];
    const inner = s.slice(1, -1);
    const content = inner.replace(/\\(.)/g, (_, c) => c);
    const other = quoteChar === "'" ? '"' : "'";
    const escaped = content.replace(/\\/g, '\\\\').replace(new RegExp(other, 'g'), '\\' + other);
    return other + escaped + other;
  }
};

const HANDLERS = {
  boolean: {
    pattern: /\b(?:true|false)\b/,
    match: (t) => /^(?:true|false)$/.test(T(t)),
    step: (t) => (T(t).toLowerCase() === 'false' ? 'true' : 'false')
  },
  operatorPair: { ...pairList },
  quote: { ...quote },
  nary: { ...nary },
  fraction: { ...fraction },
  constants: { ...constants },
  letters: {
    pattern: /\b[a-z]\b/i,
    match: (t) => /^[a-z]$/i.test(T(t)),
    step: (t, delta) => letter(t, delta)
  },
  hexColor: {
    pattern: /#(?:[0-9a-fA-F]{3}){1,2}\b/,
    match: (t) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(T(t)),
    step: (t, delta) => hex(t, delta)
  },
  semver: { ...semver }
};

const ruleApplies = (r, ctx) =>
  !r.when || ((!r.when.languageId?.length || r.when.languageId.includes(ctx.languageId)) && (!r.when.visualOnly || ctx.visualOnly));

/** @param {object[]} rules @param {{ languageId: string, visualOnly: boolean }} ctx */
export const filterRules = (rules, ctx) => (rules ?? []).filter((r) => ruleApplies(r, ctx));

/** @param {string} text @param {object[]} rules @returns {{ rule: object, type: string } | null} */
export const applyRules = (text, rules) => {
  const rule = rules.find((r) => HANDLERS[r.type]?.match(text, r));
  return rule ? { rule, type: rule.type } : null;
};

/** @param {{ rule: object, type: string }} match @param {string} text @param {string} direction @param {number} count */
export const transform = (match, text, direction, count) => {
  const h = HANDLERS[match.type];
  const delta = direction === 'increment' ? (count ?? 1) : -(count ?? 1);
  return h?.step(text, delta, match.rule) ?? text;
};

const patternSource = (rule) => {
  const p = HANDLERS[rule.type]?.pattern;
  const raw = p && (typeof p === 'function' ? p(rule) : p);
  return raw && (typeof raw === 'string' ? raw : raw.source);
};

const preferQuoteOverLetters = (a, b, rules) => {
  const aType = rules[a.i]?.type;
  const bType = rules[b.i]?.type;
  const aContainsB = a.index <= b.index && b.index + b.len <= a.index + a.len;
  const bContainsA = b.index <= a.index && a.index + a.len <= b.index + b.len;
  if (aContainsB && aType === 'quote' && bType === 'letters') return -1;
  if (bContainsA && bType === 'quote' && aType === 'letters') return 1;
  return 0;
};

const matchContainingCursor = (lineText, lineRange, cursor, rules) => {
  const off = cursor.character - lineRange.start.character;
  const hits = rules.flatMap((rule, i) => {
    const src = patternSource(rule);
    if (!src) return [];
    return [...lineText.matchAll(new RegExp(src, 'g'))]
      .filter(m => m.index <= off && off < m.index + m[0].length)
      .map(m => ({ index: m.index, len: m[0].length, i }));
  });
  if (!hits.length) return null;
  hits.sort((a, b) => preferQuoteOverLetters(a, b, rules) || (a.index === b.index ? b.len - a.len : a.len - b.len) || a.i - b.i);
  const { index, len } = hits[0];
  const start = lineRange.start.translate(0, index);
  return new vscode.Range(start, start.translate(0, len));
};

const firstMatchAfter = (lineText, lineRange, cursor, rules) => {
  const off = cursor.character - lineRange.start.character;
  const hits = rules.flatMap((rule, i) => {
    const src = patternSource(rule);
    if (!src) return [];
    const first = [...lineText.matchAll(new RegExp(src, 'g'))].find(m => m.index >= off);
    return first ? [{ index: first.index, len: first[0].length, i }] : [];
  });
  if (!hits.length) return null;
  hits.sort((a, b) => preferQuoteOverLetters(a, b, rules) || (a.index === b.index ? b.len - a.len : a.len - b.len) || a.index - b.index || a.i - b.i);
  const { index, len } = hits[0];
  const start = lineRange.start.translate(0, index);
  return new vscode.Range(start, start.translate(0, len));
};

const matchesInLine = (lineText, lineRange, rules, sel) => {
  const allHits = rules.flatMap((rule, i) => {
    const src = patternSource(rule);
    if (!src) return [];
    return [...lineText.matchAll(new RegExp(src, 'g'))].map(m => ({ index: m.index, len: m[0].length }));
  });
  const innerOnly = allHits.filter(h => !allHits.some(o => o.index <= h.index && h.index + h.len <= o.index + o.len && o.len > h.len));
  const selR = new vscode.Range(sel.start, sel.end);
  return [...new Map(innerOnly.map(h => [`${h.index},${h.len}`, h])).values()]
    .sort((a, b) => a.index - b.index)
    .map(h => new vscode.Range(lineRange.start.translate(0, h.index), lineRange.start.translate(0, h.index + h.len)))
    .filter(r => r.intersection(selR));
};

const selectionLineRange = (doc, lineNum, sel) => {
  const line = doc.lineAt(lineNum);
  return new vscode.Range(lineNum === sel.start.line ? sel.start : line.range.start, lineNum === sel.end.line ? sel.end : line.range.end);
};

/** @param {import('vscode').TextEditor} editor @param {object[]} rules @param {boolean} hasSelection @param {boolean} global @returns {import('vscode').Range[]} */
export const resolveRanges = (editor, rules, hasSelection, global) => {
  const doc = editor.document;
  const sel = editor.selection;
  const ctx = { languageId: doc.languageId, visualOnly: hasSelection };
  const filtered = filterRules(rules, ctx);
  if (hasSelection && !global) return [new vscode.Range(sel.start, sel.end)];
  if (hasSelection)
    return [...Array(sel.end.line - sel.start.line + 1)].flatMap((_, i) => {
      const lineNum = sel.start.line + i;
      const line = doc.lineAt(lineNum);
      return matchesInLine(doc.getText(line.range), line.range, filtered, selectionLineRange(doc, lineNum, sel));
    });
  const line = doc.lineAt(sel.start.line);
  const lineText = doc.getText(line.range);
  const atCursor = matchContainingCursor(lineText, line.range, sel.start, filtered);
  const next = atCursor ?? firstMatchAfter(lineText, line.range, sel.start, filtered);
  return next ? [next] : [];
};

/** @param {import('vscode').TextEditor} editor @param {{ direction?: string, count?: number, global?: boolean }} options @param {object[]} rules */
export function cycle(editor, options, rules) {
  const { direction = 'increment', count = 1, global = false } = options ?? {};
  const doc = editor.document;
  const ctx = { languageId: doc.languageId, visualOnly: !editor.selection.isEmpty };
  const ranges = resolveRanges(editor, rules, ctx.visualOnly, global);
  if (!ranges.length) return;
  const filtered = filterRules(rules, ctx);
  const cursorBefore = editor.selection.active;
  const edits = ranges
    .map(range => ({ range, text: doc.getText(range) }))
    .map(({ range, text }) => ({ range, text, match: applyRules(text, filtered) }))
    .filter(({ match }) => match)
    .map(({ range, text, match }) => ({ range, text, next: transform(match, text, direction, count) }))
    .filter(({ text, next }) => next !== text);
  const onlyRange = !global && edits.length === 1 ? edits[0].range : null;
  return editor.edit(eb => edits.forEach(({ range, next }) => eb.replace(range, next))).then((success) => {
    if (success && onlyRange && !onlyRange.contains(cursorBefore)) editor.selection = new vscode.Selection(onlyRange.start, onlyRange.start);
  });
}

export { HANDLERS as handlers };
