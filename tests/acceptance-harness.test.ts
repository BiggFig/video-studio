import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { confinedPath } from "../scripts/acceptance-deployed";

test("acceptance source and credential files remain inside their designated ignored directories", () => {
  const base = resolve(".local/deployed-acceptance/inputs");
  assert.equal(confinedPath(base, "product/screen.png"), resolve(base, "product/screen.png"));
  for (const path of ["..", "../.env.local", "../../outside", resolve(".env.local")]) assert.throws(() => confinedPath(base, path));
});
