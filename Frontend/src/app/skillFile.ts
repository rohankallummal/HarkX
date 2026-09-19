// Checks an upload is a Skill: a lone SKILL.md, or a .zip with SKILL.md at its root.
// Returns the reason it isn't, or null when it is.
export async function skillFileError(file: File): Promise<string | null> {
  if (/\.md$/i.test(file.name)) return file.name === "SKILL.md" ? null : "The file must be named SKILL.md";
  if (!/\.zip$/i.test(file.name)) return "Only .zip or .md files are allowed";
  const names = await zipEntryNames(file);
  if (!names) return "This .zip file couldn't be read";
  return names.includes("SKILL.md") ? null : "SKILL.md must be at the root of the .zip";
}

// Reads the entry names from the zip's central directory, without extracting anything.
// ponytail: no ZIP64 support, so archives over 4 GB or 65k entries read as invalid
async function zipEntryNames(file: File): Promise<string[] | null> {
  // the end-of-central-directory record is 22 bytes plus a comment of up to 64 KB, at the very end
  const tailStart = Math.max(0, file.size - 22 - 0xffff);
  const tail = new DataView(await file.slice(tailStart).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = tail.getUint16(eocd + 10, true);
  const size = tail.getUint32(eocd + 12, true);
  const offset = tail.getUint32(eocd + 16, true);
  if (offset + size > file.size) return null;

  const dir = new DataView(await file.slice(offset, offset + size).arrayBuffer());
  const decoder = new TextDecoder();
  const names: string[] = [];
  for (let p = 0, n = 0; n < count; n++) {
    if (p + 46 > dir.byteLength || dir.getUint32(p, true) !== 0x02014b50) return null;
    const nameLength = dir.getUint16(p + 28, true);
    names.push(decoder.decode(new Uint8Array(dir.buffer, p + 46, nameLength)));
    p += 46 + nameLength + dir.getUint16(p + 30, true) + dir.getUint16(p + 32, true);
  }
  return names;
}
