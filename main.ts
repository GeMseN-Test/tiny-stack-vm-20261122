// Tiny Stack VM (ISA v1, opcodes in hex): runs all 40 programs of a set, writes exact bytes + exit code.
// Deterministic (no clock/random). Traps throw their exit code; the catch builds the answer.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const B = { 0x10: (a, b) => (a + b) | 0, 0x11: (a, b) => (a - b) | 0, 0x12: Math.imul, 0x13: (a, b) => (a / b) | 0, 0x14: (a, b) => (a % b) | 0, 0x15: (a, b) => ((a >>> 0) / (b >>> 0)) | 0, 0x16: (a, b) => ((a >>> 0) % (b >>> 0)) | 0, 0x18: (a, b) => a & b, 0x19: (a, b) => a | b, 0x1A: (a, b) => a ^ b, 0x1C: (a, b) => a << (b & 31), 0x1D: (a, b) => a >> (b & 31), 0x1E: (a, b) => (a >>> (b & 31)) | 0, 0x20: (a, b) => +(a === b), 0x21: (a, b) => +(a < b), 0x22: (a, b) => +((a >>> 0) < (b >>> 0)) };

function run(p, inp) {
  const s = [], c = [], m = new Int32Array(256), o = [];
  let pc = 0, ip = 0, n = 0;
  const need = k => { if (s.length < k) throw 2 };
  const room = () => { if (s.length > 255) throw 3 };
  try {
    for (;;) {
      if (n >= 1e6) throw 10;
      if (pc < 0 || pc >= p.length) throw 9;
      const op = p[pc];
      n++;
      if (op === 0x00) throw 0;
      else if (op < 3) {
        const k = op === 1 ? 2 : 5;
        if (pc + k > p.length) throw 9;
        room();
        s.push(op === 1 ? (p[pc + 1] << 24) >> 24 : p[pc + 1] | p[pc + 2] << 8 | p[pc + 3] << 16 | p[pc + 4] << 24);
        pc += k;
      } else if (op === 0x03) { need(1); s.pop(); pc++; }
      else if (op === 0x04) { need(1); room(); s.push(s[s.length - 1]); pc++; }
      else if (op === 0x05) { need(2); s.push(s.splice(s.length - 2, 1)[0]); pc++; }
      else if (op === 0x06) { need(2); room(); s.push(s[s.length - 2]); pc++; }
      else if (op === 0x07) { need(3); s.push(s.splice(s.length - 3, 1)[0]); pc++; }
      else if (op >= 0x10 && op <= 0x22 && op !== 0x17 && op !== 0x1B) {
        need(2);
        const b = s.pop(), a = s.pop();
        if (op > 0x12 && op < 0x17 && !b) throw 4;
        s.push(B[op](a, b)); pc++;
      } else if (op === 0x17 || op === 0x1B) {
        need(1); s.push(op === 0x17 ? (-s.pop()) | 0 : ~s.pop()); pc++;
      } else if (op >= 0x30 && op <= 0x32) {
        if (pc + 3 > p.length) throw 9;
        const off = ((p[pc + 1] | p[pc + 2] << 8) << 16) >> 16;
        let go = op === 0x30;
        if (!go) { need(1); const v = s.pop(); go = op === 0x31 ? v === 0 : v !== 0; }
        pc += 3; if (go) pc += off;
      } else if (op === 0x33) {
        if (pc + 3 > p.length) throw 9;
        if (c.length > 63) throw 7;
        c.push(pc + 3); pc = p[pc + 1] | p[pc + 2] << 8;
      } else if (op === 0x34) { if (!c.length) throw 8; pc = c.pop(); }
      else if (op === 0x40) {
        need(1);
        const a = s.pop();
        if (a < 0 || a > 255) throw 6;
        s.push(m[a]); pc++;
      } else if (op === 0x41) {
        need(2);
        const a = s.pop(), v = s.pop();
        if (a < 0 || a > 255) throw 6;
        m[a] = v; pc++;
      } else if (op === 0x50) {
        need(1);
        const t = String(s.pop());
        if (o.length + t.length > 65536) throw 11;
        o.push(...Buffer.from(t)); pc++;
      } else if (op === 0x51) {
        need(1);
        if (o.length > 65535) throw 11;
        o.push(s.pop() & 255); pc++;
      } else if (op === 0x52) { room(); s.push(ip < inp.length ? inp[ip++] : -1); pc++; }
      else if (op === 0x53) { need(1); throw s.pop() & 255; }
      else throw 5;
    }
  } catch (e) { return [Buffer.from(o), e]; }
}

for (const id of readdirSync(I).sort()) {
  const [out, exit] = run(readFileSync(I + '/' + id + '/program.bin'), readFileSync(I + '/' + id + '/input.bin'));
  mkdirSync(O + '/' + id, { recursive: true });
  writeFileSync(O + '/' + id + '/stdout.bin', out);
  writeFileSync(O + '/' + id + '/exit.txt', exit + '\n');
}
