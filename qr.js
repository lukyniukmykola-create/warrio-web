// Minimal QR code generator (byte mode, error correction level M, versions 1-10).
// Enough for serial numbers and short URLs (up to 213 bytes at version 10).
// Usage: WarrioQR.matrix("text") -> array of rows of 0/1; WarrioQR.svg("text", pixelSize)
(() => {
  "use strict";
  // [totalCodewords, eccPerBlock, [[blockCount, dataCodewordsPerBlock], ...]]
  const SPEC = {
    1: [26, 10, [[1, 16]]], 2: [44, 16, [[1, 28]]], 3: [70, 26, [[1, 44]]], 4: [100, 18, [[2, 32]]],
    5: [134, 24, [[2, 43]]], 6: [172, 16, [[4, 27]]], 7: [196, 18, [[4, 31]]],
    8: [242, 22, [[2, 38], [2, 39]]], 9: [292, 22, [[3, 36], [2, 37]]], 10: [346, 26, [[4, 43], [1, 44]]]
  };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  function generator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= mul(poly[j], EXP[i]); }
      poly = next;
    }
    return poly;
  }
  function ecc(data, degree) {
    const gen = generator(degree);
    const result = new Array(degree).fill(0);
    for (const byte of data) {
      const factor = byte ^ result.shift();
      result.push(0);
      for (let i = 0; i < degree; i++) result[i] ^= mul(gen[i + 1], factor);
    }
    return result;
  }

  function utf8(text) {
    const bytes = [];
    for (const ch of unescape(encodeURIComponent(text))) bytes.push(ch.charCodeAt(0));
    return bytes;
  }

  function chooseVersion(length) {
    for (let v = 1; v <= 10; v++) {
      const dataCodewords = SPEC[v][2].reduce((sum, [count, size]) => sum + count * size, 0);
      const bits = 4 + (v < 10 ? 8 : 16) + length * 8;
      if (bits <= dataCodewords * 8) return v;
    }
    throw new Error("qr_too_long");
  }

  function buildCodewords(bytes, version) {
    const [, eccPerBlock, groups] = SPEC[version];
    const capacity = groups.reduce((sum, [count, size]) => sum + count * size, 0);
    const bits = [];
    const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
    push(4, 4);
    push(bytes.length, version < 10 ? 8 : 16);
    for (const byte of bytes) push(byte, 8);
    push(0, Math.min(4, capacity * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    for (let pad = 0xec; data.length < capacity; pad ^= 0xec ^ 0x11) data.push(pad);

    const blocks = [];
    let offset = 0;
    for (const [count, size] of groups) {
      for (let i = 0; i < count; i++) { blocks.push(data.slice(offset, offset + size)); offset += size; }
    }
    const eccBlocks = blocks.map(block => ecc(block, eccPerBlock));
    const out = [];
    const maxData = Math.max(...blocks.map(block => block.length));
    for (let i = 0; i < maxData; i++) for (const block of blocks) if (i < block.length) out.push(block[i]);
    for (let i = 0; i < eccPerBlock; i++) for (const block of eccBlocks) out.push(block[i]);
    return out;
  }

  function bch(value, poly, bitsLength) {
    let result = value << bitsLength;
    const top = poly.toString(2).length;
    for (let i = result.toString(2).length; i >= top; i--) if ((result >>> (i - 1)) & 1) result ^= poly << (i - top);
    return result;
  }

  function matrix(text) {
    const bytes = utf8(String(text));
    const version = chooseVersion(bytes.length);
    const size = 17 + 4 * version;
    const modules = Array.from({ length: size }, () => new Array(size).fill(0));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (r, c, dark, lock = true) => { modules[r][c] = dark ? 1 : 0; if (lock) reserved[r][c] = true; };

    const finder = (row, col) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const dark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(rr, cc, dark);
      }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const positions = ALIGN[version];
    for (const r of positions) for (const c of positions) {
      if ((r === 6 && c === 6) || (r === 6 && c === positions[positions.length - 1]) || (c === 6 && r === positions[positions.length - 1])) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
    set(4 * version + 9, 8, true); // dark module
    for (let i = 0; i < 9; i++) { reserved[8][i] = true; reserved[i][8] = true; }
    for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = true; reserved[size - 1 - i][8] = true; }
    if (version >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { reserved[i][size - 11 + j] = true; reserved[size - 11 + j][i] = true; }

    // data placement (zigzag)
    const codewords = buildCodewords(bytes, version);
    const bits = [];
    for (const word of codewords) for (let i = 7; i >= 0; i--) bits.push((word >>> i) & 1);
    let index = 0;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const row = ((size - 1 - col) >> 1) % 2 === 0 ? size - 1 - step : step; // upward when the column pair index is even
        for (let c = col; c >= col - 1; c--) {
          if (reserved[row][c]) continue;
          modules[row][c] = index < bits.length ? bits[index] : 0;
          index++;
        }
      }
    }

    const masks = [
      (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
      (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
    ];
    const finalize = mask => {
      const grid = modules.map(row => row.slice());
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!reserved[r][c] && masks[mask](r, c)) grid[r][c] ^= 1;
      const format = (bch((0 << 3) | mask, 0x537, 10) | (((0 << 3) | mask) << 10)) ^ 0x5412; // level M = 00
      const bit = i => (format >>> i) & 1;
      for (let i = 0; i <= 5; i++) grid[i][8] = bit(i);
      grid[7][8] = bit(6); grid[8][8] = bit(7); grid[8][7] = bit(8);
      for (let i = 9; i < 15; i++) grid[8][14 - i] = bit(i);
      for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = bit(i);
      for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = bit(i);
      if (version >= 7) {
        const info = (version << 12) | bch(version, 0x1f25, 12);
        for (let i = 0; i < 18; i++) {
          const dark = (info >>> i) & 1;
          grid[Math.floor(i / 3)][size - 11 + (i % 3)] = dark;
          grid[size - 11 + (i % 3)][Math.floor(i / 3)] = dark;
        }
      }
      return grid;
    };

    const penalty = grid => {
      let score = 0;
      for (let pass = 0; pass < 2; pass++) {
        for (let a = 0; a < size; a++) {
          let run = 1;
          for (let b = 1; b < size; b++) {
            const cur = pass ? grid[b][a] : grid[a][b], prev = pass ? grid[b - 1][a] : grid[a][b - 1];
            if (cur === prev) { run++; if (run === 5) score += 3; else if (run > 5) score++; } else run = 1;
          }
        }
      }
      for (let r = 0; r < size - 1; r++) for (let c = 0; c < size - 1; c++) {
        const v = grid[r][c];
        if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3;
      }
      const pattern = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      const reverse = pattern.slice().reverse();
      for (let pass = 0; pass < 2; pass++) for (let a = 0; a < size; a++) for (let b = 0; b <= size - 11; b++) {
        const line = i => (pass ? grid[b + i][a] : grid[a][b + i]);
        let m1 = true, m2 = true;
        for (let i = 0; i < 11; i++) { if (line(i) !== pattern[i]) m1 = false; if (line(i) !== reverse[i]) m2 = false; }
        if (m1) score += 40;
        if (m2) score += 40;
      }
      let dark = 0;
      for (const row of grid) for (const v of row) dark += v;
      score += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
      return score;
    };

    let best = null, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const grid = finalize(mask);
      const score = penalty(grid);
      if (score < bestScore) { bestScore = score; best = grid; }
    }
    return best;
  }

  function svg(text, pixel = 4, quiet = 4) {
    const grid = matrix(text);
    const total = grid.length + quiet * 2;
    let path = "";
    grid.forEach((row, r) => row.forEach((value, c) => { if (value) path += `M${c + quiet} ${r + quiet}h1v1h-1z`; }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * pixel}" height="${total * pixel}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  }

  window.WarrioQR = { matrix, svg };
  if (typeof module !== "undefined") module.exports = { matrix, svg };
})();
