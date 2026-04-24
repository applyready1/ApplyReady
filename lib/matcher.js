export function analyzeJobMatch(jobDescription, resumeData) {
  if (!jobDescription || !resumeData) {
    return {
      score: 0,
      matchingKeywords: [],
      missingKeywords: [],
      missingPhrases: [],
      suggestedSectionOrder: [],
      requiredMatched: 0,
      requiredTotal: 0
    };
  }

  const SKILL_ALIASES = {
    'javascript': ['js', 'node.js', 'nodejs', 'es6', 'ecmascript'],
    'machine learning': ['ml', 'ai/ml', 'predictive modeling', 'deep learning'],
    'project management': ['pmp', 'scrum master', 'agile', 'program management'],
    'sql': ['mysql', 'postgresql', 'postgres', 't-sql', 'plsql'],
    'react': ['reactjs', 'react.js', 'next.js', 'nextjs'],
    'python': ['python3', 'pandas', 'numpy'],
    'aws': ['amazon web services', 'ec2', 's3'],
    'gcp': ['google cloud platform', 'google cloud'],
    'azure': ['microsoft azure'],
    'ci/cd': ['continuous integration', 'continuous deployment', 'jenkins', 'github actions']
  };

  function matchWithAliases(text, keyword) {
    if (!text || !keyword) return false;
    const aliases = SKILL_ALIASES[keyword.toLowerCase()] || [];
    const allTerms = [keyword, ...aliases];
    const textLower = text.toLowerCase();
    return allTerms.some(term => {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
      return regex.test(textLower);
    });
  }

  function extractJDSkillsSection(fullText) {
    const sectionHeaders = ['requirements', 'qualifications', "what you'll need", 'skills', 'you have', "we're looking for", 'must have', 'what you bring', 'experience'];
    const lines = fullText.split('\n');
    let inSkillsSection = false;
    const skillLines = [];
    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      if (sectionHeaders.some(h => lowerLine.includes(h) && line.length < 50)) inSkillsSection = true;
      if (inSkillsSection && /^(about|benefits|compensation|salary|what we offer|who we are|perks)/i.test(line) && line.length < 50) inSkillsSection = false;
      if (inSkillsSection) skillLines.push(line);
    });
    const result = skillLines.join('\n').trim();
    return result.length > 50 ? result : fullText;
  }

  function classifyKeywords(jdText) {
    const required = new Set();
    const preferred = new Set();
    const lines = jdText.split('\n');
    lines.forEach(line => {
      const isRequired = /must|required|essential|minimum|you have/i.test(line);
      const isPreferred = /preferred|nice to have|bonus|ideally|plus/i.test(line);
      const skills = extractTechnicalKeywords(line);
      if (isRequired) skills.forEach(s => required.add(s));
      else if (isPreferred) skills.forEach(s => preferred.add(s));
      else skills.forEach(s => required.add(s));
    });
    return { required: Array.from(required), preferred: Array.from(preferred) };
  }

  let resumeText = '';
  if (resumeData.contact) resumeText += `${resumeData.contact.name} `;
  if (resumeData.skills) resumeText += resumeData.skills.map(s => `${s.name}`).join(' ');
  if (resumeData.experience) resumeText += resumeData.experience.map(e => `${e.title} ${e.company} ${e.description}`).join(' ');
  if (resumeData.education) resumeText += resumeData.education.map(e => `${e.degree} ${e.school}`).join(' ');
  if (resumeData.projects) resumeText += resumeData.projects.map(p => `${p.name} ${p.description}`).join(' ');
  resumeText = resumeText.toLowerCase();

  const resumeSectionsText = {
    experience: resumeData.experience?.map(e => `${e.title} ${e.company} ${e.description}`).join(' ') || '',
    skills: resumeData.skills?.map(s => `${s.name} ${s.category}`).join(' ') || '',
    summary: resumeData.summary || '',
    education: resumeData.education?.map(e => `${e.degree} ${e.school} ${e.description}`).join(' ') || '',
    projects: resumeData.projects?.map(p => `${p.name} ${p.description}`).join(' ') || ''
  };

  const focusedJD = extractJDSkillsSection(jobDescription);
  const classified = classifyKeywords(focusedJD);
  const requiredKeywords = classified.required;
  const preferredKeywords = classified.preferred;
  
  const allKeywordsSet = new Set([...requiredKeywords, ...preferredKeywords]);
  if (allKeywordsSet.size === 0) extractTechnicalKeywords(jobDescription).forEach(k => allKeywordsSet.add(k));
  const jobKeywords = Array.from(allKeywordsSet);

  const matchingKeywords = [];
  const missingKeywords = [];
  let totalWeight = 0, matchedWeight = 0;

  const SECTION_WEIGHTS = { experience: 1.5, projects: 1.2, summary: 1.2, skills: 1.0, education: 0.7 };
  const SECTION_LABELS = {
    experience: 'Experience',
    skills: 'Skills',
    projects: 'Projects',
    summary: 'Summary',
    education: 'Education'
  };

  jobKeywords.forEach(keyword => {
    let isMatch = false;
    let maxWeightFound = 0;
    for (const [section, text] of Object.entries(resumeSectionsText)) {
      if (matchWithAliases(text, keyword)) {
        isMatch = true;
        maxWeightFound = Math.max(maxWeightFound, SECTION_WEIGHTS[section] || 1.0);
      }
    }
    totalWeight += 1.0; 
    if (isMatch) {
      matchingKeywords.push(keyword);
      matchedWeight += maxWeightFound || 1.0;
    } else {
      missingKeywords.push(keyword);
    }
  });

  const jobPhrases = extractActionablePhrases(focusedJD);
  const missingPhrases = jobPhrases.filter(phrase => !matchWithAliases(resumeText, phrase)).slice(0, 5);
  const suggestedSectionOrder = Object.entries(resumeSectionsText)
    .map(([section, text]) => {
      const matches = jobKeywords.filter(keyword => matchWithAliases(text, keyword)).length;
      return {
        section,
        matches,
        score: matches * (SECTION_WEIGHTS[section] || 1)
      };
    })
    .filter(item => item.matches > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => SECTION_LABELS[item.section] || item.section);

  const technicalKeywordScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 50;
  let reqMatched = 0, reqTotal = requiredKeywords.length;
  requiredKeywords.forEach(kw => { if(matchWithAliases(resumeText, kw)) reqMatched++; });
  
  let baseScore = Math.min(100, technicalKeywordScore);
  if (resumeText.includes('experience') && resumeData.skills?.length > 0) baseScore = Math.min(100, baseScore + 10);

  return {
    score: Math.min(100, Math.max(0, baseScore)),
    matchingKeywords: matchingKeywords.slice(0, 15),
    missingKeywords: missingKeywords.slice(0, 15),
    missingPhrases: missingPhrases,
    suggestedSectionOrder,
    requiredMatched: reqMatched,
    requiredTotal: reqTotal
  };
}

