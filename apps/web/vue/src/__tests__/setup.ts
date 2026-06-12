/**
 * Vitest test setup
 *
 * Configures global mocks and test environment.
 * @see HAP-863 - Add unit tests for artifact sync encryption
 * @see HAP-972 - Screen reader and axe-core accessibility testing
 */

import { vi, beforeEach } from "vite-plus/test";
import "vitest-axe/extend-expect";
import * as matchers from "vitest-axe/matchers";
import { expect } from "vite-plus/test";

// Register axe-core accessibility matchers (HAP-972)
// Enables expect(results).toHaveNoViolations() in all tests
expect.extend(matchers);

// KaTeX warns in quirks mode; happy-dom starts without a doctype by default.
if (!document.doctype) {
  document.insertBefore(
    document.implementation.createDocumentType("html", "", ""),
    document.documentElement,
  );
}

// Mock crypto.subtle for tests that require Web Crypto API
// happy-dom doesn't provide a complete crypto.subtle implementation
if (!globalThis.crypto?.subtle) {
  // Only mock if not already provided (node >= 20 has it)
  const { webcrypto } = await import("node:crypto");
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
  });
}

// Mock console methods to reduce noise during tests (optional)
// Uncomment if needed:
// vi.spyOn(console, 'debug').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Global test cleanup
beforeEach(() => {
  // Reset any module-level state between tests if needed
  vi.clearAllMocks();
});
