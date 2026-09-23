export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export const WHITESPACE_LEDGER =
  "Legend: \\t = TAB, \\s = SPACE, \\r = CR, [U+XXXX] = other whitespace";

export function renderWhitespace(line: string): string {
  let output = "";
  for (const ch of line) {
    if (ch === "\t") {
      output += "\\t";
    } else if (ch === " ") {
      output += "\\s";
    } else if (ch === "\r") {
      output += "\\r";
    } else if (/\s/.test(ch)) {
      const code = ch.codePointAt(0);
      output += `[U+${(code ?? 0).toString(16).toUpperCase().padStart(4, "0")}]`;
    } else {
      output += ch;
    }
  }
  return output;
}
