/**
 * pdf-builder.js — Tailored Resume PDF Generator
 * 
 * Takes structured resume data (with reordered sections and highlighted
 * keywords) and generates a clean, ATS-friendly PDF using jsPDF.
 * 
 * Design: Single-column, minimal formatting, standard fonts.
 * This ensures maximum ATS compatibility.
 * 
 * All processing is 100% client-side.
 * 
 * Dependencies: libs/jspdf.umd.min.js
 * Imported by: popup.js
 */

/**
 * Generates a tailored resume PDF from structured data.
 * 
 * @param {{ contact: Object, sections: Array }} resumeData - Parsed/reordered resume
 * @param {string[]} matchingKeywords - Keywords to bold in the resume
 * @param {Object} options - Optional settings
 * @param {string} options.fontFamily - Font name (default: 'helvetica')
 * @param {number} options.fontSize - Body font size (default: 10)
 * @param {number} options.headerSize - Section header size (default: 12)
 * @param {number} options.nameSize - Name size (default: 16)
 * @param {number} options.marginLeft - Left margin in mm (default: 20)
 * @param {number} options.marginRight - Right margin in mm (default: 20)
 * @param {number} options.marginTop - Top margin in mm (default: 15)
 * @returns {jsPDF} - The jsPDF document object (call .save() to download)
 */
function buildResumePDF(resumeData, matchingKeywords = [], options = {}) {
  const {
    fontFamily = 'helvetica',
    fontSize = 10,
    headerSize = 12,
    nameSize = 16,
    marginLeft = 20,
    marginRight = 20,
    marginTop = 15
  } = options;

  /* global jspdf */
  const { jsPDF } = jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginLeft - marginRight;
  const marginBottom = 15;
  let y = marginTop;

  /**
   * Adds a new page if we're near the bottom.
   * @param {number} neededSpace - Space in mm needed for next content
   */
  function checkPageBreak(neededSpace = 10) {
    if (y + neededSpace > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  }

  /**
   * Writes a line of text, handling word wrap and keyword bolding.
   * @param {string} text - The text to write
   * @param {number} size - Font size
   * @param {string} style - 'normal', 'bold', or 'italic'
   * @param {number[]} color - RGB array [r, g, b]
   */
  function writeText(text, size = fontSize, style = 'normal', color = [33, 33, 33]) {
    doc.setFont(fontFamily, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);

    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = size * 0.4; // mm per line

    for (const line of lines) {
      checkPageBreak(lineHeight + 2);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
  }

  /**
   * Writes text with matching keywords rendered in bold.
   * Splits each line into segments, bolding keyword matches.
   * @param {string} text - The text to write
   * @param {string[]} keywords - Keywords to bold
   */
  function writeTextWithBoldKeywords(text, keywords) {
    if (!keywords.length) {
      writeText(text);
      return;
    }

    // For ATS friendliness, we write the full text normally
    // but render matched keywords in bold by splitting lines
    const escaped = keywords.map(k =>
      k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

    const wrappedLines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 0.4;

    for (const line of wrappedLines) {
      checkPageBreak(lineHeight + 2);

      // Split the line into segments: regular and keyword
      const segments = [];
      let lastIndex = 0;
      let match;

      const linePattern = new RegExp(pattern.source, 'gi');
      while ((match = linePattern.exec(line)) !== null) {
        if (match.index > lastIndex) {
          segments.push({ text: line.slice(lastIndex, match.index), bold: false });
        }
        segments.push({ text: match[0], bold: true });
        lastIndex = linePattern.lastIndex;
      }
      if (lastIndex < line.length) {
        segments.push({ text: line.slice(lastIndex), bold: false });
      }

      // Render segments sequentially
      let x = marginLeft;
      doc.setFontSize(fontSize);
      doc.setTextColor(33, 33, 33);

      for (const seg of segments) {
        doc.setFont(fontFamily, seg.bold ? 'bold' : 'normal');
        doc.text(seg.text, x, y);
        x += doc.getTextWidth(seg.text);
      }

      y += lineHeight;
    }
  }

  // ── Render Contact Info ──────────────────────────────────

  const { contact } = resumeData;

  if (contact.name) {
    writeText(contact.name, nameSize, 'bold', [0, 0, 0]);
    y += 1;
  }

  // Contact details on one line
  const contactParts = [contact.email, contact.phone, contact.linkedin]
    .filter(Boolean);
  if (contactParts.length) {
    writeText(contactParts.join('  |  '), fontSize - 1, 'normal', [100, 100, 100]);
  }

  y += 3;

  // Horizontal rule
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 5;

  // ── Render Sections ──────────────────────────────────────

  for (const section of resumeData.sections) {
    checkPageBreak(15);

    // Section header
    writeText(section.title.toUpperCase(), headerSize, 'bold', [44, 62, 80]);
    y += 1;

    // Section content — split into paragraphs/bullets
    const contentLines = section.content.split('\n').filter(l => l.trim());

    for (const line of contentLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Detect bullet points
      const bulletMatch = trimmed.match(/^[•\-\*\u2022\u25E6]\s*/);
      if (bulletMatch) {
        const bulletText = trimmed.slice(bulletMatch[0].length);
        const bulletPrefix = '  •  ';
        writeTextWithBoldKeywords(bulletPrefix + bulletText, matchingKeywords);
      } else {
        writeTextWithBoldKeywords(trimmed, matchingKeywords);
      }

      y += 0.5; // Small gap between lines
    }

    y += 4; // Gap between sections
  }

  return doc;
}

/**
 * Builds and triggers download of the tailored resume PDF.
 * @param {{ contact: Object, sections: Array }} resumeData
 * @param {string[]} matchingKeywords
 * @param {string} jobTitle - Used in the filename
 * @param {string} company - Used in the filename
 */
function downloadResumePDF(resumeData, matchingKeywords, jobTitle = '', company = '') {
  const doc = buildResumePDF(resumeData, matchingKeywords);

  // Build a clean filename
  const name = resumeData.contact.name || 'Resume';
  const cleanName = name.replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');
  const cleanCompany = company.replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');

  const filename = cleanCompany
    ? `${cleanName}_${cleanCompany}_Tailored.pdf`
    : `${cleanName}_Tailored.pdf`;

  doc.save(filename);
}
