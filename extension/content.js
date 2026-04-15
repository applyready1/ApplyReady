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

  // DEBUG: Log that content script loaded
  console.log('[CONTENT.JS] ✓ Content script loaded');
  console.log('[CONTENT.JS] CONFIG available?', typeof CONFIG !== 'undefined');
  console.log('[CONTENT.JS] Current URL:', window.location.href);

  if (typeof CONFIG === 'undefined') {
    console.error('[CONTENT.JS] ✗ ERROR: CONFIG is not defined! config.js was not loaded.');
  } else {
    console.log('[CONTENT.JS] ✓ CONFIG is available:', Object.keys(CONFIG).length, 'keys');
  }

  /**
   * Check if current URL contains job-related keywords
   * @returns {boolean} - True if URL looks like a job listing
   */
  function isJobUrlKeyword() {
    const url = window.location.href.toLowerCase();
    const keywords = CONFIG.JOB_URL_KEYWORDS || [];
    const result = keywords.some(keyword => url.includes(keyword));
    if (result) {
      const matched = keywords.find(keyword => url.includes(keyword));
      console.log('[CONTENT.JS] ✓ URL keyword match:', matched);
    }
    return result;
  }

  /**
   * Determines which job site we're on based on the hostname.
   * @returns {string|null} - The site key matching CONFIG.JOB_SITE_SELECTORS
   */
  function detectJobSite() {
    const hostname = window.location.hostname;
    const sites = Object.keys(CONFIG.JOB_SITE_SELECTORS);

    for (const site of sites) {
      if (hostname.includes(site)) {
        console.log('[CONTENT.JS] ✓ Detected job site:', site);
        return site;
      }
    }
    console.log('[CONTENT.JS] No known job site detected for hostname:', hostname);
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
    console.log('[CONTENT.JS] scrapeJobListingGeneric() called');
    
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
            console.log('[CONTENT.JS] Found description with selector:', selector, '| Length:', text.length);
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
      console.log('[CONTENT.JS] No specific selector matched, trying body text...');
      try {
        const bodyText = (document.body.innerText || document.body.textContent || '').trim();
        // Look for text that looks like job description (multiple paragraphs)
        if (bodyText && bodyText.length > 300 && bodyText.length < 100000) {
          // Take the middle section which typically contains job details
          jobDescription = bodyText.substring(0, 8000);
          console.log('[CONTENT.JS] Extracted body text | Length:', jobDescription.length);
        }
      } catch (e) {
        // Fallback if innerText doesn't work
        console.log('[CONTENT.JS] Body text extraction failed:', e.message);
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
          if (jobTitle.length > 5 && jobTitle.length < 300) {
            console.log('[CONTENT.JS] Found title with selector:', selector, '| Title:', jobTitle);
            break;
          }
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
          if (company.length > 2 && company.length < 200) {
            console.log('[CONTENT.JS] Found company with selector:', selector, '| Company:', company);
            break;
          }
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    // Must have meaningful description
    if (jobDescription.length < 100) {
      console.log('[CONTENT.JS] ✗ Generic scrape failed: description too short');
      return null;
    }

    console.log('[CONTENT.JS] ✓ Generic scrape successful');
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
    console.log('[CONTENT.JS] scrapeJobListing() called');
    
    // Strategy 1: Try site-specific selectors
    const site = detectJobSite();
    console.log('[CONTENT.JS] detectJobSite() returned:', site);
    
    if (site) {
      const selectors = CONFIG.JOB_SITE_SELECTORS[site];
      if (selectors) {
        const jobDescription = extractText(selectors.jobDescription);
        console.log('[CONTENT.JS] Strategy 1 (site-specific):', jobDescription.length > 0 ? 'Found' : 'Not found');
        
        if (jobDescription && jobDescription.length >= 50) {
          const result = {
            jobTitle: extractText(selectors.jobTitle),
            company: extractText(selectors.company),
            jobDescription,
            url: window.location.href,
            site
          };
          console.log('[CONTENT.JS] ✓ Strategy 1 success');
          return result;
        }
      }
    }

    // Strategy 2: If URL looks like a job page but site-specific didn't work, try generic
    const isKeyword = isJobUrlKeyword();
    console.log('[CONTENT.JS] isJobUrlKeyword():', isKeyword);
    
    if (isKeyword) {
      console.log('[CONTENT.JS] Trying Strategy 2 (generic scrape)...');
      const genericData = scrapeJobListingGeneric();
      console.log('[CONTENT.JS] Strategy 2 (generic):', genericData ? 'Found' : 'Not found');
      if (genericData) return genericData;
    }

    console.log('[CONTENT.JS] ✗ All strategies failed');
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
    console.log('[CONTENT.JS] 📨 Message received:', message.action);
    
    if (message.action === 'scrapeJob') {
      // Scrape using configured selectors
      console.log('[CONTENT.JS] Processing scrapeJob...');
      const data = scrapeJobListing();
      console.log('[CONTENT.JS] scrapeJob result:', data ? 'Data found' : 'No data');
      sendResponse(data);
    } else if (message.action === 'isJobPage') {
      // Check if page looks like a job listing
      const isJob = isLikelyJobPage();
      console.log('[CONTENT.JS] isJobPage result:', isJob);
      sendResponse({ isJobPage: isJob });
    } else if (message.action === 'manualScrape') {
      // Manual scrape attempt (user clicked button)
      console.log('[CONTENT.JS] Processing manualScrape...');
      const data = scrapeJobListing();
      console.log('[CONTENT.JS] manualScrape result:', data ? 'Data found' : 'No data');
      if (data) {
        console.log('[CONTENT.JS] ✓ Job extracted - Title:', data.jobTitle, 'Company:', data.company);
      }
      sendResponse(data);
    } else {
      console.log('[CONTENT.JS] Unknown action:', message.action);
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
