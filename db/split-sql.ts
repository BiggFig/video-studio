// Keep PL/pgSQL dollar-quoted function bodies intact for the HTTP driver's
// transactional batch protocol (which allows one statement per query).
export function splitSql(source: string): string[] {
  const statements: string[] = [];
  let start = 0, quoted = false, dollar = false, comment = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i], next = source[i + 1];
    if (comment) { if (char === "\n") comment = false; continue; }
    if (!quoted && !dollar && char === "-" && next === "-") { comment = true; i++; continue; }
    if (!quoted && char === "$" && next === "$") { dollar = !dollar; i++; continue; }
    if (!dollar && char === "'") { if (quoted && next === "'") { i++; continue; } quoted = !quoted; continue; }
    if (!dollar && !quoted && char === ";") { const statement = source.slice(start, i).trim(); if (statement) statements.push(statement); start = i + 1; }
  }
  const final = source.slice(start).trim(); if (final) statements.push(final);
  return statements;
}
