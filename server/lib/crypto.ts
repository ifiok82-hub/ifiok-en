import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function resolveMasterKey(): Buffer {
  const envKey = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (envKey && envKey.length >= 32) {
    return crypto.createHash('sha256').update(envKey).digest();
  }
  const keyFile = path.join(dataDir, '.master.key');
  if (fs.existsSync(keyFile)) {
    const hex = fs.readFileSync(keyFile, 'utf8').trim();
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
  }
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, generated.toString('hex'), { mode: 0o600 });
  return generated;
}

const MASTER_KEY = resolveMasterKey();

export function encryptSensitive(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSensitive(ciphertext: string): string {
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split(':');
    if (!ivHex || !tagHex || !dataHex) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}

// RFC 6238 TOTP MFA (Base32 + HMAC-SHA1)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function base32ToBuffer(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx >= 0) bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secretBuf: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, token: string, windowSteps = 1): boolean {
  const normalized = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized) || !secret) return false;
  const secretBuf = base32ToBuffer(secret);
  const currentStep = Math.floor(Date.now() / 1000 / 30);
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const expected = hotp(secretBuf, currentStep + delta);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(accountLabel: string, secret: string): string {
  const issuer = encodeURIComponent('IFIOK-EN');
  const label = encodeURIComponent(`IFIOK-EN:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

// Strict safe URL validation (prevent javascript:/data: XSS URLs)
export function sanitizeHttpUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

// Magic-byte verification for uploaded product/course images (rejects executables, scripts, SVG)
export function detectSafeImageMime(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }
  // WEBP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

// Basic active-payload / polyglot signature scan for uploaded buffers
export function containsMaliciousScriptSignature(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 65536)).toString('utf8').toLowerCase();
  const banned = ['<script', '<?php', 'javascript:', 'onerror=', 'onload=', '<svg', '<iframe', '<object'];
  return banned.some((sig) => sample.includes(sig));
}

export function containsExecutableSignature(buf: Buffer): boolean {
  if (buf.length < 2) return false;
  // Windows PE (.exe/.dll)
  if (buf[0] === 0x4d && buf[1] === 0x5a) return true;
  // Linux ELF binary
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return true;
  // Mach-O binary
  if (buf.length >= 4 && ((buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfa && buf[3] === 0xce))) {
    return true;
  }
  // Shell shebang
  if (buf[0] === 0x23 && buf[1] === 0x21) return true;
  return false;
}

export function detectSafeDigitalFile(
  buf: Buffer,
  originalName: string
): { ext: string; mime: string; formatLabel: string } | null {
  if (buf.length === 0) return null;
  if (containsExecutableSignature(buf)) return null;

  const rawExt = path.extname(originalName || '').toLowerCase().replace(/^\./, '');

  // Block dangerous extensions explicitly
  const blockedExts = new Set(['exe', 'dll', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'mjs', 'cjs', 'php', 'py', 'rb', 'pl', 'html', 'htm', 'svg']);
  if (blockedExts.has(rawExt)) return null;

  // PDF (%PDF-)
  if (buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { ext: 'pdf', mime: 'application/pdf', formatLabel: 'PDF' };
  }

  // ZIP & Office OpenXML (.zip, .docx, .xlsx, .pptx) -> PK\x03\x04 or PK\x05\x06
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && ((buf[2] === 0x03 && buf[3] === 0x04) || (buf[2] === 0x05 && buf[3] === 0x06))) {
    if (rawExt === 'docx') {
      return { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', formatLabel: 'DOCX' };
    }
    if (rawExt === 'xlsx') {
      return { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', formatLabel: 'XLSX' };
    }
    if (rawExt === 'pptx') {
      return { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', formatLabel: 'PPTX' };
    }
    return { ext: 'zip', mime: 'application/zip', formatLabel: 'ZIP Archive' };
  }

  // MP3 (ID3 tag or MPEG sync frame)
  if (
    (buf.length >= 3 && buf.subarray(0, 3).toString('ascii') === 'ID3') ||
    (buf.length >= 2 && buf[0] === 0xff && (buf[1] === 0xfb || buf[1] === 0xf3 || buf[1] === 0xf2))
  ) {
    return { ext: 'mp3', mime: 'audio/mpeg', formatLabel: 'MP3 Audio' };
  }

  // MP4 (ftyp box at bytes 4..8)
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    return { ext: 'mp4', mime: 'video/mp4', formatLabel: 'MP4 Video' };
  }

  // Raster images (PNG / JPEG / WEBP)
  const img = detectSafeImageMime(buf);
  if (img) {
    return { ext: img.ext, mime: img.mime, formatLabel: img.ext.toUpperCase() };
  }

  // Plain educational documents (.txt, .md, .csv) — must not contain null bytes
  if (['txt', 'md', 'csv'].includes(rawExt)) {
    if (buf.includes(0x00)) return null;
    if (containsMaliciousScriptSignature(buf)) return null;
    return {
      ext: rawExt,
      mime: rawExt === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8',
      formatLabel: rawExt.toUpperCase(),
    };
  }

  return null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code >= 32 && code < 65535 ? String.fromCharCode(code) : ' ';
    });
}

function extractZipTextEntries(buf: Buffer, entryPattern: RegExp): Array<{ name: string; text: string }> {
  // Locate End of Central Directory (PK\x05\x06) scanning backwards from tail
  let eocdOffset = -1;
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return [];

  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  if (cdOffset >= buf.length || totalEntries > 1000) return [];

  const results: Array<{ name: string; text: string }> = [];
  let cursor = cdOffset;
  let totalDecompressed = 0;

  for (let idx = 0; idx < totalEntries && cursor + 46 <= eocdOffset; idx++) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) break;
    const compressionMethod = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const uncompressedSize = buf.readUInt32LE(cursor + 24);
    const fileNameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.subarray(cursor + 46, cursor + 46 + fileNameLen).toString('utf8');
    cursor += 46 + fileNameLen + extraLen + commentLen;

    if (!entryPattern.test(name)) continue;
    if (uncompressedSize > 512 * 1024 || totalDecompressed + uncompressedSize > 2 * 1024 * 1024) continue;
    if (localHeaderOffset + 30 > buf.length || buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const lfhNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const lfhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;
    if (dataStart + compressedSize > buf.length) continue;

    const rawSlice = buf.subarray(dataStart, dataStart + compressedSize);
    try {
      let inflated: Buffer;
      if (compressionMethod === 0) {
        inflated = rawSlice;
      } else if (compressionMethod === 8) {
        inflated = zlib.inflateRawSync(rawSlice, { maxOutputLength: 512 * 1024 });
      } else {
        continue;
      }
      totalDecompressed += inflated.length;
      results.push({ name, text: inflated.toString('utf8') });
      if (results.length >= 40) break;
    } catch {
      // Ignore malformed zip entry
    }
  }

  return results;
}

export function extractReadableDocumentText(buf: Buffer, extOrName: string): string {
  const trimmed = String(extOrName || '').trim().toLowerCase();
  const extPart = trimmed.includes('.') ? path.extname(trimmed) || trimmed : trimmed;
  const cleanExt = extPart.replace(/^\./, '');
  if (['txt', 'md', 'csv'].includes(cleanExt)) {
    return buf.toString('utf8').replace(/\r\n/g, '\n').trim();
  }
  if (cleanExt === 'docx') {
    const entries = extractZipTextEntries(buf, /^word\/(document|header\d+|footer\d+)\.xml$/i);
    const docEntry = entries.find((e) => e.name.toLowerCase() === 'word/document.xml');
    const ordered = docEntry ? [docEntry, ...entries.filter((e) => e !== docEntry)] : entries;
    const text = ordered
      .map((entry) =>
        decodeXmlEntities(
          entry.text
            .replace(/<\/w:p>/g, '\n')
            .replace(/<w:br[^>]*\/>/g, '\n')
            .replace(/<w:tab[^>]*\/>/g, ' ')
            .replace(/<[^>]+>/g, '')
        )
      )
      .join('\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text.slice(0, 12000);
  }
  if (cleanExt === 'pptx') {
    const entries = extractZipTextEntries(buf, /^ppt\/slides\/slide\d+\.xml$/i).sort((a, b) => {
      const na = Number(a.name.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const nb = Number(b.name.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return na - nb;
    });
    const text = entries
      .map((entry, idx) => {
        const slideText = decodeXmlEntities(
          entry.text
            .replace(/<\/a:p>/g, '\n')
            .replace(/<a:br[^>]*\/>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
        )
          .replace(/[ \t]+/g, ' ')
          .replace(/\n\s+/g, '\n')
          .trim();
        return slideText ? `Slide ${idx + 1}: ${slideText}` : '';
      })
      .filter(Boolean)
      .join('\n\n')
      .trim();
    return text.slice(0, 12000);
  }
  if (cleanExt === 'pdf') {
    const latin = buf.toString('latin1');
    const sources: string[] = [latin];
    // Also inspect FlateDecode streams safely
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let sMatch: RegExpExecArray | null;
    while ((sMatch = streamRegex.exec(latin)) !== null && sources.length < 30) {
      try {
        const raw = Buffer.from(sMatch[1], 'latin1');
        const inflated = zlib.inflateSync(raw, { maxOutputLength: 512 * 1024 });
        sources.push(inflated.toString('latin1'));
      } catch {
        // Non-deflate or non-text stream
      }
    }

    const chunks: string[] = [];
    for (const src of sources) {
      const parenRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:Tj|'|")/g;
      let match: RegExpExecArray | null;
      while ((match = parenRegex.exec(src)) !== null && chunks.length < 600) {
        const unescaped = match[1].replace(/\\([()\\])/g, '$1').replace(/\\n/g, ' ');
        const cleaned = unescaped.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length >= 2) chunks.push(cleaned);
      }
    }
    if (chunks.length >= 3) {
      return chunks.join(' ').slice(0, 12000);
    }
    // Fallback printable ASCII sequence extraction for uncompressed text PDFs
    const readable = latin
      .replace(/[^\x20-\x7E\n]/g, ' ')
      .split(/\s+/)
      .filter((tok) => tok.length >= 2 && /[a-zA-Z0-9]/.test(tok) && !/^(obj|endobj|stream|endstream|xref|trailer)$/.test(tok))
      .join(' ')
      .slice(0, 12000);
    return readable;
  }
  return '';
}

export interface SignedDownloadPayload {
  userId: number;
  itemType: 'product' | 'course' | 'school_lesson';
  itemId: number;
  storageKey: string;
  originalName: string;
  exp: number;
}

export function signDownloadToken(
  payload: Omit<SignedDownloadPayload, 'exp'>,
  ttlSeconds = 300
): string {
  const fullPayload: SignedDownloadPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + Math.max(30, Math.min(3600, ttlSeconds)),
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', MASTER_KEY).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyDownloadToken(
  token: string
): { valid: true; payload: SignedDownloadPayload } | { valid: false; status: number; error: string } {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, status: 403, error: 'Malformed download token.' };
  }
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', MASTER_KEY).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, status: 403, error: 'Invalid or tampered download token signature.' };
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedDownloadPayload;
    if (!parsed || !parsed.userId || !parsed.storageKey || !parsed.exp) {
      return { valid: false, status: 403, error: 'Invalid download token payload.' };
    }
    if (Math.floor(Date.now() / 1000) > parsed.exp) {
      return { valid: false, status: 410, error: 'Download link has expired. Request a fresh time-limited link from your Member Vault.' };
    }
    return { valid: true, payload: parsed };
  } catch {
    return { valid: false, status: 403, error: 'Corrupted download token payload.' };
  }
}

