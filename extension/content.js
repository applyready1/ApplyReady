/**
 * content.js â€” Job Description Scraper (Content Script)
 * 
 * Injected into supported job listing pages (LinkedIn, Indeed, Glassdoor, etc.).
 * Extracts the job title, company name, and full job description text from the
 * page DOM using site-specific CSS selectors defined in config.js.
 * 
 * Communicates with popup.js via chrome.runtime messaging.
 * 
 * Dependencies: config.js (JOB_SITE_SELECTORS â€” injected via manifest)
 * Injected on: Job listing pages matching manifest content_scripts patterns
 */

(function () {
  'use strict';

  /**
   * Determines which job site we're on based on the hostname.
   * @returns {string|null} - The site key matching CONFIG.JOB_SITE_SELECTORS
   */
  function detectJobSite() {
    const hostname = window.location.hostname;
    const sites = Object.keys(CONFIG.JOB_SITE_SELECTORS);

    for (const site of sites) {
      if (hostname.includes(site)) return site;
    }
    return null;
  }

  /**
   * Extracts text content from the first matching selector.
   * Tries multiple selectors (comma-separated) in case the site
   * has different DOM structures for different page variants.
   * @param {string} selectorStr - Comma-separated CSS selectors
   * @returns {string} - The extracted text, or empty string
   */
  function extractText(selectorStr) {
    const selectors = selectorStr.split(',').map(s => s.trim());

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        return el.textContent.trim();
      }
    }
    return '';
  }

  /**
   * Scrapes the current page for job listing data.
   * @returns {{ jobTitle: string, company: string, jobDescription: string, url: string, site: string } | null}
   */
  function scrapeJobListing() {
    const site = detectJobSite();
    if (!site) return null;

    const selectors = CONFIG.JOB_SITE_SELECTORS[site];
    if (!selectors) return null;

    const jobDescription = extractText(selectors.jobDescription);
    if (!jobDescription || jobDescription.length < 50) return null;

    return {
      jobTitle: extractText(selectors.jobTitle),
      company: extractText(selectors.company),
      jobDescription,
      url: window.location.href,
      site
    };
  }

  // â”€â”€ Message Listener â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Responds to messages from popup.js requesting job data

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrapeJob') {
      const data = scrapeJobListing();
      sendResponse(data);
    }
    return true; // Keep message channel open for async
  });

  // â”€â”€ Badge Notification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Notify background.js that we're on a job page so it can show a badge

  const jobData = scrapeJobListing();
  if (jobData) {
    chrome.runtime.sendMessage({
      action: 'jobPageDetected',
      hasJob: true,
      jobTitle: jobData.jobTitle,
      company: jobData.company
    });
  }
})();
