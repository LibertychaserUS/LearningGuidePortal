// The room shows a Tutor answer as plain text, but KnowledgeSystem answers in
// markdown and the server passes it on verbatim (2026-10-23). The room drops
// the markdown it cannot render (headings, rules, code ticks, emphasis) when
// it shows the line, and turns list marks into "• ". The answer's length and
// content stay KS's; nothing is cut here.

// Emphasis markers only count at a word boundary: `x_1`, `snake_case_name`
// and `2*3*4` keep their `_` and `*` (QA 2026-10-19 M22). A word character
// here is an ASCII letter or digit, so CJK text around **重点** still loses
// its markers.
const EDGE_BEFORE = "(^|[^A-Za-z0-9])";
const EDGE_AFTER = "(?![A-Za-z0-9])";
function emphasis(marker: string) {
  const mark = marker.replace(/\*/g, "\\*");
  const body = marker[0] === "*" ? "[^*\\n]" : "[^_\\n]";
  return new RegExp(`${EDGE_BEFORE}${mark}(?=\\S)(${body}*?\\S)${mark}${EDGE_AFTER}`, "g");
}
const EMPHASIS = [emphasis("**"), emphasis("__"), emphasis("*"), emphasis("_")];

export function plainTutorReply(raw: string): string {
  let cleaned = raw
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/`([^`\n]*)`/g, "$1")
    .replace(/`/g, "");
  for (const pattern of EMPHASIS) cleaned = cleaned.replace(pattern, "$1$2");
  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:[-*]\s+|•\s*)/, "• "))
    .join("\n");
}
