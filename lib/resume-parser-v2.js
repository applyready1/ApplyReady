/**
 * resume-parser-v2.js — New structured resume parser
 * 
 * Parses PDF resume and extracts data into structured components.
 * Each section (skills, experience, education, projects) is parsed
 * into individual blocks with separate fields.
 */

import { createEmptyResume, createSkill, createExperience, createEducation, createProject } from './resume-data';

/**
 * Main parsing pipeline: PDF → Text → Structured Resume
 */
export async function parseResumePDFv2(pdfBuffer) {
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

async function getPdfJsLibrary() {
  if (typeof window === 'undefined') {
    throw new Error('PDF parsing is only available in the browser.');
  }

  if (window.pdfjsLib?.getDocument) {
    return window.pdfjsLib;
  }

  if (!window.__applyReadyPdfJsPromise) {
    window.__applyReadyPdfJsPromise = import(/* webpackIgnore: true */ '/libs/pdf.min.mjs')
      .then((pdfModule) => {
        window.pdfjsLib = pdfModule;
        return pdfModule;
      })
      .catch((error) => {
        window.__applyReadyPdfJsPromise = null;
        throw error;
      });
  }

  return window.__applyReadyPdfJsPromise;
}

/**
 * Extract text from PDF (using global pdfjs library with fallback loading)
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    const pdfjsLib = await getPdfJsLibrary();

    // Verify we have the required API
    if (!pdfjsLib) {
      throw new Error('PDF.js library is undefined');
    }

    if (typeof pdfjsLib.getDocument !== 'function') {
      throw new Error(`PDF.js library missing getDocument API (got ${typeof pdfjsLib.getDocument})`);
    }

    // Set worker path if possible and not already set
    if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/libs/pdf.worker.min.mjs';
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

function normalizeResumeText(text) {
  if (!text) return '';
  
  // Ensure text is a string
  if (typeof text !== 'string') {
    text = String(text);
  }

  let normalized = text;

  // Fix letter-spacing FIRST: remove all spaced-out letters (pattern like "E x e c u t e d")
  // Use a loop to handle any length sequences of spaced letters
  let prevLength;
  let iterations = 0;
  do {
    prevLength = normalized.length;
    // Remove spaces between single letters: "X y z" -> "Xyz"
    normalized = normalized.replace(/([a-zA-Z])\s([a-zA-Z])\s([a-zA-Z])/g, '$1$2$3');
    iterations++;
  } while (normalized.length !== prevLength && iterations < 20);

  // Remove artifacts and bullet markers
  // Remove % followed by letters (like "%I"), then remove remaining symbols
  normalized = normalized.replace(/%[a-zA-Z]\s*/g, '');
  normalized = normalized.replace(/[%|§¶`^~]/g, '');

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
  if (resume.projects.length === 0) {
    recoverProjectsFromUnparsedLines(remainingLines, resume);
  }

  return resume;
}

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
        parseSkillsSection(sectionContent, resume, sectionTitle);
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

function parseSkillsSection(lines, resume, sectionTitle = '') {
  // Defensive check
  if (!Array.isArray(lines) || lines.length === 0) {
    return;
  }

  const skillText = lines.join('\n');

  // Safety check
  if (typeof skillText !== 'string') {
    return;
  }

  const defaultCategory = getDefaultSkillCategory(sectionTitle);
  const isSoftSkillSection = /soft\s*skills?/i.test(sectionTitle);
  let currentCategory = defaultCategory;
  const allSkills = [];
  let lastSkill = null;

  for (const line of lines) {
    if (!line || typeof line !== 'string' || line.length === 0) continue;

    const trimmed = cleanSkillLine(line);
    if (!trimmed) continue;

    // Check if this line is a category header (ends with colon)
    if (trimmed.endsWith(':') && trimmed.split(':')[0].length < 50) {
      currentCategory = normalizeSkillCategory(trimmed.replace(':', '').trim(), defaultCategory);
      lastSkill = null;
      continue;
    }

    const inlineCategory = parseInlineSkillCategory(trimmed);

    if (inlineCategory) {
      const category = isSoftSkillSection
        ? defaultCategory
        : normalizeSkillCategory(inlineCategory.category, defaultCategory);

      if (isSoftSkillSection) {
        lastSkill = addSkillCandidate(allSkills, inlineCategory.category, category, inlineCategory.value);
        continue;
      }

      currentCategory = category;
      const skillItems = splitSkillValues(inlineCategory.value);
      for (const skillText of skillItems) {
        lastSkill = addSkillCandidate(allSkills, skillText, currentCategory);
      }
      continue;
    }

    if (isSoftSkillSection) {
      if (lastSkill) {
        lastSkill.proficiency = [lastSkill.proficiency, trimmed].filter(Boolean).join(' ');
      }
      continue;
    }

    const skillItems = splitSkillValues(trimmed);
    for (const skillText of skillItems) {
      lastSkill = addSkillCandidate(allSkills, skillText, currentCategory);
    }
  }

  // Add all collected skills
  for (const skillData of allSkills) {
    const skill = createSkill(skillData.name, skillData.category, skillData.proficiency || '');
    resume.skills.push(skill);
  }
}

function cleanSkillLine(line) {
  return String(line)
    .replace(/^%[a-zA-Z]\s*/g, '')
    .replace(/^[•\-\*§¶`^~]+\s*/g, '')
    .replace(/^\d+\.\s*/g, '')
    .replace(/^[a-zA-Z]\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDefaultSkillCategory(sectionTitle) {
  if (/soft\s*skills?/i.test(sectionTitle)) return 'Soft Skills';
  if (/technical\s*skills?/i.test(sectionTitle)) return 'Technical Skills';
  return 'Skills';
}

function normalizeSkillCategory(category, fallback) {
  const cleaned = cleanSkillLine(category).replace(/[:]+$/g, '').trim();
  return cleaned || fallback || 'Skills';
}

function parseInlineSkillCategory(line) {
  const colonIndex = line.indexOf(':');
  if (colonIndex <= 0) return null;

  const category = line.slice(0, colonIndex).trim();
  const value = line.slice(colonIndex + 1).trim();
  if (!value || category.length > 70) return null;
  if (!/^[A-Za-z][A-Za-z0-9/&+\-\s]+$/.test(category)) return null;

  return { category, value };
}

function splitSkillValues(value) {
  return value
    .split(/[,;]|\s{2,}/)
    .map(skill => skill.replace(/\([^)]*\)/g, '').trim())
    .filter(skill => skill.length > 0 && skill.length < 80);
}

