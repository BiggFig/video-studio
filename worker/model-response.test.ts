import test from "node:test";
import assert from "node:assert/strict";
import {parseModelJson} from "./model-response";
import {parseReview} from "./quality";

test("plain JSON and one complete fenced JSON document preserve the exact data",()=>{
 const value={sufficientEvidence:true,visuals:[{assetId:"real",supportsFactIds:["fact-1"]}]};
 for(const raw of [JSON.stringify(value),`\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\`\n`,`The region at visuals[0] uses the same source.\n\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``])assert.deepEqual(parseModelJson(raw),value);
});
test("ambiguous, incomplete and mixed responses are rejected without guessing",()=>{
 for(const raw of ['Text before {"ok":true}', '```json\n{"ok":true}', '```json\n{"ok":true}\n```\nMore text', '```json\n{}\n```\n```json\n{}\n```', '```javascript\n({ok:true})\n```', '```json\n{} {}\n```'])assert.throws(()=>parseModelJson(raw));
});
test("a valid JSON prefix followed by another fenced document is always ambiguous",()=>{
 for(const prefix of ['{}','[]','null','true','0','"first answer"','{"sufficientEvidence":false}']) {
  const raw=` \n${prefix}\n\n\`\`\`json\n{"sufficientEvidence":true}\n\`\`\``;
  assert.throws(()=>parseModelJson(raw),/Multiple JSON responses are ambiguous/);
 }
});
test("wrapper handling never normalizes booleans or waives blocking findings",()=>{
 const value={readabilityPassed:true,claimsPassed:true,realVisualsPassed:true,renderIntegrityPassed:true,referenceStyleReviewed:true,referenceStylePassed:true,audioTranscriptPassed:true,notes:[],findings:[{severity:"major",check:"readability",message:"Essential heading is absent.",evidence:"Scene 1 hold lacks the planned heading."}]};
 const parsed=parseModelJson(`Commentary is not evidence.\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``);
 assert.throws(()=>parseReview(parsed),/contradicts/);
 assert.equal((parseModelJson('{"readabilityPassed":"true"}') as {readabilityPassed:unknown}).readabilityPassed,"true");
});
