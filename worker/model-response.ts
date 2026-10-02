/** Parse one complete JSON document; a sole fenced document may have prose before it. */
export function parseModelJson(raw: string): unknown {
  const text=raw.trim();
  try{return JSON.parse(text);}catch{}
  // No substring/bracket guessing, multiple alternatives or incomplete blocks.
  // Outside prose is discarded as commentary, never promoted to source evidence.
  const fences=[...text.matchAll(/```/g)];
  if(fences.length!==2)throw new Error("Expected one complete JSON response");
  let prefixIsJson=false;
  try { JSON.parse(text.slice(0,fences[0].index).trim()); prefixIsJson=true; } catch {}
  if(prefixIsJson)throw new Error("Multiple JSON responses are ambiguous");
  const block=text.slice(fences[0].index).match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i);
  if(!block)throw new Error("Expected one complete fenced JSON response");
  return JSON.parse(block[1]);
}
