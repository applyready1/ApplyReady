/**
 * resume-parser-v2.js — New structured resume parser
 * 
 * Parses PDF resume and extracts data into structured components.
 * Each section (skills, experience, education, projects) is parsed
 * into individual blocks with separate fields.
 */

/**
 * Main parsing pipeline: PDF → Text → Structured Resume
 */
async function parseResumePDFv2(pdfBuffer) {
  try {
    
    const rawText = await extractTextFromPDF(pdfBuffer);
    
    if (!rawText || rawText.length < 10) {
      throw new Error('No text could be extracted from PDF. The PDF may be scanned or encrypted.');
    }

    const cleanText = normalizeResumeText(rawText);
    
    const structuredData = parseStructuredResume(cleanText);

    return structuredData;
  } catch (error) {
    throw error;
  }
}

/**
 * Extract text from PDF (using global pdfjs library with fallback loading)
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    let pdfjsLib;

    // Try to use global pdfjsLib first
    if (typeof window.pdfjsLib !== 'undefined' && window.pdfjsLib && window.pdfjsLib.getDocument) {
      pdfjsLib = window.pdfjsLib;
    } else {
      // Fallback: try to load PDF.js using dynamic import
      try {
        // Note: This may fail in some extension contexts, but we try anyway
        const pdfModule = await import(chrome.runtime.getURL('libs/pdf.min.mjs'));
        pdfjsLib = pdfModule;
      } catch (importErr) {
        // If dynamic import fails, check if library loaded as global
        if (typeof window.pdfjs !== 'undefined' && window.pdfjs && window.pdfjs.getDocument) {
          pdfjsLib = window.pdfjs;
        } else if (typeof window.pdfjsLib !== 'undefined') {
          // Last resort - try to use undefined pdfjsLib
          pdfjsLib = window.pdfjsLib;
        } else {
          throw new Error('PDF.js library not available. Try refreshing the extension.');
        }
      }
    }

    // Verify we have the required API
    if (!pdfjsLib) {
      throw new Error('PDF.js library is undefined');
    }

    if (typeof pdfjsLib.getDocument !== 'function') {
      throw new Error(`PDF.js library missing getDocument API (got ${typeof pdfjsLib.getDocument})`);
    }

    // Set worker path if possible and not already set
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.mjs');
      } catch (err) {
      }
    }

    // Extract PDF content
    
    // Verify buffer is valid
    if (!pdfBuffer || typeof pdfBuffer !== 'object') {
      throw new Error(`Invalid PDF buffer: ${typeof pdfBuffer}`);
    }

    const pdf = await pdfjsLib.getDocument({ data: pdfBuffer }).promise;
    
    if (!pdf || !pdf.numPages) {
      throw new Error('PDF parsing returned invalid document object');
    }

    const textParts = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        
        if (!page || typeof page.getTextContent !== 'function') {
          continue;
        }

        const textContent = await page.getTextContent();

        if (!textContent || !Array.isArray(textContent.items)) {
          continue;
        }

        const lines = {};
        for (const item of textContent.items) {
          if (!item || typeof item.str === 'undefined' || !Array.isArray(item.transform)) {
            continue;
          }
          
          const y = Math.round(item.transform[5]);
          if (!lines[y]) lines[y] = [];
          lines[y].push({ x: item.transform[4], text: String(item.str) });
        }

        const sortedYs = Object.keys(lines).map(Number).sort((a, b) => b - a);
        for (const y of sortedYs) {
          const lineItems = lines[y];
          if (!Array.isArray(lineItems)) continue;
          
          lineItems.sort((a, b) => a.x - b.x);
          const lineText = lineItems.map(item => item.text).join('').trim();
          if (lineText) textParts.push(lineText);
        }
      } catch (pageErr) {
        // Continue with other pages
      }
    }

    const result = textParts.join('\n');
    
    // Safety: ensure we return a string
    if (typeof result !== 'string') {
      return '';
    }
    
    if (result.length === 0) {
      throw new Error('No text found in PDF. The file may be a scanned image.');
    }

    return result;
  } catch (error) {
    throw new Error(`PDF Extraction Error: ${error.message}`);
  }
}

/**
 * Clean and normalize extracted text
 */
