'use strict';
/**
 * IconExtractor — pull the embedded icon out of a Windows .exe WITHOUT running,
 * patching or touching the file (spec §11: read-only inspection).
 *
 * Strategy:
 *  1. Pure-JS PE resource parser: reads DOS/NT headers, walks the .rsrc tree,
 *     collects RT_GROUP_ICON + RT_ICON entries and re-assembles a valid .ico.
 *  2. Fallback (Windows only): PowerShell + System.Drawing.ExtractAssociatedIcon.
 *  3. Fallback: null -> the UI shows a generated placeholder tile.
 *
 * Results are cached under userData/art/icons/<gameId>.ico.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { makeLogger } = require('../util/log');
const paths = require('../util/paths');

const log = makeLogger('icons');

const RT_ICON = 3;
const RT_GROUP_ICON = 14;

function readUInt16LE(buf, off) {
  return buf.readUInt16LE(off);
}
function readUInt32LE(buf, off) {
  return buf.readUInt32LE(off);
}

/** Parse PE and return { icons: [{width,height,planes,bpp,data}], } or null. */
function parsePeIcons(exePath) {
  const fd = fs.openSync(exePath, 'r');
  try {
    const head = Buffer.alloc(1024);
    fs.readSync(fd, head, 0, 1024, 0);
    if (head[0] !== 0x4d || head[1] !== 0x5a) return null; // 'MZ'
    const peOff = readUInt32LE(head, 0x3c);
    const sig = Buffer.alloc(4);
    fs.readSync(fd, sig, 0, 4, peOff);
    if (sig.toString('latin1') !== 'PE\0\0') return null;
    const coff = peOff + 4;
    const numSections = readUInt16LE(headOr(fd, coff + 2, 2), 0);
    const optSize = readUInt16LE(headOr(fd, coff + 16, 2), 0);
    const optOff = coff + 20;
    const magic = readUInt16LE(headOr(fd, optOff, 2), 0);
    const is64 = magic === 0x20b;
    // DataDirectory[IMAGE_DIRECTORY_ENTRY_RESOURCE (2)] => +8 bytes into the table
    const resRva = readUInt32LE(headOr(fd, optOff + (is64 ? 112 : 96) + 8, 4), 0);
    const sectionsOff = optOff + optSize;
    const sections = [];
    for (let i = 0; i < numSections; i++) {
      const off = sectionsOff + i * 40;
      const rec = Buffer.alloc(40);
      fs.readSync(fd, rec, 0, 40, off);
      sections.push({
        name: rec.slice(0, 8).toString('latin1').replace(/\0.*$/, ''),
        vsize: readUInt32LE(rec, 8),
        vaddr: readUInt32LE(rec, 12),
        rawSize: readUInt32LE(rec, 16),
        rawPtr: readUInt32LE(rec, 20)
      });
    }
    const rsrc = sections.find((s) => s.name === '.rsrc') || sections.find((s) => resRva >= s.vaddr && resRva < s.vaddr + Math.max(s.vsize, s.rawSize));
    if (!rsrc || !resRva) return null;
    const rvaToOff = (rva) => rva - rsrc.vaddr + rsrc.rawPtr;

    const readAt = (off, len) => {
      const b = Buffer.alloc(len);
      fs.readSync(fd, b, 0, len, off);
      return b;
    };

    // Walk resource tree: level0 = type, level1 = name/id, level2 = language
    function parseDir(offset) {
      const buf = readAt(offset, 16);
      const named = readUInt16LE(buf, 12);
      const ids = readUInt16LE(buf, 14);
      const entries = [];
      for (let i = 0; i < named + ids; i++) {
        const e = readAt(offset + 16 + i * 8, 8);
        entries.push({ id: readUInt32LE(e, 0), dataOff: readUInt32LE(e, 4) });
      }
      return entries;
    }

    const root = rvaToOff(resRva);
    const types = parseDir(root);
    const groupIconType = types.find((t) => t.id === RT_GROUP_ICON);
    const iconType = types.find((t) => t.id === RT_ICON);
    if (!groupIconType || !iconType) return null;

    // Collect raw icon blobs by id
    const iconBlobs = new Map();
    for (const nameEntry of parseDir(root + (iconType.dataOff & 0x7fffffff))) {
      for (const langEntry of parseDir(root + (nameEntry.dataOff & 0x7fffffff))) {
        const dataEntry = readAt(rvaToOff(resRva) + (langEntry.dataOff & 0x7fffffff) - root + root, 16);
        // dataEntry offset is relative to resource dir start
        const dOff = readUInt32LE(dataEntry, 0);
        const dSize = readUInt32LE(dataEntry, 4);
        iconBlobs.set(nameEntry.id, readAt(rsrc.rawPtr + dOff, dSize));
      }
    }

    // Take the first group icon (main app icon), pick best entries
    let chosen = null;
    for (const nameEntry of parseDir(root + (groupIconType.dataOff & 0x7fffffff))) {
      for (const langEntry of parseDir(root + (nameEntry.dataOff & 0x7fffffff))) {
        const dataEntry = readAt(root + (langEntry.dataOff & 0x7fffffff), 16);
        const dOff = readUInt32LE(dataEntry, 0);
        const dSize = readUInt32LE(dataEntry, 4);
        const group = readAt(rsrc.rawPtr + dOff, dSize);
        const count = readUInt16LE(group, 4);
        const entries = [];
        for (let i = 0; i < count; i++) {
          const e = group.slice(6 + i * 14, 6 + i * 14 + 14);
          const id = readUInt16LE(e, 12);
          if (iconBlobs.has(id)) {
            entries.push({
              width: e[0] === 0 ? 256 : e[0],
              height: e[1] === 0 ? 256 : e[1],
              planes: readUInt16LE(e, 4),
              bpp: readUInt16LE(e, 6),
              data: iconBlobs.get(id)
            });
          }
        }
        if (entries.length) {
          if (!chosen) chosen = entries;
          else {
            const score = (list) => Math.max(...list.map((x) => x.width * x.height * x.bpp));
            if (score(entries) > score(chosen)) chosen = entries;
          }
        }
      }
      if (chosen) break;
    }
    return chosen;
  } finally {
    fs.closeSync(fd);
  }
}

