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

  /**
   * Check if current URL contains job-related keywords
   * @returns {boolean} - True if URL looks like a job listing
   */
  function isJobUrlKeyword() {
    const url = window.location.href.toLowerCase();
    const keywords = CONFIG.JOB_URL_KEYWORDS || [];
    return keywords.some(keyword => url.includes(keyword));
  }

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
   * Generic job scraping fallback - extracts from common HTML patterns
   * @returns {object|null} - Job data or null if not found
   */
  function scrapeJobListingGeneric() {
    // Try to find job description from common patterns
    const descriptionSelectors = [
      'article', 'main', '[role="main"]', '.job-description', 
      '.job-details', '.posting-description', '[data-testid*="description"]',
      '.description-section', '.posting-body', '[data-section-id*="description"]',
      '.description__content', '[class*="job-description"]', '[class*="details"]'
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
        // Skip invalid selectors
      }
    }

    // If still nothing, grab all visible text from body but limit it
    if (jobDescription.length < 100) {
      try {
        const bodyText = (document.body.innerText || document.body.textContent || '').trim();
        // Look for text that looks like job description (multiple paragraphs)
        if (bodyText && bodyText.length > 300 && bodyText.length < 100000) {
          // Take the middle section which typically contains job details
          jobDescription = bodyText.substring(0, 8000);
        }
      } catch (e) {
        // Fallback if innerText doesn't work
      }
    }

    // Try to find title from common tag patterns
    const titleSelectors = ['h1', '[data-testid*="title"]', '.job-title', '.position-title', '.posting-headline h2'];
    let jobTitle = '';
    for (const selector of titleSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          jobTitle = (el.innerText || el.textContent || '').trim();
          if (jobTitle.length > 5 && jobTitle.length < 300) break;
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    // Try to find company
    let company = '';
    const companySelectors = [
      '[data-testid*="company"]', '.company-name', '.employer', 
      'meta[name="company"]', '[itemprop="hiringOrganization"]',
      '.posting-headline .company-name', '[data-automation-id*="company"]'
    ];
    for (const selector of companySelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          company = el.getAttribute('content') || (el.innerText || el.textContent || '').trim();
          if (company.length > 2 && company.length < 200) break;
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    // Must have meaningful description
    if (jobDescription.length < 100) return null;

    return {
      jobTitle: jobTitle || 'Job Listing',
      company: company || 'Company',
      jobDescription,
      url: window.location.href,
      site: 'generic'
    };
  }

  /**
   * Scrapes the current page for job listing data using multiple strategies
   * @returns {{ jobTitle: string, company: string, jobDescription: string, url: string, site: string } | null}
   */
  function scrapeJobListing() {
    // Strategy 1: Try site-specific selectors
    const site = detectJobSite();
    
    if (site) {
      const selectors = CONFIG.JOB_SITE_SELECTORS[site];
      if (selectors) {
        const jobDescription = extractText(selectors.jobDescription);
        
        if (jobDescription && jobDescription.length >= 50) {
          const result = {
            jobTitle: extractText(selectors.jobTitle),
            company: extractText(selectors.company),
            jobDescription,
            url: window.location.href,
            site
          };
          return result;
        }
      }
    }

    // Strategy 2: If URL looks like a job page but site-specific didn't work, try generic
    const isKeyword = isJobUrlKeyword();
    
    if (isKeyword) {
      const genericData = scrapeJobListingGeneric();
      if (genericData) return genericData;
    }

    return null;
  }

  /**
   * Check if page appears to be a job listing based on keywords
   * Called for initial detection
   */
  function isLikelyJobPage() {
    return isJobUrlKeyword() || detectJobSite() !== null;
  }

  // -- Message Listener for Both Auto & Manual Scraping ------

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'scrapeJob') {
      // Scrape using configured selectors
      const data = scrapeJobListing();
      sendResponse(data);
    } else if (message.action === 'isJobPage') {
      // Check if page looks like a job listing
      const isJob = isLikelyJobPage();
      sendResponse({ isJobPage: isJob });
    } else if (message.action === 'manualScrape') {
      // Manual scrape attempt (user clicked button)
      const data = scrapeJobListing();
      sendResponse(data);
    }
    return true;
  });

  // -- Badge Notification for Automatic Detection -----------

  if (isLikelyJobPage()) {
    const jobData = scrapeJobListing();
    chrome.runtime.sendMessage({
      action: 'jobPageDetected',
      hasJob: !!jobData,
      jobTitle: jobData?.jobTitle,
      company: jobData?.company
    }).catch(() => {
      // Silently fail - service worker might not be ready yet
    });
  }
})();