function addSkillCandidate(skills, name, category, proficiency = '') {
  const cleanName = cleanSkillLine(name).replace(/[:]+$/g, '').trim();
  if (!cleanName || cleanName.length > 80) return null;

  const duplicate = skills.find(skill => skill.name.toLowerCase() === cleanName.toLowerCase());
  if (duplicate) return duplicate;

  const skill = {
    name: cleanName,
    category: category || 'Skills',
    proficiency: proficiency ? cleanSkillLine(proficiency) : ''
  };
  skills.push(skill);
  return skill;
}

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
        // It's a description line - clean all leading bullet/index markers
        // Matches: %X, •, -, *, numbers with dot, letters with dot, and remaining symbols
        let cleaned = line
          .replace(/^%[a-zA-Z]\s*/g, '')  // Remove %I, %1, etc.
          .replace(/^[•\-\*§¶`^~]+\s*/g, '')  // Remove bullet symbols
          .replace(/^\d+\.\s*/g, '')  // Remove numbered list (1. 2. etc)
          .replace(/^[a-zA-Z]\)\s*/g, '')  // Remove lettered list (a) b) etc)
          .trim();
        if (cleaned && cleaned.length > 0) {
          currentJob.bullets.push(cleaned);
        }
      }
    }
  }

  if (currentJob && currentJob.bullets.length > 0) {
    jobs.push(currentJob);
  }

  // Convert jobs to experience components - join without bullet points
  for (const job of jobs) {
    // Create description without bullet characters
    const description = job.bullets.join('\n');
    const exp = createExperience(
      job.company,
      job.title,
      job.timeline,
      description
    );
    resume.experience.push(exp);
  }
}

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

      // Otherwise treat as description (clean bullets)
      if (trimmed.length > 2) {
        let cleaned = trimmed
          .replace(/^%[a-zA-Z]\s*/g, '')  // Remove %I, %1, etc.
          .replace(/^[•\-\*§¶`^~]+\s*/g, '')  // Remove bullet symbols
          .replace(/^\d+\.\s*/g, '')  // Remove numbered list
          .replace(/^[a-zA-Z]\)\s*/g, '')  // Remove lettered list
          .trim();
        if (cleaned) {
          if (currentEdu.description) {
            currentEdu.description += '\n' + cleaned;
          } else {
            currentEdu.description = cleaned;
          }
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
    resume.education.push(education);
  }
}

function parseProjectsSection(lines, resume) {
  let currentProject = null;

  for (const line of lines) {
    const cleaned = cleanProjectLine(line);
    if (!cleaned) continue;

    const hadLeadingBullet = hasLeadingListMarker(line);
    const inlineProject = parseInlineProjectLine(cleaned);

    if (inlineProject && (!hadLeadingBullet || !currentProject)) {
      if (currentProject) saveProject(resume, currentProject);
      currentProject = createProject(inlineProject.name, inlineProject.description);
      continue;
    }

    if (!currentProject) {
      if (!hadLeadingBullet && isProjectNameLine(cleaned)) {
        currentProject = createProject(cleaned, '');
      } else {
        currentProject = createProject('Project', cleaned);
      }
      continue;
    }

    if (!hadLeadingBullet && isProjectNameLine(cleaned)) {
      saveProject(resume, currentProject);
      currentProject = createProject(cleaned, '');
      continue;
    }

    appendProjectDescription(currentProject, cleaned);
  }

  if (currentProject) {
    saveProject(resume, currentProject);
  }
}