function headOr(fd, off, len) {
  const b = Buffer.alloc(len);
  fs.readSync(fd, b, 0, len, off);
  return b;
}

function buildIco(entries) {
  // Sort biggest first; cap at 8 entries to keep files small.
  const list = entries
    .slice()
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, 8);
  let offset = 6 + 16 * list.length;
  const dir = [];
  const body = [];
  for (const e of list) {
    dir.push(
      Buffer.from([
        e.width >= 256 ? 0 : e.width,
        e.height >= 256 ? 0 : e.height,
        0,
        0,
        e.planes & 0xff,
        (e.planes >> 8) & 0xff,
        e.bpp & 0xff,
        (e.bpp >> 8) & 0xff,
        e.data.length & 0xff,
        (e.data.length >> 8) & 0xff,
        (e.data.length >> 16) & 0xff,
        (e.data.length >> 24) & 0xff,
        offset & 0xff,
        (offset >> 8) & 0xff,
        (offset >> 16) & 0xff,
        (offset >> 24) & 0xff
      ])
    );
    body.push(e.data);
    offset += e.data.length;
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(list.length, 4);
  return Buffer.concat([header, ...dir, ...body]);
}

function powershellExtract(exePath, outPng) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(false);
    const script =
      `Add-Type -AssemblyName System.Drawing; ` +
      `$i = [System.Drawing.Icon]::ExtractAssociatedIcon(${JSON.stringify(exePath)}); ` +
      `if ($i -eq $null) { exit 1 }; ` +
      `$b = $i.ToBitmap(); $b.Save(${JSON.stringify(outPng)}, [System.Drawing.Imaging.ImageFormat]::Png); exit 0`;
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 15000, windowsHide: true },
      (err) => resolve(!err)
    );
  });
}

/**
 * Extract (or reuse cached) icon for a game exe.
 * @returns {Promise<string|null>} absolute path of .ico/.png or null.
 */
async function extractIcon(exePath, gameId) {
  try {
    if (!exePath || !fs.existsSync(exePath)) return null;
    const icoPath = path.join(paths.iconDir, `${gameId}.ico`);
    const pngPath = path.join(paths.iconDir, `${gameId}.png`);
    const stat = fs.statSync(exePath);
    const cacheKey = `${exePath}|${stat.size}|${stat.mtimeMs}`;
    const metaPath = path.join(paths.iconDir, `${gameId}.cachekey`);
    if (fs.existsSync(metaPath) && fs.readFileSync(metaPath, 'utf8') === cacheKey) {
      if (fs.existsSync(icoPath)) return icoPath;
      if (fs.existsSync(pngPath)) return pngPath;
    }
    let result = null;
    try {
      const entries = parsePeIcons(exePath);
      if (entries && entries.length) {
        fs.writeFileSync(icoPath, buildIco(entries));
        result = icoPath;
      }
    } catch (err) {
      log.warn('PE icon parse failed for', exePath, err && err.message);
    }
    if (!result) {
      const ok = await powershellExtract(exePath, pngPath);
      if (ok && fs.existsSync(pngPath)) result = pngPath;
    }
    if (result) {
      fs.writeFileSync(metaPath, cacheKey);
      log.info('Extracted icon for', path.basename(exePath), '->', result);
    }
    return result;
  } catch (err) {
    log.error('extractIcon failed:', err);
    return null;
  }
}

function hashName(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex').slice(0, 12);
}

module.exports = { extractIcon, parsePeIcons, buildIco, hashName };
