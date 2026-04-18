/**
 * error-handler.js — Global error handling and logging for debugging
 * 
 * Catches runtime errors and logs them for debugging purposes.
 * Displays user-friendly error messages in the popup.
 */

(function() {
  'use strict';

  // Global error handler for uncaught exceptions
  window.addEventListener('error', (event) => {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });

    // Log stack trace if available
    if (event.error && event.error.stack) {
    }
  });

  // Global handler for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
      reason: event.reason,
      promise: event.promise
    });

    if (event.reason && event.reason.stack) {
    }

    // Prevent default browser handling
    event.preventDefault();
  });

  // Wrap console methods to add timestamps
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const timestamp = new Date().toLocaleTimeString();
    originalConsoleError.apply(console, [`[${timestamp}] ERROR:`, ...args]);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function(...args) {
    const timestamp = new Date().toLocaleTimeString();
    originalConsoleWarn.apply(console, [`[${timestamp}] WARN:`, ...args]);
  };

  const originalConsoleLog = console.log;
  console.log = function(...args) {
    const timestamp = new Date().toLocaleTimeString();
    originalConsoleLog.apply(console, [`[${timestamp}]`, ...args]);
  };

  // Export global error reporter
  window.reportError = function(context, error, details = {}) {
    const errorReport = {
      context,
      message: error.message || String(error),
      stack: error.stack || 'No stack trace',
      timestamp: new Date().toISOString(),
      details
    };

    return errorReport;
  };

  // Helper to check object types
  window.debugObject = function(obj, label = 'Object') {
      type: typeof obj,
      isNull: obj === null,
      isUndefined: obj === undefined,
      isArray: Array.isArray(obj),
      keys: Object.keys(obj || {}),
      toString: Object.prototype.toString.call(obj)
    });
  };

})();