function extractTechnicalKeywords(text) {
  if (!text) return [];
  const textLower = text.toLowerCase();
  const found = new Set();
  const allKeywords = {
    programming: ['Python', 'JavaScript', 'Java', 'C++', 'C#', 'Ruby', 'Go', 'Rust', 'PHP', 'TypeScript', 'React', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'Spring Boot', 'HTML', 'CSS', 'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git', 'CI/CD', 'REST API'],
    business: ['Financial modeling', 'Budgeting', 'Forecasting', 'Analysis', 'Reporting', 'SAP', 'Oracle', 'Excel', 'Salesforce', 'CRM', 'ROI', 'KPI', 'Data Analysis', 'Project Management', 'Agile', 'Scrum'],
    marketing: ['SEO', 'SEM', 'Google Analytics', 'Social Media Marketing', 'Email Marketing', 'Content Marketing', 'Adobe Creative Suite', 'Photoshop', 'Copywriting', 'HubSpot', 'Mailchimp', 'Google Ads'],
    data: ['Data Analysis', 'SQL', 'Python', 'R', 'Tableau', 'Power BI', 'Machine Learning', 'Statistics', 'Business Intelligence', 'ETL', 'Data Visualization', 'Google Analytics', 'BigQuery']
  };
  for (const [category, keywords] of Object.entries(allKeywords)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(textLower)) found.add(keyword);
    }
  }
  return Array.from(found).filter(k => k.length > 2);
}

function extractActionablePhrases(text) {
  if (!text) return [];
  const actionablePhrases = ['end-to-end development', 'full stack', 'frontend development', 'backend development', 'performance optimization', 'database design', 'team leadership', 'automated testing', 'data analysis', 'strategic planning', 'project management', 'revenue growth'];
  const textLower = text.toLowerCase();
  return actionablePhrases.filter(phrase => textLower.includes(phrase.toLowerCase())).slice(0, 5);
}
