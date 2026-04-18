// Pre-initialize PDF.js global for use by parser
window.pdfjsLibPromise = (async () => {
  try {
    // Try to load PDF.js library globally
    // The library should be available at libs/pdf.min.mjs
    if (typeof window.pdfjsLib === 'undefined') {
      // Use a simple approach: set worker path and use if library becomes available
      // The actual loading happens when parseResumePDFv2 is called
    }
    return true;
  } catch (err) {
    // Continue anyway - parser will handle the error
    return false;
  }
})();