function cleanProjectLine(line) {
  return String(line)
    .replace(/^%[a-zA-Z]\s*/g, '')
    .replace(/^[•\-\*§¶`^~]+\s*/g, '')
    .replace(/^\d+\.\s*/g, '')
    .replace(/^[a-zA-Z]\)\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasLeadingListMarker(line) {
  return /^\s*(%[a-zA-Z]|[•\-\*§¶`^~]|\d+\.|[a-zA-Z]\))\s*/.test(String(line));
}

function parseInlineProjectLine(line) {
  const delimiter = line.match(/\s(?:[-–—|])\s|:/);
  if (!delimiter) return null;

  const index = delimiter.index;
  const name = line.slice(0, index).trim();
  const description = line.slice(index + delimiter[0].length).trim();

  if (!description || !isProjectNameLine(name)) return null;
  return { name, description };
}

function appendProjectDescription(project, text) {
  if (!text) return;
  if (!project.description) {
    project.description = text;
  } else {
    project.description += '\n' + text;
  }
}

function saveProject(resume, project) {
  if (!project) return;

  const name = cleanProjectLine(project.name || '');
  const description = cleanProjectLine(project.description || '');
  if (!name && !description) return;

  const isDuplicate = resume.projects.some(existing => {
    return (
      (existing.name || '').toLowerCase() === name.toLowerCase() &&
      (existing.description || '').toLowerCase() === description.toLowerCase()
    );
  });

  if (!isDuplicate) {
    resume.projects.push({
      ...project,
      name: name || 'Project',
      description
    });
  }
}

function recoverProjectsFromUnparsedLines(lines, resume) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (detectSectionType(line) !== 'projects') continue;

    const sectionContent = [];
    i++;
    while (i < lines.length && !isSectionHeader(lines[i])) {
      sectionContent.push(lines[i]);
      i++;
    }

    if (sectionContent.length > 0) {
      const beforeCount = resume.projects.length;
      parseProjectsSection(sectionContent, resume);
      if (resume.projects.length > beforeCount) {
        return;
      }
    }
  }
}

// ── HELPER FUNCTIONS ───────────────────────────────────────

const SECTION_PATTERNS = {
  summary: /^(summary|professional\s*summary|objective|profile|about\s*me|career\s*(?:summary|objective|profile))/i,
  skills: /^(skills|technical\s*skills|core\s*competencies|technologies|areas?\s*of\s*expertise|proficiencies)/i,
  experience: /^(experience|work\s*experience|employment|professional\s*experience|work\s*history|career\s*history)/i,
  projects: /^(projects?|personal\s*projects?|academic\s*projects?|key\s*projects?|selected\s*projects?|relevant\s*projects?|engineering\s*projects?|project\s*(?:work|experience|portfolio)|portfolio)/i,
  education: /^(education|academic\s*(?:background|history|qualifications?)|qualifications|degrees?|academic\s*background)/i,
  certifications: /^(certifications?|licenses?|credentials|professional\s*development)/i,
  awards: /^(awards?|honors?|achievements?|recognition)/i,
  volunteer: /^(volunteer|community\s*service|extracurricular)/i,
  languages: /^(languages?|language\s*skills)/i
};

function isSectionHeader(line) {
  return isSectionType(line) !== null;
}

function isSectionType(line) {
  return detectSectionType(line);
}

function detectSectionType(line) {
  const raw = line.trim();

  if (!raw || raw.length > 80) return null;
  if (/^[•\-\*\d]/.test(raw)) return null;
  if (raw.includes(':') && raw.split(':').slice(1).join(':').trim()) return null;

  const trimmed = raw
    .replace(/[&/+|\-]/g, ' ')
    .replace(/[:\-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (!/^[A-Z\s]+$/.test(trimmed) || trimmed.length > 60) return null;

  for (const [type, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(trimmed)) return type;
  }

  // Fallback patterns
  if (/SKILL|COMPETENC|TECHNICAL|EXPERTISE/.test(trimmed)) return 'skills';
  if (/EXPERIENCE|EMPLOYMENT|WORK|CAREER/.test(trimmed)) return 'experience';
  if (/EDUCATION|DEGREE/.test(trimmed)) return 'education';
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

function isProjectNameLine(line) {
  const cleaned = cleanProjectLine(line);
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;

  return (
    /^[A-Za-z0-9]/.test(cleaned) &&
    cleaned.length > 2 &&
    cleaned.length < 110 &&
    wordCount <= 14 &&
    !/[.!?]$/.test(cleaned)
  );
}
