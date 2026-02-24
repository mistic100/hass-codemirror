/**
 * ============================================================================
 * MAIN MODULE - Application Entry Point
 * ============================================================================
 *
 * PURPOSE:
 * Application entry point. Waits for DOM ready, then initializes the app.
 * This is the first module loaded when CodeMirror starts.
 *
 * FLOW:
 * 1. Import app.js (registers all module callbacks)
 * 2. Import initialization.js
 * 3. Wait for DOM ready
 * 4. Call init() to start application
 *
 * HOW TO MODIFY:
 * - Add pre-init checks before calling init()
 * - Add error boundary for global error handling
 * - Add performance monitoring/analytics
 * - Add feature flags loading
 *
 * ============================================================================
 */
import * as app from './app.js';
import { init } from './initialization.js';
import { state, elements } from './state.js';

// Expose app module globally for console access and debugging
window.app = app;
window.state = state;
window.elements = elements;

// Start the application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}