import test from "node:test";
import assert from "node:assert/strict";
import { APIError } from "@vercel/sandbox";
import { dispatchErrorSummary } from "../lib/server/dispatch-error";

test("Sandbox rejection retains only launch stage, HTTP status and machine code", () => {
  const error = new APIError(new Response(null, { status: 400, headers: { authorization: "Bearer header-secret" } }), {
    message: "provider-secret", text: "raw-response-secret",
    json: { error: { code: "invalid_network_policy", message: "body-secret" }, credential: "credential-secret" },
  });
  assert.equal(error.name, "Error", "The installed SDK does not identify API errors through Error.name");
  assert.deepEqual(dispatchErrorSummary(error, "allocation"), {
    stage: "allocation", type: "SandboxAPIError", httpStatus: 400, code: "invalid_network_policy",
  });
  assert.doesNotMatch(JSON.stringify(dispatchErrorSummary(error, "allocation")), /secret|authorization/);
});

test("malformed provider code cannot become log content", () => {
  for (const code of ["Bearer private-token", "code\nsecret", "https://provider.invalid?token=secret", "x".repeat(81), { secret: "value" }, null]) {
    const error = new APIError(new Response(null, { status: 503 }), { json: { error: { code } } });
    assert.deepEqual(dispatchErrorSummary(error, "source_upload"), { stage: "source_upload", type: "SandboxAPIError", httpStatus: 503 });
  }
});

test("invalid JSON-shaped errors still preserve safe status without raw text", () => {
  for (const json of [undefined, null, "secret", { error: "secret" }, { error: { message: "secret" } }]) {
    const error = new APIError(new Response(null, { status: 502 }), { json, text: "secret" });
    assert.deepEqual(dispatchErrorSummary(error, "command_start"), { stage: "command_start", type: "SandboxAPIError", httpStatus: 502 });
  }
});

test("non-Sandbox failures cannot leak messages or arbitrary error objects", () => {
  const failure = new Error("database-connection-secret");
  assert.deepEqual(dispatchErrorSummary(failure, "runtime_checkpoint"), { stage: "runtime_checkpoint", type: "Error" });
  failure.name = "Bearer secret";
  assert.deepEqual(dispatchErrorSummary(failure, "input_preparation"), { stage: "input_preparation", type: "Error" });
  assert.deepEqual(dispatchErrorSummary({ message: "secret", code: "secret" }, "lease_refresh"), { stage: "lease_refresh", type: "Unknown" });
});