function normalizeResumeText(text) {
  if (!text) return '';
  
  // Ensure text is a string
  if (typeof text !== 'string') {
    text = String(text);
  }

  let normalized = text;

  // Remove artifacts
  normalized = normalized.replace(/[%|§¶`^~]/g, '');

  // Fix letter-spacing: only target repeated patterns
  let iteration = 0;
  let prevLength;
  do {
    prevLength = normalized.length;
    // Target: 4+ continuous letter-space sequences
    normalized = normalized.replace(/([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z])/g, '$1$2$3$4');
    iteration++;
  } while (normalized.length < prevLength && iteration < 10);

  // Normalize whitespace
  normalized = normalized
    .split('\n')
    .map(line => {
      let cleaned = line.replace(/[ \t]{2,}/g, ' ').trim();
      cleaned = cleaned.replace(/\s+([,.;:!?\)\]])/g, '$1');
      return cleaned;
    })
    .filter(line => line.length > 0)
    .join('\n');

  // Remove excessive blank lines
  normalized = normalized.replace(/\n\s*\n\s*\n+/g, '\n\n');

  // Normalize special characters
  normalized = normalized
    .replace(/[–—]/g, '-')
    .replace(/[\u2022•]/g, '•')
    .replace(/([•\-\*\.])\1{2,}/g, '$1');

  return normalized;
}

/**
 * Parse text into structured resume components
 */
function parseStructuredResume(text) {
  // Defensive check: ensure text is a string
  if (!text) {
    return createEmptyResume();
  }

  if (typeof text !== 'string') {
    text = String(text);
  }

  // Split into lines and filter
  let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (!Array.isArray(lines)) {
    return createEmptyResume();
  }

  if (lines.length === 0) {
    return createEmptyResume();
  }

  const resume = createEmptyResume();

  // Extract contact info
  const contactEndIndex = extractContactInfo(lines, resume);

  // Parse sections into components
  const remainingLines = lines.slice(contactEndIndex);
  parseIntoComponents(remainingLines, resume);

  return resume;
}

/**
 * Extract contact information from top of resume
 */
function extractContactInfo(lines, resume) {
  let idx = 0;
  let nameFound = false;

  for (; idx < Math.min(lines.length, 10); idx++) {
    const line = lines[idx];

    // Check if this is a section header
    if (isSectionHeader(line)) break;

    // Extract name (first line that's not contact info)
    if (!nameFound && line.length > 5 && line.length < 60 && /^[A-Z]/.test(line) && !/[@|]/.test(line)) {
      resume.contact.name = line;
      nameFound = true;
      continue;
    }

    // Extract email
    const emailMatch = line.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) {
      resume.contact.email = emailMatch[0];
    }

    // Extract phone
    const phoneMatch = line.match(/[\+]?[\(]?\d{1,4}[\)]?[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{1,4}[\s\-\.]?\d{1,9}/);
    if (phoneMatch && line.length < 30) {
      resume.contact.phone = phoneMatch[0].trim();
    }

    // Extract LinkedIn
    if (/linkedin\.com/i.test(line)) {
      resume.contact.linkedin = line;
    }
  }

  return idx;
}

/**
 * Parse resume sections into structured components
 */
function parseIntoComponents(lines, resume) {
  // Defensive check
  if (!Array.isArray(lines)) {
    return;
  }

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    
    // Safety check on line
    if (!line || typeof line !== 'string') {
      i++;
      continue;
    }

    const sectionType = detectSectionType(line);

    if (sectionType) {
      const sectionTitle = line;
      const sectionContent = [];

      // Collect all content until next section
      i++;
      while (i < lines.length && !isSectionHeader(lines[i])) {
        sectionContent.push(lines[i]);
        i++;
      }

      // Parse based on section type
      if (sectionType === 'skills') {
        parseSkillsSection(sectionContent, resume);
      } else if (sectionType === 'experience') {
        parseExperienceSection(sectionContent, resume);
      } else if (sectionType === 'education') {
        parseEducationSection(sectionContent, resume);
      } else if (sectionType === 'projects') {
        parseProjectsSection(sectionContent, resume);
      } else if (sectionType === 'summary') {
        if (Array.isArray(sectionContent)) {
          resume.summary = sectionContent.join('\n').trim();
        }
      }
    } else {
      i++;
    }
  }
}

/**
 * Parse skills section into individual skill blocks
 */
function parseSkillsSection(lines, resume) {
  // Defensive check
  if (!Array.isArray(lines) || lines.length === 0) {
    return;
  }

  const skillText = lines.join('\n');

  // Safety check
  if (typeof skillText !== 'string') {
    return;
  }

  let currentCategory = null;
  const allSkills = [];

  for (const line of lines) {
    if (!line || typeof line !== 'string' || line.length === 0) continue;

    const trimmed = line.trim();

    // Check if this line is a category header (ends with colon)
    if (trimmed.endsWith(':') && trimmed.split(':')[0].length < 50) {
      currentCategory = trimmed.replace(':', '').trim();
      continue;
    }

    // Split line by commas or bullets to extract individual skills
    const skillItems = trimmed
      .replace(/^[•\-\*]\s*/, '')
      .split(/[,;]|\band\b/i)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    for (let skillText of skillItems) {
      // Remove parenthetical info like "(Expert)"
      skillText = skillText.replace(/\([^)]*\)/g, '').trim();

      if (skillText.length > 1 && skillText.length < 100) {
        allSkills.push({
          name: skillText,
          category: currentCategory || 'Other'
        });
      }
    }
  }

  // Add all collected skills
  for (const skillData of allSkills) {
    const skill = createSkill(skillData.name, skillData.category);
    addSkill(resume, skill);
  }
}

/**
 * Parse experience section into job blocks
 */
function parseExperienceSection(lines, resume) {
  // Defensive check
  if (!Array.isArray(lines) || lines.length === 0) {
    return;
  }

  let currentJob = null;
  const jobs = [];

  for (const line of lines) {
    if (!line || typeof line !== 'string' || !line.trim()) continue;

    // Check if this is a job title (short, capitalized, no bullet)
    if (isJobTitleLine(line)) {
      if (currentJob) {
        jobs.push(currentJob);
      }
      currentJob = {
        title: line,
        company: '',
        timeline: '',
        bullets: []
      };
    } else if (currentJob) {
      // Determine what type of content this is
      if (!currentJob.company && isCompanyLine(line)) {
        currentJob.company = line;
      } else if (!currentJob.timeline && isTimelineLine(line)) {
        currentJob.timeline = line;
      } else if (line.length > 0) {
        // It's a bullet point or description
        const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
        if (cleaned) currentJob.bullets.push(cleaned);
      }
    }
  }

  if (currentJob && currentJob.bullets.length > 0) {
    jobs.push(currentJob);
  }

  // Convert jobs to experience components
  for (const job of jobs) {
    const exp = createExperience(
      job.company,
      job.title,
      job.timeline,
      job.bullets.join('\n')
    );
    addExperience(resume, exp);
  }
}

/**
 * Parse education section into education blocks
 */
function parseEducationSection(lines, resume) {
  // Defensive check
  if (!Array.isArray(lines) || lines.length === 0) {
    return;
  }

  let currentEdu = null;
  const educations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || typeof line !== 'string' || !line.trim()) continue;

    const trimmed = line.trim();

    // Detect degree line (contains degree keywords)
    if (/\b(master|bachelor|phd|diploma|associate|degree|b\.?tech|b\.?s|m\.?tech|m\.?s)\b/i.test(trimmed)) {
      // Save previous education if exists
      if (currentEdu && (currentEdu.degree || currentEdu.school)) {
        educations.push(currentEdu);
      }

      currentEdu = {
        school: '',
        degree: trimmed,
        field: '',
        timeline: '',
        description: ''
      };
      continue;
    }

    // Only process if we have a current education entry
    if (currentEdu) {
      // Detect school/institution name (typically next line after degree)
      if (!currentEdu.school && !isTimelineLine(trimmed) && !trimmed.match(/^[gG][pP][aA]|^[cC][gG][pP][aA]/i)) {
        currentEdu.school = trimmed;
        continue;
      }

      // Detect timeline (year or date range)
      if (!currentEdu.timeline && isTimelineLine(trimmed)) {
        currentEdu.timeline = trimmed;
        continue;
      }

      // Detect GPA or other metadata
      if (trimmed.match(/^[gG][pP][aA]|^[cC][gG][pP][aA]/i)) {
        if (currentEdu.description) {
          currentEdu.description += '\n' + trimmed;
        } else {
          currentEdu.description = trimmed;
        }
        continue;
      }

      // Otherwise treat as description
      if (trimmed.length > 2) {
        if (currentEdu.description) {
          currentEdu.description += '\n' + trimmed;
        } else {
          currentEdu.description = trimmed;
        }
      }
    }
  }

  // Save last education
  if (currentEdu && (currentEdu.degree || currentEdu.school)) {
    educations.push(currentEdu);
  }

  // Add to resume
  for (const edu of educations) {
    const education = createEducation(edu.school, edu.degree, edu.field, edu.timeline, edu.description);
    addEducation(resume, education);
  }
}

/**
 * Parse projects section into project blocks
 */
function parseProjectsSection(lines, resume) {
  let currentProject = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    // Project name is typically a short capitalized line
    if (isProjectNameLine(line)) {
      if (currentProject) {
        addProject(resume, currentProject);
      }
      currentProject = createProject(line, '');
    } else if (currentProject) {
      if (!currentProject.description) {
        currentProject.description = line;
      } else {
        currentProject.description += '\n' + line;
      }
    }
  }

  if (currentProject) {
    addProject(resume, currentProject);
  }
}

// ── HELPER FUNCTIONS ───────────────────────────────────────

function isSectionHeader(line) {
  return isSectionType(line) !== null;
}

function isSectionType(line) {
  return detectSectionType(line);
}

function detectSectionType(line) {
  const trimmed = line.trim().toUpperCase();

  if (!/^[A-Z\s]+$/.test(trimmed) || trimmed.length > 60) return null;
  if (/^[•\-\*\d]/.test(trimmed)) return null;

  // Check against known patterns
  if (CONFIG && CONFIG.SECTION_PATTERNS) {
    for (const [type, pattern] of Object.entries(CONFIG.SECTION_PATTERNS)) {
      if (pattern.test(trimmed)) return type;
    }
  }

  // Fallback patterns
  if (/SKILL|COMPETENC|TECHNICAL|EXPERTISE/.test(trimmed)) return 'skills';
  if (/EXPERIENCE|EMPLOYMENT|WORK|CAREER/.test(trimmed)) return 'experience';
  if (/EDUCATION|DEGREE|ACADEMIC/.test(trimmed)) return 'education';
  if (/PROJECT/.test(trimmed)) return 'projects';
  if (/SUMMARY|PROFILE|OBJECTIVE/.test(trimmed)) return 'summary';

  return null;
}

function isJobTitleLine(line) {
  return (
    line.length > 3 &&
    line.length < 80 &&
    /^[A-Z]/.test(line) &&
    !line.includes('%') &&
    !/\d{4}|—|@/.test(line)
  );
}

function isCompanyLine(line) {
  return (
    /^[A-Z]/.test(line) &&
    line.length < 80 &&
    line.length > 3
  );
}

function isTimelineLine(line) {
  return /\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Present|Current/i.test(line);
}

function isEducationHeaderLine(line) {
  return /^[A-Z]/.test(line) && (
    /degree|bachelor|master|phd|diploma|certificate/i.test(line) ||
    (line.length < 100 && line.length > 3)
  );
}

function isSchoolNameLine(line) {
  return /^[A-Z]/.test(line) && line.length < 100 && line.length > 5;
}

function isProjectNameLine(line) {
  return /^[A-Z]/.test(line) && line.length < 80 && line.length > 3;
}
