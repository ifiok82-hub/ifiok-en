import zlib from 'node:zlib';

// Standard IEEE 802.3 CRC32 lookup table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function escapeXml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapePdfText(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars = 84): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const w of words) {
      if (!current) {
        current = w;
      } else if (current.length + 1 + w.length <= maxChars) {
        current += ` ${w}`;
      } else {
        lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export interface PdfSection {
  heading: string;
  lines: string[];
}

export function buildValidPdf(opts: {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  rights: string;
  sections: PdfSection[];
}): Buffer {
  const formattedLines: Array<{ text: string; style: 'title' | 'heading' | 'body' | 'meta' }> = [
    { text: opts.title, style: 'title' },
    { text: opts.subtitle, style: 'meta' },
    { text: `Author / Publisher: ${opts.author} | Version Date: ${opts.date}`, style: 'meta' },
    { text: `Rights & License: ${opts.rights}`, style: 'meta' },
    { text: '', style: 'body' },
  ];

  for (const sec of opts.sections) {
    formattedLines.push({ text: sec.heading, style: 'heading' });
    for (const rawLine of sec.lines) {
      for (const wrapped of wrapText(rawLine, 86)) {
        formattedLines.push({ text: wrapped, style: 'body' });
      }
    }
    formattedLines.push({ text: '', style: 'body' });
  }

  // Paginate lines (approx 46 lines per US Letter page)
  const pages: Array<typeof formattedLines> = [];
  const linesPerPage = 44;
  for (let i = 0; i < formattedLines.length; i += linesPerPage) {
    pages.push(formattedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([{ text: opts.title, style: 'title' }]);

  // Object allocation:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5..4+2*pages.length: Page + Content pairs
  const objects: string[] = [];
  const pageObjIds: number[] = [];

  for (let p = 0; p < pages.length; p++) {
    const pageId = 5 + p * 2;
    const contentId = pageId + 1;
    pageObjIds.push(pageId);

    const ops: string[] = ['BT'];
    let y = 744;
    for (const item of pages[p]) {
      const safe = escapePdfText(item.text);
      if (item.style === 'title') {
        ops.push(`/F2 15 Tf 1 0 0 1 52 ${y} Tm (${safe}) Tj`);
        y -= 20;
      } else if (item.style === 'heading') {
        ops.push(`/F2 11 Tf 1 0 0 1 52 ${y} Tm (${safe}) Tj`);
        y -= 16;
      } else if (item.style === 'meta') {
        ops.push(`/F1 9 Tf 1 0 0 1 52 ${y} Tm (${safe}) Tj`);
        y -= 13;
      } else {
        if (safe) {
          ops.push(`/F1 10 Tf 1 0 0 1 52 ${y} Tm (${safe}) Tj`);
        }
        y -= 14;
      }
      if (y < 54) break;
    }
    ops.push(`/F1 8 Tf 1 0 0 1 52 30 Tm (${escapePdfText(`IFIOK-EN Verified Educational / Digital Asset — Page ${p + 1} of ${pages.length}`)}) Tj`);
    ops.push('ET');
    const streamData = ops.join('\n');

    objects[pageId] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`;
    objects[contentId] = `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(streamData, 'latin1')} >>\nstream\n${streamData}\nendstream\nendobj\n`;
  }

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  const parts: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  let byteCursor = Buffer.byteLength(parts[0], 'latin1');

  for (let id = 1; id < objects.length; id++) {
    offsets[id] = byteCursor;
    parts.push(objects[id]);
    byteCursor += Buffer.byteLength(objects[id], 'latin1');
  }

  const xrefOffset = byteCursor;
  parts.push(`xref\n0 ${objects.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < objects.length; id++) {
    parts.push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  parts.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(parts.join(''), 'latin1');
}

export function buildValidZip(entries: Array<{ name: string; data: Buffer | string }>): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : entry.data;
    const compressed = zlib.deflateRawSync(rawBuf);
    const crc = crc32(rawBuf);

    // Local File Header (30 bytes + name)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // version needed 2.0
    lfh.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    lfh.writeUInt16LE(8, 8); // deflate
    lfh.writeUInt16LE(0, 10); // mod time
    lfh.writeUInt16LE(0x5421, 12); // mod date
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(compressed.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);

    localChunks.push(lfh, nameBuf, compressed);

    // Central Directory Header (46 bytes + name)
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0800, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0x5421, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(rawBuf.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);

    centralChunks.push(cdh, nameBuf);
    offset += lfh.length + nameBuf.length + compressed.length;
  }

  const centralDirBuf = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDirBuf, eocd]);
}

export function buildValidDocx(opts: {
  title: string;
  subtitle: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
}): Buffer {
  const bodyBlocks: string[] = [
    `<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${escapeXml(opts.title)}</w:t></w:r></w:p>`,
    `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(opts.subtitle)}</w:t></w:r></w:p>`,
  ];
  for (const sec of opts.sections) {
    bodyBlocks.push(
      `<w:p><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(sec.heading)}</w:t></w:r></w:p>`
    );
    for (const p of sec.paragraphs) {
      bodyBlocks.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(p)}</w:t></w:r></w:p>`);
    }
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyBlocks.join('\n    ')}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return buildValidZip([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/document.xml', data: documentXml },
  ]);
}

function colLetter(colIdxZero: number): string {
  let s = '';
  let n = colIdxZero + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function buildValidXlsx(opts: {
  sheets: Array<{ name: string; rows: Array<Array<string | number>> }>;
}): Buffer {
  const safeSheets = opts.sheets.length > 0 ? opts.sheets : [{ name: 'Sheet1', rows: [['IFIOK DIGITAL']] }];

  const sheetOverrides = safeSheets
    .map(
      (_s, idx) =>
        `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets
      .map(
        (s, idx) =>
          `<sheet name="${escapeXml(s.name.slice(0, 31))}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`
      )
      .join('\n    ')}
  </sheets>
</workbook>`;

  const wbRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets
    .map(
      (_s, idx) =>
        `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;

  const entries: Array<{ name: string; data: string }> = [
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: wbRelsXml },
    { name: 'xl/styles.xml', data: stylesXml },
  ];

  safeSheets.forEach((sheet, sIdx) => {
    const rowsXml = sheet.rows
      .map((row, rIdx) => {
        const cells = row
          .map((cell, cIdx) => {
            const ref = `${colLetter(cIdx)}${rIdx + 1}`;
            const styleAttr = rIdx === 0 ? ' s="1"' : '';
            if (typeof cell === 'number' && Number.isFinite(cell)) {
              return `<c r="${ref}"${styleAttr}><v>${cell}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(cell)}</t></is></c>`;
          })
          .join('');
        return `<row r="${rIdx + 1}">${cells}</row>`;
      })
      .join('\n    ');

    entries.push({
      name: `xl/worksheets/sheet${sIdx + 1}.xml`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowsXml}
  </sheetData>
</worksheet>`,
    });
  });

  return buildValidZip(entries);
}
