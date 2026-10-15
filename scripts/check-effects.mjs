// Fails if a React effect uses an expression body (`useEffect(() => foo(), …)`).
// Whatever the expression returns becomes the effect's cleanup; newer browsers
// return Promises from APIs like scrollTo, and React then crashes on unmount
// with "x is not a function". Always use a block body.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../web/src");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const bad = [];
for (const f of walk(root).filter((f) => /\.tsx?$/.test(f))) {
  fs.readFileSync(f, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/use(Layout|Insertion)?Effect\(\s*(async\s*)?\([^)]*\)\s*=>\s*[^\s{]/.test(line)) bad.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim()}`);
      if (/use(Layout|Insertion)?Effect\(\s*async\b/.test(line)) bad.push(`${path.relative(process.cwd(), f)}:${i + 1}: async effect returns a Promise`);
    });
}
if (bad.length) {
  console.error("Effects must use a block body so they never return a non-function:\n" + bad.join("\n"));
  process.exit(1);
}
console.log("effects ok");
