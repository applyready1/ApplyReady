/**
 * config.js — ApplyReady Configuration
 * 
 * Central configuration for LemonSqueezy integration, landing page URLs,
 * and job site selectors. All sensitive keys (if any) are server-side only.
 * The STORE_ID and PRODUCT_ID are public-facing identifiers.
 * 
 * Dependencies: None (imported by background.js, popup.js)
 */

const CONFIG = {
  // ── LemonSqueezy ──────────────────────────────────────────
  // Product page where users purchase the license
  LEMONSQUEEZY_STORE_ID: 'PLACEHOLDER_STORE_ID',
  LEMONSQUEEZY_PRODUCT_ID: 'PLACEHOLDER_PRODUCT_ID',
  CHECKOUT_URL: 'https://PLACEHOLDER.lemonsqueezy.com/buy/PLACEHOLDER',

  // License validation endpoint (LemonSqueezy built-in, no API key needed)
  LICENSE_VALIDATE_URL: 'https://api.lemonsqueezy.com/v1/licenses/validate',
  LICENSE_ACTIVATE_URL: 'https://api.lemonsqueezy.com/v1/licenses/activate',

  // ── Web Pages (Vercel) ────────────────────────────────────
  LANDING_PAGE_URL: 'https://applyready-lake.vercel.app',
  WELCOME_PAGE_URL: 'https://applyready-lake.vercel.app/welcome',
  PRIVACY_POLICY_URL: 'https://applyready-lake.vercel.app/',

  // ── Extension Settings ────────────────────────────────────
  // FREE_MODE: Set to 1 to unlock all features for free (no license needed).
  // Set to 0 to require a paid license key for PDF download.
  FREE_MODE: 0,

  PRODUCT_NAME: 'ApplyReady',
  // PRICE_AMOUNT: Change this single value to update the price everywhere.
  // Displayed in USD. Available globally — LemonSqueezy auto-converts to the
  // buyer's local currency (EUR, GBP, INR, etc.) at checkout.
  PRICE_AMOUNT: 4.99,
  get PRICE() { return `$${this.PRICE_AMOUNT % 1 === 0 ? this.PRICE_AMOUNT : this.PRICE_AMOUNT.toFixed(2)}`; },
  VERSION: '1.0.0',

  // ── URL Keyword Patterns ──────────────────────────────────
  // Keywords in URL that indicate a job listing page
  JOB_URL_KEYWORDS: [
    'job', 'jobs', 'career', 'careers', 'position', 'positions',
    'posting', 'postings', 'opening', 'openings', 'listing', 'listings',
    'vacancy', 'vacancies', 'hire', 'hiring', 'recruit', 'opportunity',
    'role', 'roles', 'apply', 'application', 'recruit', 'employment',
    'vjk', // Indeed parameter
    'jk',  // Indeed job key
    'q-',  // Indeed search
  ],

  // ── Job Site Selectors ────────────────────────────────────
  // CSS selectors to extract job descriptions from supported sites
  JOB_SITE_SELECTORS: {
    'linkedin.com': {
      jobDescription: '.jobs-description__content, .jobs-box__html-content, .description__text',
      jobTitle: '.t-24.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title',
      company: '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name'
    },
    'indeed.com': {
      jobDescription: '#jobDescriptionText, .jobsearch-jobDescriptionText, [id*="jobDescriptionText"], div[role="region"] > div, .js-job-details-module, [data-automation-id="jobDescriptionText"], .showerd div',
      jobTitle: '.jobsearch-JobInfoHeader-title, h1[data-testid="jobsearch-JobInfoHeader-title"], h1, [data-automation-id="jobPostingHeader"] h1, div.estimatedSalary ~ h1, .job_header h1',
      company: '[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyRating-companyHeader, [data-automation-id="inlineHeader-companyName"], .jobsearch-InlineCompanyRating-companyHeader, .cmp-company-name, a[data-tn-element="companyName"]'
    },
    'glassdoor.com': {
      jobDescription: '.JobDetails_jobDescription__uW_fK, .desc, #JobDescriptionContainer',
      jobTitle: '.JobDetails_jobTitle__Rw_gn, [data-test="job-title"]',
      company: '.EmployerProfile_compactEmployerName__LE242, [data-test="employer-name"]'
    },
    'glassdoor.co.in': {
      jobDescription: '.JobDetails_jobDescription__uW_fK, .desc, #JobDescriptionContainer',
      jobTitle: '.JobDetails_jobTitle__Rw_gn, [data-test="job-title"]',
      company: '.EmployerProfile_compactEmployerName__LE242, [data-test="employer-name"]'
    },
    'ziprecruiter.com': {
      jobDescription: '.job_description, .jobDescriptionSection',
      jobTitle: '.job_title, h1.title',
      company: '.hiring_company, .company_name'
    },
    'monster.com': {
      jobDescription: '.description, .job-description',
      jobTitle: '.title, h1',
      company: '.company, .name'
    },
    'dice.com': {
      jobDescription: '#jobDescription, .job-description',
      jobTitle: '[data-cy="jobTitle"], h1',
      company: '[data-cy="companyNameLink"], .company-name'
    },
    'lever.co': {
      jobDescription: '.section-wrapper.page-full-width, [class*="posting-"]',
      jobTitle: '.posting-headline h2',
      company: '.posting-headline .company-name'
    },
    'greenhouse.io': {
      jobDescription: '#content, .job-post',
      jobTitle: '.job-title, h1',
      company: '.company-name'
    },
    'myworkdayjobs.com': {
      jobDescription: '[data-automation-id="jobPostingDescription"]',
      jobTitle: '[data-automation-id="jobPostingHeader"] h2',
      company: '[data-automation-id="jobPostingHeader"] .css-1t5f0fr'
    }
  },

  // ── Resume Section Patterns ───────────────────────────────
  // Regex patterns to detect section headers when parsing a resume
  SECTION_PATTERNS: {
    summary: /^(summary|professional\s*summary|objective|profile|about\s*me|career\s*(?:summary|objective|profile))/i,
    skills: /^(skills|technical\s*skills|core\s*competencies|technologies|areas?\s*of\s*expertise|proficiencies)/i,
    experience: /^(experience|work\s*experience|employment|professional\s*experience|work\s*history|career\s*history)/i,
    education: /^(education|academic|qualifications|degrees?|academic\s*background)/i,
    projects: /^(projects|personal\s*projects|portfolio|key\s*projects|selected\s*projects)/i,
    certifications: /^(certifications?|licenses?|credentials|professional\s*development)/i,
    awards: /^(awards?|honors?|achievements?|recognition)/i,
    publications: /^(publications?|papers?|research)/i,
    volunteer: /^(volunteer|community\s*service|extracurricular)/i,
    languages: /^(languages?|language\s*skills)/i
  },

  // ── Stop Words ────────────────────────────────────────────
  // Common English words to exclude from keyword matching
  STOP_WORDS: new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'must',
    'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
    'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
    'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
    'not', 'no', 'nor', 'if', 'then', 'else', 'also', 'just', 'about',
    'up', 'out', 'so', 'than', 'too', 'very', 'from', 'into', 'over',
    'after', 'before', 'between', 'under', 'above', 'such', 'each',
    'all', 'any', 'both', 'few', 'more', 'most', 'some', 'other',
    'new', 'old', 'well', 'way', 'use', 'used', 'using', 'work',
    'working', 'including', 'etc', 'e.g', 'i.e', 'ability', 'able',
    'across', 'within', 'without', 'through', 'during', 'while',
    'strong', 'experience', 'excellent', 'good', 'knowledge',
    'required', 'preferred', 'minimum', 'plus', 'years', 'year',
    'role', 'position', 'job', 'company', 'team', 'time', 'based',
    'looking', 'join', 'part', 'full', 'equal', 'opportunity', 'employer'
  ])
};
