/**
 * keyword-matcher.js — ATS Keyword Extraction & Matching Engine
 * 
 * Extracts meaningful keywords/phrases from job descriptions,
 * compares them against the user's resume sections, and produces
 * a match score with lists of matching and missing keywords.
 * 
 * Uses TF-based extraction with stop-word filtering.
 * All processing is 100% client-side.
 * 
 * Dependencies: config.js (STOP_WORDS)
 * Imported by: popup.js
 */

/**
 * Tokenizes text into lowercase words, removing punctuation.
 * @param {string} text - Raw text to tokenize
 * @returns {string[]} - Array of cleaned tokens
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\+\#\.\-\/\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
}

/**
 * Extracts meaningful keywords from text by filtering stop words
 * and ranking by frequency. Returns top keywords.
 * @param {string} text - The text to extract keywords from
 * @param {number} maxKeywords - Maximum keywords to return (default: 50)
 * @returns {string[]} - Ranked keywords (most frequent first)
 */
function extractKeywords(text, maxKeywords = 50) {
  const tokens = tokenize(text);
  const freq = {};

  for (const token of tokens) {
    if (CONFIG.STOP_WORDS.has(token)) continue;
    if (token.length < 2) continue;
    // Skip pure numbers unless they look like versions (e.g., "3.0")
    if (/^\d+$/.test(token)) continue;
    freq[token] = (freq[token] || 0) + 1;
  }

  // Sort by frequency descending
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

/**
 * Extracts multi-word technical phrases (bigrams/trigrams) that appear
 * in the job description. Catches terms like "machine learning", "project management".
 * @param {string} text - The text to extract phrases from
 * @returns {string[]} - Array of multi-word phrases
 */
function extractPhrases(text) {
  const phrases = [];
  const lines = text.toLowerCase().split(/[\n.;,]+/);

  // Common multi-word tech/business terms to look for
  const knownPhrases = [
    'machine learning', 'deep learning', 'artificial intelligence',
    'natural language processing', 'computer vision', 'data science',
    'data engineering', 'data analysis', 'data visualization',
    'project management', 'product management', 'program management',
    'agile methodology', 'scrum master', 'software engineering',
    'full stack', 'front end', 'back end', 'dev ops', 'devops',
    'ci cd', 'continuous integration', 'continuous deployment',
    'cloud computing', 'amazon web services', 'google cloud',
    'microsoft azure', 'version control', 'unit testing',
    'user experience', 'user interface', 'ui ux',
    'supply chain', 'business intelligence', 'quality assurance',
    'cross functional', 'stakeholder management', 'problem solving',
    'communication skills', 'team leadership', 'process improvement',
    'six sigma', 'lean manufacturing', 'root cause analysis',
    'customer service', 'account management', 'sales operations',
    'financial analysis', 'risk management', 'regulatory compliance',
    'power bi', 'google analytics', 'rest api', 'graphql',
    'react native', 'node js', 'vue js', 'angular js',
    'spring boot', 'ruby on rails', 'asp net',
    'sql server', 'no sql', 'mongo db', 'postgre sql',
    'docker container', 'kubernetes', 'micro services',
    'test driven', 'object oriented', 'design patterns',
    'system design', 'distributed systems', 'high availability'
  ];

  const textLower = text.toLowerCase();
  for (const phrase of knownPhrases) {
    if (textLower.includes(phrase)) {
      phrases.push(phrase);
    }
  }

  return phrases;
}

/**
 * Compares job description keywords against resume content.
 * Returns match score, matching keywords, and missing keywords.
 * 
 * @param {string} jobDescription - The full job description text
 * @param {{ contact: Object, sections: Array }} resumeData - Parsed resume
 * @returns {{
 *   score: number,
 *   matchingKeywords: string[],
 *   missingKeywords: string[],
 *   matchingPhrases: string[],
 *   missingPhrases: string[],
 *   sectionScores: Object,
 *   totalJDKeywords: number
 * }}
 */
function matchKeywords(jobDescription, resumeData) {
  // Extract keywords and phrases from JD
  const jdKeywords = extractKeywords(jobDescription);
  const jdPhrases = extractPhrases(jobDescription);

  // Build full resume text from all sections
  const resumeText = resumeData.sections
    .map(s => s.content)
    .join('\n');
  const resumeTextLower = resumeText.toLowerCase();
  const resumeTokens = new Set(tokenize(resumeText));

  // Match single keywords
  const matchingKeywords = [];
  const missingKeywords = [];
  for (const keyword of jdKeywords) {
    if (resumeTokens.has(keyword)) {
      matchingKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  }

  // Match phrases
  const matchingPhrases = [];
  const missingPhrases = [];
  for (const phrase of jdPhrases) {
    if (resumeTextLower.includes(phrase)) {
      matchingPhrases.push(phrase);
    } else {
      missingPhrases.push(phrase);
    }
  }

  // Calculate per-section relevance scores (for reordering)
  const sectionScores = {};
  for (const section of resumeData.sections) {
    const sectionTokens = new Set(tokenize(section.content));
    let sectionMatches = 0;
    for (const keyword of jdKeywords) {
      if (sectionTokens.has(keyword)) sectionMatches++;
    }
    sectionScores[section.type] = jdKeywords.length > 0
      ? Math.round((sectionMatches / jdKeywords.length) * 100)
      : 0;
  }

  // Overall score: combination of keyword match + phrase match
  const totalItems = jdKeywords.length + jdPhrases.length;
  const matchedItems = matchingKeywords.length + matchingPhrases.length;
  const score = totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0;

  return {
    score,
    matchingKeywords,
    missingKeywords,
    matchingPhrases,
    missingPhrases,
    sectionScores,
    totalJDKeywords: totalItems
  };
}

/**
 * Reorders resume sections by relevance to the job description.
 * Summary always stays first. Other sections sorted by their match score.
 * @param {Array} sections - The resume sections array
 * @param {Object} sectionScores - Scores from matchKeywords()
 * @returns {Array} - Reordered sections array (new copy)
 */
function reorderSections(sections, sectionScores) {
  const copy = [...sections];

  // Separate summary (always first) from other sections
  const summaryIndex = copy.findIndex(s => s.type === 'summary');
  let summary = null;
  if (summaryIndex >= 0) {
    summary = copy.splice(summaryIndex, 1)[0];
  }

  // Sort remaining sections by relevance score (descending)
  copy.sort((a, b) => {
    const scoreA = sectionScores[a.type] || 0;
    const scoreB = sectionScores[b.type] || 0;
    return scoreB - scoreA;
  });

  // Put summary back at the top
  if (summary) copy.unshift(summary);

  return copy;
}

/**
 * Highlights matching keywords within a text by wrapping them in <mark> tags.
 * Used when rendering the resume preview in the popup.
 * @param {string} text - The section content
 * @param {string[]} keywords - Keywords to highlight
 * @returns {string} - Text with <mark> tags around matching keywords
 */
function highlightKeywords(text, keywords) {
  if (!keywords.length) return text;

  // Escape special regex characters in keywords
  const escaped = keywords.map(k =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );

  // Build regex that matches whole words only
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}
