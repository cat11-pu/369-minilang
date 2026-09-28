// langrun.js：按处理预算处理并留账；收尾不限预算把账做完
import { parsedOf, pickOf, isKey, isNonNegInt } from "./lang.js";

function fail(code, message) {
  const err = new Error(message || code);
  err.code = code;
  throw err;
}

function asPair(entry) {
  if (Array.isArray(entry)) return [entry[0], entry[1]];
  if (entry && typeof entry === "object") return [entry.kind, entry.text];
  return null;
}

function asRows(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(function (row) { return Array.isArray(row) ? [row[0], row[1]] : null; })
    .filter(Boolean);
}

// 复制跨轮状态，绝不改写入参
function cloneState(state) {
  const src = state && typeof state === "object" ? state : {};
  return {
    vars: asRows(src.vars),
    out: asRows(src.out),
    ledger: asRows(src.ledger),
    applied: asRows(src.applied)
  };
}

function stamp(pair) {
  return JSON.stringify(pair);
}

function setVar(vars, key, value) {
  const next = vars.map(function (row) { return [row[0], row[1]]; });
  for (let i = 0; i < next.length; i += 1) {
    if (next[i][0] === key) {
      next[i][1] = value;
      return next;
    }
  }
  next.push([key, value]);
  next.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  return next;
}

// 校验并执行一条已出队的事件
function runOne(pair, state, codes) {
  const kind = pair[0];
  const text = pair[1];
  if (kind !== "run") fail(codes.event_error_code, "E_BAD_EVENT");
  const parsed = parsedOf(text);
  if (parsed === null) fail(codes.bad_line_code, "E_BAD_LINE");
  const verb = parsed.verb;
  const args = parsed.args;
  if (verb === "put") {
    if (!isKey(args[0])) fail(codes.bad_key_code, "E_BAD_KEY");
    if (!isNonNegInt(args[1])) fail(codes.bad_value_code, "E_BAD_VALUE");
    state.vars = setVar(state.vars, args[0], parseInt(args[1], 10));
  } else if (verb === "copy") {
    if (!isKey(args[0]) || !isKey(args[1])) fail(codes.bad_key_code, "E_BAD_KEY");
    if (pickOf(state.vars, args[1]) === null) fail(codes.no_source_code, "E_NO_SOURCE");
    state.vars = setVar(state.vars, args[0], pickOf(state.vars, args[1]));
  } else {
    if (!isKey(args[0])) fail(codes.bad_key_code, "E_BAD_KEY");
    if (pickOf(state.vars, args[0]) === null) fail(codes.no_target_code, "E_NO_TARGET");
    state.out.push([args[0], pickOf(state.vars, args[0])]);
  }
}

function codesOf(spec) {
  return {
    bad_line_code: spec.bad_line_code || "E_BAD_LINE",
    bad_key_code: spec.bad_key_code || "E_BAD_KEY",
    bad_value_code: spec.bad_value_code || "E_BAD_VALUE",
    no_source_code: spec.no_source_code || "E_NO_SOURCE",
    no_target_code: spec.no_target_code || "E_NO_TARGET",
    event_error_code: spec.event_error_code || "E_BAD_EVENT"
  };
}

// 预算用尽时未处理的事件连着压账；旧账排在新事件前面
function plan(spec) {
  const state = cloneState(spec.state);
  const incoming = Array.isArray(spec.events)
    ? spec.events.map(asPair).filter(Boolean) : [];
  const queue = state.ledger.concat(incoming);
  state.ledger = [];
  return { state: state, queue: queue };
}

export function step(spec) {
  const codes = codesOf(spec);
  const planned = plan(spec);
  const state = planned.state;
  const queue = planned.queue;
  let budget = Number(spec.budget);
  if (!Number.isFinite(budget)) budget = 0;
  budget = Math.max(0, Math.floor(budget));

  const seen = {};
  state.applied.forEach(function (pair) { seen[stamp(pair)] = true; });

  let served = 0;
  let judged = 0;
  for (const pair of queue) {
    if (seen[stamp(pair)]) continue;
    if (served >= budget) {
      state.ledger.push(pair);
      continue;
    }
    runOne(pair, state, codes);
    seen[stamp(pair)] = true;
    state.applied.push(pair);
    served += 1;
    judged += 1;
  }
  return {
    state: state,
    served: served,
    ledger_before: state.ledger.length,
    ledger: state.ledger.map(function (row) { return [row[0], row[1]]; }),
    judged: judged,
    judged_bound: queue.length
  };
}

// 不限预算把账做完，返回补齐条数
export function close(spec) {
  const codes = codesOf(spec);
  const state = cloneState(spec.state);
  const seen = {};
  state.applied.forEach(function (pair) { seen[stamp(pair)] = true; });

  let catchup = 0;
  const pending = state.ledger;
  state.ledger = [];
  for (const pair of pending) {
    if (seen[stamp(pair)]) continue;
    runOne(pair, state, codes);
    seen[stamp(pair)] = true;
    state.applied.push(pair);
    catchup += 1;
  }
  return { state: state, catchup: catchup };
}
