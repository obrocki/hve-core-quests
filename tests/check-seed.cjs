const fs = require("fs");
const path = require("path");
const { parse } = require("pgsql-ast-parser");
const seed = fs.readFileSync(path.join(__dirname, "..", "app", "db", "002-seed.sql"), "utf8");
const statements = parse(seed);
if (statements.length !== 2 || statements.some(statement => statement.type !== "insert")) {
  throw new Error("Expected two syntactically valid seed INSERT statements.");
}
console.log("PostgreSQL seed syntax parsed.");
