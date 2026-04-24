/**
 * pdf-builder-v2.js — Structured Resume to PDF
 * 
 * Takes component-structured resume data and generates a clean PDF.
 * Much simpler since data is already in proper format.
 */

function buildResumePDFv2(resume, options = {}) {
  const {
    fontFamily = 'helvetica',
    fontSize = 10,
    headerSize = 13,
    subHeaderSize = 11,
    nameSize = 16,
    marginLeft = 15,
    marginRight = 15,
    marginTop = 12,
    marginBottom = 12,
    lineSpacing = 1.3
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
  let y = marginTop;

  // Safe text cleanup
  function cleanText(text) {
    if (!text) return '';
    
    // Fix spaced-out letters FIRST (E x e c u t e d -> Executed)
    let cleaned = text;
    let prevLength;
    let iterations = 0;
    do {
      prevLength = cleaned.length;
      // Remove spaces between single letters: "X y z" -> "Xyz"
      cleaned = cleaned.replace(/([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z])/g, '$1$2$3');
      iterations++;
    } while (cleaned.length !== prevLength && iterations < 20);
    
    // Remove artifacts (but NOT - as it's used in separators and dates)
    cleaned = cleaned.replace(/[%|§¶`^~•\*]/g, '').trim();
    // Remove bullet/dash only at the start of lines (as bullet points)
    cleaned = cleaned.replace(/^[\-•\*]\s*/gm, '').trim();
    return cleaned;
  }

  let isMeasuring = false;
  let measuredHeight = 0;

  function checkPageBreak(neededSpace = 10) {
    if (isMeasuring) return;
    if (y + neededSpace > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  }

  function addText(text, size = fontSize, isBold = false, indentMM = 0) {
    const cleaned = cleanText(text);
    if (!cleaned) return;

    doc.setFont(fontFamily, isBold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);

    const effectiveWidth = maxWidth - indentMM;
    const wrappedLines = doc.splitTextToSize(cleaned, effectiveWidth);
    const lineHeight = (size / 72) * 25.4 * lineSpacing;

    if (isMeasuring) {
      measuredHeight += wrappedLines.length * lineHeight;
      return;
    }

    wrappedLines.forEach(line => {
      checkPageBreak(lineHeight);
      doc.text(line, marginLeft + indentMM, y);
      y += lineHeight;
    });
  }

  function addSpace(mm = 2) {
    if (isMeasuring) {
      measuredHeight += mm;
      return;
    }
    y += mm;
  }

  function addLine() {
    if (isMeasuring) {
      measuredHeight += 3;
      return;
    }
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, y, pageWidth - marginRight, y);
    y += 3;
  }

  // ── NAME AND CONTACT ──────────────────────

  if (resume.contact.name) {
    addText(resume.contact.name, nameSize, true);
    addSpace(1);
  }

  const contactParts = [];
  if (resume.contact.email) contactParts.push(resume.contact.email);
  if (resume.contact.phone) contactParts.push(resume.contact.phone);
  if (resume.contact.linkedin) contactParts.push(resume.contact.linkedin);

  if (contactParts.length > 0) {
    addText(contactParts.join(' - '), fontSize - 1, false);
  }

  addSpace(3);

  // ── SECTION RENDERERS ─────────────────────

  function renderSummary() {
    if (!isMeasuring) checkPageBreak(15);
    addText('PROFESSIONAL SUMMARY', headerSize, true);
    addSpace(1);
    addText(resume.summary, fontSize, false);
    addSpace(4);
  }

  function renderExperience() {
    addSpace(2); // Add line space before section
    if (!isMeasuring) checkPageBreak(20);
    addText('WORK EXPERIENCE', headerSize, true);
    addSpace(1.5);

    for (const exp of resume.experience) {
      if (!isMeasuring) checkPageBreak(15);

      // Job title
      if (exp.title) {
        addText(exp.title, subHeaderSize, true);
        addSpace(0.3);
      }

      // Company and timeline
      const meta = [exp.company, exp.timeline].filter(x => x).join(' — ');
      if (meta) {
        addText(meta, fontSize - 0.5, false);
        addSpace(0.5);
      }

      // Description (clean bullets from each line)
      if (exp.description) {
        const lines = exp.description.split('\n').filter(b => b.trim());
        for (const line of lines) {
          // Remove bullet characters and %I markers from beginning of each line
          let cleanedLine = line
            .replace(/^%[a-zA-Z]\s*/g, '')  // Remove %I, %1, etc.
            .replace(/^[%|•\-\*§¶`^~]+\s*/g, '')  // Remove remaining bullet symbols
            .replace(/^\d+\.\s*/g, '')  // Remove numbered lists
            .replace(/^[a-zA-Z]\)\s*/g, '')  // Remove lettered lists
            .trim();
          if (cleanedLine.length > 0) {
            addText(cleanedLine, fontSize, false, 2);
            addSpace(0.6);
          }
        }
      }

      addSpace(1.5);
    }

    addSpace(1);
  }

  function renderEducation() {
    addSpace(2); // Add line space before section
    if (!isMeasuring) checkPageBreak(20);
    addText('EDUCATION', headerSize, true);
    addSpace(1.5);

    for (const edu of resume.education) {
      if (!isMeasuring) checkPageBreak(12);

      // Degree and field
      let degreeStr = edu.degree;
      if (edu.field) degreeStr += ' in ' + edu.field;
      if (degreeStr) {
        addText(degreeStr, subHeaderSize, true);
        addSpace(0.3);
      }

      // School and timeline
      const meta = [edu.school, edu.timeline].filter(x => x).join(' — ');
      if (meta) {
        addText(meta, fontSize - 0.5, false);
        addSpace(0.5);
      }

      // Description
      if (edu.description) {
        addText(edu.description, fontSize, false);
      }

      addSpace(1.5);
    }

    addSpace(1);
  }

  function renderSkills() {
    addSpace(2); // Add line space before section
    if (!isMeasuring) checkPageBreak(15);
    addText('SKILLS', headerSize, true);
    addSpace(1.5);

    // Group skills by category if available
    const byCategory = {};
    const uncategorized = [];

    for (const skill of resume.skills) {
      if (skill.category) {
        if (!byCategory[skill.category]) byCategory[skill.category] = [];
        byCategory[skill.category].push(skill);
      } else {
        uncategorized.push(skill);
      }
    }

    // Render categorized skills
    for (const [category, skills] of Object.entries(byCategory)) {
      addText(category, subHeaderSize, true);
      const skillNames = skills.map(s => s.name).join(', ');
      addText(skillNames, fontSize, false);
      addSpace(1);
    }

    // Render uncategorized skills
    if (uncategorized.length > 0) {
      const skillNames = uncategorized.map(s => s.name).join(', ');
      addText(skillNames, fontSize, false);
    }

    addSpace(1.5);
  }

  function renderProjects() {
    addSpace(2); // Add line space before section
    if (!isMeasuring) checkPageBreak(15);
    addText('PROJECTS', headerSize, true);
    addSpace(1.5);

    for (const proj of resume.projects) {
      if (!isMeasuring) checkPageBreak(10);

      if (proj.name) {
        addText(proj.name, subHeaderSize, true);
        addSpace(0.3);
      }

      if (proj.description) {
        addText(proj.description, fontSize, false);
      }

      addSpace(1.2);
    }
  }

  // ── DYNAMIC LAYOUT ENGINE ─────────────────

  const sectionsQueue = [];
  if (resume.summary) sectionsQueue.push({ id: 'summary', render: renderSummary });
  if (resume.experience && resume.experience.length > 0) sectionsQueue.push({ id: 'experience', render: renderExperience });
  if (resume.education && resume.education.length > 0) sectionsQueue.push({ id: 'education', render: renderEducation });
  if (resume.skills && resume.skills.length > 0) sectionsQueue.push({ id: 'skills', render: renderSkills });
  if (resume.projects && resume.projects.length > 0) sectionsQueue.push({ id: 'projects', render: renderProjects });

  function getSectionHeight(renderFn) {
    isMeasuring = true;
    measuredHeight = 0;
    renderFn();
    isMeasuring = false;
    return measuredHeight;
  }

  while (sectionsQueue.length > 0) {
    let maxAvailableSpace = pageHeight - marginBottom - y;
    let selectedIdx = -1;

    // 1. Try to find the highest-priority section that perfectly fits the current page
    for (let i = 0; i < sectionsQueue.length; i++) {
      let height = getSectionHeight(sectionsQueue[i].render);
      if (height <= maxAvailableSpace) {
        selectedIdx = i;
        break;
      }
    }

    // 2. If no section perfectly fits in the remaining space
    if (selectedIdx === -1) {
      // If the space is uncomfortably small (< 45mm / ~1.7 inches), cleanly force a new page.
      if (maxAvailableSpace < 45) {
        doc.addPage();
        y = marginTop;
      }
      // Render the highest-priority remaining item regardless (it will naturally page-break inside the renderer)
      selectedIdx = 0;
    }

    // 3. Render the selected section and remove it from the remaining queue
    sectionsQueue[selectedIdx].render();
    sectionsQueue.splice(selectedIdx, 1);
  }

  return doc;
}

/**
 * Download the resume PDF
 */
function downloadResumePDFv2(resume, jobTitle = '', company = '') {
  const doc = buildResumePDFv2(resume);

  const name = (resume.contact.name || 'Resume').replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');
  const cleanCompany = company.replace(/[^a-zA-Z\s]/g, '').trim().replace(/\s+/g, '_');

  const filename = cleanCompany
    ? `${name}_${cleanCompany}_Resume.pdf`
    : `${name}_Resume.pdf`;

  doc.save(filename);
}
