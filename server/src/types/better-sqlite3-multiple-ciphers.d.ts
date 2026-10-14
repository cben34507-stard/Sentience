// better-sqlite3-multiple-ciphers is a drop-in fork of better-sqlite3 (plus
// encryption pragmas). Its bundled typings aren't reachable through its
// package "exports", so reuse the upstream better-sqlite3 types.
declare module "better-sqlite3-multiple-ciphers" {
  import Database = require("better-sqlite3");
  export = Database;
}
