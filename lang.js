// lang.js：拆行与取值
const KEY_RE = /^[a-z]$/;
const INT_RE = /^(0|[1-9][0-9]*)$/;

export function isKey(token) {
  return typeof token === "string" && KEY_RE.test(token);
}

export function isNonNegInt(token) {
  return typeof token === "string" && INT_RE.test(token);
}

// 把一行按空格拆成动词与参数；动词不认识或记号个数对不上给空
export function parsedOf(text) {
  if (typeof text !== "string") return null;
  const tokens = text.split(" ");
  const verb = tokens[0];
  if (verb === "put" && tokens.length === 3) {
    return { verb: "put", args: [tokens[1], tokens[2]] };
  }
  if (verb === "copy" && tokens.length === 3) {
    return { verb: "copy", args: [tokens[1], tokens[2]] };
  }
  if (verb === "show" && tokens.length === 2) {
    return { verb: "show", args: [tokens[1]] };
  }
  return null;
}

// 取变量表里某个键的当前值；没登记给空
export function pickOf(vars, key) {
  if (!Array.isArray(vars)) return null;
  for (const row of vars) {
    if (Array.isArray(row) && row[0] === key) return row[1];
  }
  return null;
}
