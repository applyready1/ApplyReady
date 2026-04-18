/**
 * content.js — Job Description Scraper (Content Script)
 * 
 * Intelligently detects job listing pages using:
 * 1. URL keyword matching (flexible, works across regions)
 * 2. Site-specific selectors (accurate, proven on major job boards)
 * 3. Generic fallback (attempts to extract from any page)
 * 
 * Supports both automatic detection and manual scraping.
 */

(function () {
  'use strict';

  // Check if CONFIG is available, if not wait for it
  if (typeof CONFIG === 'undefined') {
    let retries = 0;
    const checkConfig = setInterval(() => {
      retries++;
      if (typeof CONFIG !== 'undefined') {
        clearInterval(checkConfig);
        initContentScript();
      } else if (retries > 50) {
        clearInterval(checkConfig);
      }
    }, 100);
  } else {
    initContentScript();
  }

  function initContentScript() {

    if (typeof CONFIG === 'undefined') {
      return;
    }

    function isJobUrlKeyword() {
      const url = window.location.href.toLowerCase();
      const keywords = CONFIG.JOB_URL_KEYWORDS || [];
      const match = keywords.some(keyword => url.includes(keyword));
      if (match) {
        const foundKeyword = keywords.find(k => url.includes(k));
      } else {
      }
      return match;
    }

    function detectJobSite() {
      const hostname = window.location.hostname;
      const sites = Object.keys(CONFIG.JOB_SITE_SELECTORS);
      for (const site of sites) {
        if (hostname.includes(site)) {
          return site;
        }
      }
      return null;
    }

    function isLikelyJobPage() {
      const keywordMatch = isJobUrlKeyword();
      const siteMatch = detectJobSite();
      const result = keywordMatch || siteMatch !== null;
      return result;
    }

    function extractText(selectorStr) {
      const selectors = selectorStr.split(',').map(s => s.trim());
      for (const selector of selectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim()) {
            return el.textContent.trim();
          }
        } catch (e) {
          // Skip invalid selectors
        }
      }
      return '';
    }

    function scrapeJobListingGeneric() {
      const descriptionSelectors = [
        'main', 'article', '[role="main"]', '.job-description', 
        '.job-details', '.posting-description', '[data-testid*="description"]',
        '.description-section', '.posting-body', '[data-section-id*="description"]',
        '.description__content', '[class*="job-description"]'
      ];
      
      let jobDescription = '';
      for (const selector of descriptionSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const text = (el.innerText || el.textContent || '').trim();
            if (text && text.length > 100 && text.length < 50000) {
              jobDescription = text;
              break;
            }
          }
        } catch (e) {
          // Skip
        }
      }

      if (jobDescription.length < 100) {
        try {
          const bodyText = (document.body.innerText || document.body.textContent || '').trim();
          if (bodyText && bodyText.length > 300 && bodyText.length < 100000) {
            jobDescription = bodyText.substring(0, 8000);
          }
        } catch (e) {
          // Fallback failed
        }
      }

      const titleSelectors = ['h1', '[data-testid*="title"]', '.job-title', '.position-title'];
      let jobTitle = '';
      for (const selector of titleSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            jobTitle = (el.innerText || el.textContent || '').trim();
            if (jobTitle.length > 5 && jobTitle.length < 300) {
              break;
            }
          }
        } catch (e) {
          // Skip
        }
      }

      let company = '';
      const companySelectors = ['[data-testid*="company"]', '.company-name', '.employer'];
      for (const selector of companySelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            company = (el.innerText || el.textContent || '').trim();
            if (company.length > 2 && company.length < 200) {
              break;
            }
          }
        } catch (e) {
          // Skip
        }
      }

      if (jobDescription.length < 100) {
        return null;
      }

      return {
        jobTitle: jobTitle || 'Job Listing',
        company: company || 'Company',
        jobDescription,
        url: window.location.href,
        site: 'generic'
      };
    }

    function scrapeJobListing() {
      const site = detectJobSite();
      
      if (site) {
        const selectors = CONFIG.JOB_SITE_SELECTORS[site];
        if (selectors) {
          const jobDescription = extractText(selectors.jobDescription);
          if (jobDescription && jobDescription.length >= 50) {
            return {
              jobTitle: extractText(selectors.jobTitle),
              company: extractText(selectors.company),
              jobDescription,
              url: window.location.href,
              site
            };
          }
        }
      }

      const isKeyword = isJobUrlKeyword();
      if (isKeyword) {
        const genericData = scrapeJobListingGeneric();
        if (genericData) {
          return genericData;
        }
      }

      return null;
    }

    function isLikelyJobPage() {
      return isJobUrlKeyword() || detectJobSite() !== null;
    }

    // Message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      
      if (message.action === 'scrapeJob' || message.action === 'manualScrape') {
        const data = scrapeJobListing();
        sendResponse({ jobData: data });
      } else if (message.action === 'isJobPage') {
        const isJob = isLikelyJobPage();
        sendResponse({ isJobPage: isJob });
      } else if (message.action === 'getJobData') {
        const jobData = scrapeJobListing();
        sendResponse({ jobData });
      }
      return true;
    });

    // Auto-detect on page load
    if (isLikelyJobPage()) {
      const jobData = scrapeJobListing();
      chrome.runtime.sendMessage({
        action: 'jobPageDetected',
        hasJob: !!jobData,
        jobTitle: jobData?.jobTitle,
        company: jobData?.company
      }).catch(() => {
      });
    } else {
    }
  }
})();

