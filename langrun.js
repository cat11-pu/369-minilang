// langrun.js：按处理预算处理并留账，收尾把账做完
import { parsedOf, pickOf } from "./lang.js";

const CODES = {
  line: "E_BAD_LINE",
  key: "E_BAD_KEY",
  value: "E_BAD_VALUE",
  source: "E_NO_SOURCE",
  target: "E_NO_TARGET",
  event: "E_BAD_EVENT"
};
const KEY_RE = /^[a-z]$/;
const NUM_RE = /^(0|[1-9][0-9]*)$/;

function codeOf(spec, name) {
  const mapped = {
    line: spec && spec.bad_line_code,
    key: spec && spec.bad_key_code,
    value: spec && spec.bad_value_code,
    source: spec && spec.no_source_code,
    target: spec && spec.no_target_code,
    event: spec && spec.event_error_code
  }[name];
  return typeof mapped === "string" && mapped ? mapped : CODES[name];
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function signatureOf(event) {
  return [event.kind, event.text];
}

function freshState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    fail(CODES.event, "invalid state");
  }
  return {
    vars: Array.isArray(state.vars)
      ? state.vars.map(function (row) { return [row[0], row[1]]; })
      : [],
    out: Array.isArray(state.out)
      ? state.out.map(function (row) { return [row[0], row[1]]; })
      : [],
    ledger: Array.isArray(state.ledger)
      ? state.ledger.map(function (row) { return [row[0], row[1]]; })
      : [],
    applied: Array.isArray(state.applied)
      ? state.applied.map(function (row) { return [row[0], row[1]]; })
      : []
  };
}

function isRun(event) {
  return Boolean(event) && typeof event === "object" && !Array.isArray(event)
    && event.kind === "run" && typeof event.text === "string";
}

function applyOne(event, st, spec) {
  const parsed = parsedOf(event.text);
  if (parsed === null) fail(codeOf(spec, "line"), "unrecognized line");
  const verb = parsed.verb;
  const args = parsed.args;

  if (verb === "put") {
    if (!KEY_RE.test(args[0])) fail(codeOf(spec, "key"), "bad key");
    if (!NUM_RE.test(args[1])) fail(codeOf(spec, "value"), "bad value");
    const value = Number(args[1]);
    let index = -1;
    for (let i = 0; i < st.vars.length; i += 1) {
      if (st.vars[i][0] === args[0]) { index = i; break; }
    }
    if (index === -1) {
      st.vars.push([args[0], value]);
      st.vars.sort(function (x, y) { return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0; });
    } else {
      st.vars[index][1] = value;
    }
    return;
  }

  if (verb === "copy") {
    if (!KEY_RE.test(args[0]) || !KEY_RE.test(args[1])) fail(codeOf(spec, "key"), "bad key");
    const sourceValue = pickOf(st.vars, args[1]);
    if (sourceValue === null) fail(codeOf(spec, "source"), "source key not registered");
    let index = -1;
    for (let i = 0; i < st.vars.length; i += 1) {
      if (st.vars[i][0] === args[0]) { index = i; break; }
    }
    if (index === -1) {
      st.vars.push([args[0], sourceValue]);
      st.vars.sort(function (x, y) { return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0; });
    } else {
      st.vars[index][1] = sourceValue;
    }
    return;
  }

  if (!KEY_RE.test(args[0])) fail(codeOf(spec, "key"), "bad key");
  const targetValue = pickOf(st.vars, args[0]);
  if (targetValue === null) fail(codeOf(spec, "target"), "target key not registered");
  st.out.push([args[0], targetValue]);
}

export function step(spec) {
  spec = spec && typeof spec === "object" ? spec : {};
  const st = freshState(spec.state);
  const events = Array.isArray(spec.events) ? spec.events : [];
  const rawBudget = Number(spec.budget);
  const budget = Number.isFinite(rawBudget) && rawBudget > 0
    ? Math.floor(rawBudget) : 0;

  const done = new Set(st.applied.map(function (row) { return row[0] + "\u0000" + row[1]; }));
  const queue = st.ledger.map(function (row) {
    return { kind: row[0], text: row[1], carried: true };
  }).concat(events.map(function (event) {
    if (!isRun(event)) fail(codeOf(spec, "event"), "invalid event");
    return { kind: event.kind, text: event.text, carried: false };
  }));

  let remaining = budget;
  let served = 0;
  let judged = 0;
  const ledger = [];

  for (const item of queue) {
    const sig = item.kind + "\u0000" + item.text;
    if (done.has(sig)) continue;
    judged += 1;
    if (remaining <= 0) {
      ledger.push([item.kind, item.text]);
      continue;
    }
    applyOne(item, st, spec);
    remaining -= 1;
    served += 1;
    st.applied.push([item.kind, item.text]);
    done.add(sig);
  }

  st.ledger = ledger;
  const judgedBound = queue.length;
  return {
    state: st,
    served: served,
    ledger_before: ledger.length,
    ledger: ledger.map(function (row) { return [row[0], row[1]]; }),
    judged: judged,
    judged_bound: judgedBound
  };
}

export function close(spec) {
  spec = spec && typeof spec === "object" ? spec : {};
  const st = freshState(spec.state);
  const pending = st.ledger;
  st.ledger = [];
  const done = new Set(st.applied.map(function (row) { return row[0] + "\u0000" + row[1]; }));

  let catchup = 0;
  for (const row of pending) {
    const event = { kind: row[0], text: row[1] };
    if (!isRun(event)) fail(codeOf(spec, "event"), "invalid event");
    const sig = row[0] + "\u0000" + row[1];
    if (done.has(sig)) continue;
    applyOne(event, st, spec);
    catchup += 1;
    st.applied.push([row[0], row[1]]);
    done.add(sig);
  }

  return { state: st, catchup: catchup };
}
