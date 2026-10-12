const invalidResponse = () => new Error("Expected one unambiguous complete JSON response");
const jsonScalar = "(?:true|false|null|-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?)";
const scalarAlternative = new RegExp(`^${jsonScalar}(?=$|[\\s,;:])|[:=]\\s*${jsonScalar}\\s*$`);

/** Commentary may introduce data, but cannot contain another possible JSON root. */
function assertPlainPrefix(raw: string): void {
  const prefix = raw.trim();
  if (!/^\p{L}/u.test(prefix) || /[{}\[\]"]|```/.test(prefix)) throw invalidResponse();
  for (const line of prefix.split(/\r?\n/)) {
    // Reject standalone or labelled scalar answers such as "Previous: null".
    // Numbered prose like "1. Explain the correction" is not a JSON number.
    if (scalarAlternative.test(line.trim())) throw invalidResponse();
  }
}

/** Decode transport wrappers only; never repair JSON or alter its fields. */
export function decodeModelJson(raw: string): unknown {
  const text = raw.trim();
  try { return JSON.parse(text); } catch {}

  // The complete fenced payload must parse. Prose after its closing fence,
  // multiple blocks and malformed/partial content cannot be silently discarded.
  const fenced = text.match(/^([\s\S]*?)```(?:json)?[ \t]*\r?\n([\s\S]*)\r?\n```$/i);
  if (fenced) {
    if (fenced[1].trim()) assertPlainPrefix(fenced[1]);
    return JSON.parse(fenced[2]);
  }

  // The first object opener is the only candidate. JSON.parse must consume the
  // entire remainder, including any suffix; do not search for a later valid
  // object or a balanced fragment inside an incomplete/ambiguous response.
  const start = text.indexOf("{");
  if (start <= 0) throw invalidResponse();
  assertPlainPrefix(text.slice(0, start));
  return JSON.parse(text.slice(start));
}
