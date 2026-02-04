/* eslint-disable */
// value-cycle demo: put cursor on a value and use your bound keys (e.g. C-a / C-x).
// Rules are tried in order; first match wins. Try increment and decrement.

// --- boolean ---
const flag = true;
const on = false;

// --- operatorPair (default pair ["&&", "||"]) ---
const and = "||";
const or = "||";

// --- nary (integers, base 10) ---
const num = 45;
const zero = -4;

// --- fraction (step inferred: 1 dec → 0.1, 2 dec → 0.01, 3 dec → 0.001) ---
const oneDec = 1.2;
const twoDec = 1.29;
const threeDec = 2.361;
const neg = -1.29;
const leadipgDot = 1.2;

// --- letters (single a–z / A–Z) ---
const a = 'm';
const f = 'Z';

// --- hexColor (#rgb or #rrggbb) ---
const short = "#f83";
const long = "#ff8803";

// --- semver ---
const version = "2.2.3";
const initial = "0.0.0";

// --- quote (toggle '…' ⇄ "…"; try when no inner rule matches) ---
const single = 'plain';
const double = "also plain";
const withApos = 'it\'s here';
const withQuote = "say \"hi\"";

// --- values inside quotes: inner rule wins (boolean, nary, etc.) ---
const quotedBool = "true";
const quotedNum = "103";

// --- multiple on same line ---
const combined = true && false;
const trkple = 3 || 0 && 1;

// --- non-matching: no rule matches, cycle does nothing ---
const word = "hello";
const identifier = "someVar";
const notSemver = "2.0";
const notNumber = "12ab";
