import * as std from "std";
globalThis.std = std;

std.loadScript("modules/base.js");

const input = scriptArgs[1];
if (!input) {
  console.error("usage: qjs tools/minify.js <file.js>");
  std.exit(1);
}

const code = std.loadFile(input);
if (code === null) {
  console.error("cannot read: " + input);
  std.exit(1);
}

const result = JSON.parse(minifyJs(code));
if (!result.ok) {
  console.error("minify failed: " + result.error);
  std.exit(1);
}

const output = input.replace(/\.js$/i, "") + ".min.js";
const f = std.open(output, "w");
if (!f) {
  console.error("cannot open for write: " + output);
  std.exit(1);
}
f.puts(result.data);
f.close();
console.log("written: " + output + " (" + result.data.length + " bytes)");