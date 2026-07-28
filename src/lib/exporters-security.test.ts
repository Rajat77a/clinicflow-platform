import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./exporters.ts", import.meta.url), "utf8");

test("print exports never reinterpret sanitized text as executable HTML", () => {
  assert.doesNotMatch(source, /document\.write|\.innerHTML\s*=|DOMParser/);
  assert.match(source, /DOMPurify\.sanitize\(html,/);
  assert.match(source, /RETURN_DOM_FRAGMENT: true/);
  assert.match(source, /style\.textContent\s*=/);
  assert.match(source, /document\.importNode\(safeContent, true\)/);
  assert.match(source, /addEventListener\("load", \(\) => w\.print\(\), \{ once: true \}\)/);
});
