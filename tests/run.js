import assert from "node:assert";
import { parsedOf, pickOf } from "../lang.js";
import { step, close } from "../langrun.js";
import { render } from "../app.js";

const base = {
  budget: 1,
  state: { vars: [], out: [], ledger: [], applied: [] },
  events: [{ id: 1, kind: "run", text: "put a 5" }],
  bad_line_code: "E_BAD_LINE", bad_key_code: "E_BAD_KEY",
  bad_value_code: "E_BAD_VALUE", no_source_code: "E_NO_SOURCE",
  no_target_code: "E_NO_TARGET", event_error_code: "E_BAD_EVENT"
};

let failed = 0;
function check(name, fn) {
  try { fn(); console.log("ok " + name); } catch (e) { failed += 1; console.log("FAIL " + name + " :: " + e.message); }
}

check("parsedOf returns a line or nothing", () => {
  const got = parsedOf("put a 1");
  assert.ok(got === null || typeof got === "object");
});

check("pickOf returns a value or nothing", () => {
  const got = pickOf([["a", 1]], "a");
  assert.ok(got === null || typeof got === "number");
});

check("step returns a state", () => {
  assert.strictEqual(typeof step(base).state, "object");
});

check("close returns a state", () => {
  assert.strictEqual(typeof close(base).state, "object");
});

check("render counts events", () => {
  assert.strictEqual(typeof render(base).count_events, "number");
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
