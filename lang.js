// lang.js：拆行与取值
export function parsedOf(text) {
  if (typeof text !== "string") return null;
  const tokens = text.split(" ");
  const verb = tokens[0];
  if (verb === "put" || verb === "copy") {
    if (tokens.length !== 3) return null;
    return { verb: verb, args: [tokens[1], tokens[2]] };
  }
  if (verb === "show") {
    if (tokens.length !== 2) return null;
    return { verb: verb, args: [tokens[1]] };
  }
  return null;
}

export function pickOf(vars, key) {
  if (!Array.isArray(vars)) return null;
  for (const row of vars) {
    if (Array.isArray(row) && row[0] === key) return row[1];
  }
  return null;
}
