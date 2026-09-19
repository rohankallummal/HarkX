// Run: node src/app/skillFile.check.ts
import assert from "node:assert";
// @ts-expect-error -- node needs the .ts extension to run this file directly
import { skillFileError } from "./skillFile.ts";

// Minimal zip with empty stored entries — just enough structure for the central directory.
function zip(names: string[], comment = ""): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const local: number[] = [], dir: number[] = [];
  const u16 = (a: number[], v: number) => a.push(v & 255, v >> 8);
  const u32 = (a: number[], v: number) => { u16(a, v & 0xffff); u16(a, v >>> 16); };
  for (const name of names) {
    const n = [...enc.encode(name)], at = local.length;
    u32(local, 0x04034b50); local.push(...new Array(22).fill(0)); u16(local, n.length); u16(local, 0); local.push(...n);
    u32(dir, 0x02014b50); dir.push(...new Array(24).fill(0)); u16(dir, n.length); dir.push(...new Array(12).fill(0)); u32(dir, at); dir.push(...n);
  }
  const end: number[] = [];
  const c = [...enc.encode(comment)];
  u32(end, 0x06054b50); u32(end, 0); u16(end, names.length); u16(end, names.length);
  u32(end, dir.length); u32(end, local.length); u16(end, c.length); end.push(...c);
  return new Uint8Array([...local, ...dir, ...end]);
}

const check = (bytes: BlobPart, name: string) => skillFileError(new File([bytes], name));

assert.equal(await check("# hi", "SKILL.md"), null);
assert.equal(await check("# hi", "skill.md"), "The file must be named SKILL.md");
assert.equal(await check("# hi", "README.md"), "The file must be named SKILL.md");
assert.equal(await check("x", "notes.txt"), "Only .zip or .md files are allowed");
assert.equal(await check(zip(["SKILL.md", "scripts/run.py"]), "s.zip"), null);
assert.equal(await check(zip(["a.txt", "SKILL.md"], "a comment"), "s.zip"), null);
assert.equal(await check(zip(["my-skill/SKILL.md"]), "s.zip"), "SKILL.md must be at the root of the .zip");
assert.equal(await check(zip(["skill.md"]), "s.zip"), "SKILL.md must be at the root of the .zip");
assert.equal(await check(zip([]), "s.zip"), "SKILL.md must be at the root of the .zip");
assert.equal(await check("not a zip", "s.zip"), "This .zip file couldn't be read");
console.log("ok");
