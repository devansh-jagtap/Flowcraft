const COMMENT = /^\s*(#|\/\/)/;

export interface SourceLine {
  /** 1-based line number in the original text. */
  line: number;
  indent: number;
  text: string;
}

/** Non-empty, non-comment lines with their indentation (a tab counts as 4 spaces). */
export function sourceLines(source: string): SourceLine[] {
  const result: SourceLine[] = [];
  source.split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim() || COMMENT.test(raw)) return;
    const leading = raw.match(/^[\t ]*/)![0];
    result.push({ line: index + 1, indent: leading.replace(/\t/g, '    ').length, text: raw.trim() });
  });
  return result;
}

/** Splits "text: label" on the first colon followed by a space, so "9:30" stays intact. */
export function splitLabel(text: string): [string, string | undefined] {
  const match = text.match(/:\s+(.+)$/);
  if (!match || match.index === undefined) return [text, undefined];
  return [text.slice(0, match.index).trim(), match[1].trim()];
}

/** Reads a trailing "(tag)" such as "Roll no (key)". */
export function splitTag(text: string): [string, string | undefined] {
  const match = text.match(/\s*\(([^()]+)\)\s*$/);
  if (!match || match.index === undefined || match.index === 0) return [text, undefined];
  return [text.slice(0, match.index).trim(), match[1].trim().toLowerCase()];
}
