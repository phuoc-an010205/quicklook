/**
 * Defensive stub for onboarding.js
 * This file was referenced in error reports (md.md) but did not exist.
 * It was causing "Cannot read properties of undefined (reading 'getImageNode')".
 *
 * The current application (Google Drive ID mapper) does not use onboarding.js.
 * This stub prevents crashes if any old HTML/script tag or dynamic import
 * accidentally tries to load it.
 */

(function() {
  'use strict';

  // Minimal safe API that old code might expect
  window.Onboarding = window.Onboarding || {};

  // Safe no-op for getImageNode (addresses md.md: TypeError reading 'getImageNode' on undefined)
  // Always defensive: check for P/item before any access in real onboarding code.
  window.Onboarding.getImageNode = function(P, item) {
    if (!P || typeof P.getImageNode !== 'function' || !item) {
      console.warn('[onboarding.js stub] getImageNode() called with invalid P or item. Returning null defensively.');
      return null;
    }
    try {
      return P.getImageNode(item);
    } catch (e) {
      console.warn('[onboarding.js stub] getImageNode error:', e);
      return null;
    }
  };

  // Additional defensive methods
  window.Onboarding.init = function() {
    console.info('[onboarding.js stub] init() called — onboarding is disabled in this build.');
  };

  // Prevent further errors if code does `something.getImageNode()`
  if (typeof window.getImageNode === 'undefined') {
    window.getImageNode = window.Onboarding.getImageNode;
  }

  console.info('[onboarding.js] Defensive stub loaded successfully.');
})();