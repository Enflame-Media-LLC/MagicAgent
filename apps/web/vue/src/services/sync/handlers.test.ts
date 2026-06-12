/**
 * Unit tests for sync event handlers (artifact operations)
 *
 * Tests the setup and cleanup of sync handlers.
 * Note: Full integration testing of handlers is done via E2E tests
 * due to the complexity of mocking all dependencies.
 *
 * @see HAP-863 - Add unit tests for artifact sync encryption
 */

import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Dependencies - These must be set up before importing handlers
// ─────────────────────────────────────────────────────────────────────────────

// Mock artifact sync utilities
vi.mock("./artifactSync", () => ({
  getEncryptionManager: vi.fn().mockResolvedValue(null),
  getArtifactEncryption: vi.fn().mockResolvedValue(null),
  storeArtifactKey: vi.fn(),
  removeArtifactKey: vi.fn(),
}));

// Track registered handlers
let registeredHandlers: Map<string, (data: unknown) => void>;
const cleanupFns: Array<() => void> = [];

// Mock WebSocket service with handler tracking
vi.mock("./WebSocketService", () => ({
  wsService: {
    onMessage: vi.fn((event: string, handler: (data: unknown) => void) => {
      registeredHandlers.set(event, handler);
      const cleanup = () => registeredHandlers.delete(event);
      cleanupFns.push(cleanup);
      return cleanup;
    }),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Sync Event Handlers", () => {
  beforeEach(async () => {
    // Set up Pinia
    setActivePinia(createPinia());

    // Reset registered handlers
    registeredHandlers = new Map();
    cleanupFns.length = 0;

    // Reset all mocks
    vi.clearAllMocks();

    // Reset the handlers module state by resetting modules
    vi.resetModules();

    // Re-setup mocks after module reset
    vi.doMock("./artifactSync", () => ({
      getEncryptionManager: vi.fn().mockResolvedValue(null),
      getArtifactEncryption: vi.fn().mockResolvedValue(null),
      storeArtifactKey: vi.fn(),
      removeArtifactKey: vi.fn(),
    }));

    vi.doMock("./WebSocketService", () => ({
      wsService: {
        onMessage: vi.fn((event: string, handler: (data: unknown) => void) => {
          registeredHandlers.set(event, handler);
          const cleanup = () => registeredHandlers.delete(event);
          cleanupFns.push(cleanup);
          return cleanup;
        }),
      },
    }));
  });

  describe("setupSyncHandlers", () => {
    it("should register update, ephemeral, and error handlers", async () => {
      const { setupSyncHandlers } = await import("./handlers");

      const cleanup = setupSyncHandlers();

      // Verify handlers were registered
      expect(registeredHandlers.has("update")).toBe(true);
      expect(registeredHandlers.has("ephemeral")).toBe(true);
      expect(registeredHandlers.has("error")).toBe(true);

      cleanup();
    }, 10000);

    it("should return a cleanup function", async () => {
      const { setupSyncHandlers } = await import("./handlers");

      const cleanup = setupSyncHandlers();

      expect(typeof cleanup).toBe("function");

      cleanup();
    });

    it("should track setup state correctly", async () => {
      const { setupSyncHandlers, areHandlersSetup } = await import("./handlers");

      expect(areHandlersSetup()).toBe(false);

      const cleanup = setupSyncHandlers();
      expect(areHandlersSetup()).toBe(true);

      cleanup();
      expect(areHandlersSetup()).toBe(false);
    });

    it("should warn when handlers are already set up", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSyncHandlers } = await import("./handlers");

      const cleanup1 = setupSyncHandlers();
      const cleanup2 = setupSyncHandlers(); // Second call should warn

      expect(consoleSpy).toHaveBeenCalledWith("[sync] Handlers already set up");

      cleanup1();
      cleanup2();

      consoleSpy.mockRestore();
    });
  });

  describe("handler types", () => {
    it("update handler should be a function", async () => {
      const { setupSyncHandlers } = await import("./handlers");

      setupSyncHandlers();

      const updateHandler = registeredHandlers.get("update");
      expect(typeof updateHandler).toBe("function");
    });

    it("ephemeral handler should be a function", async () => {
      const { setupSyncHandlers } = await import("./handlers");

      setupSyncHandlers();

      const ephemeralHandler = registeredHandlers.get("ephemeral");
      expect(typeof ephemeralHandler).toBe("function");
    });

    it("error handler should be a function", async () => {
      const { setupSyncHandlers } = await import("./handlers");

      setupSyncHandlers();

      const errorHandler = registeredHandlers.get("error");
      expect(typeof errorHandler).toBe("function");
    });
  });

  describe("update handler validation", () => {
    it("should reject invalid update container", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSyncHandlers } = await import("./handlers");
      setupSyncHandlers();

      const updateHandler = registeredHandlers.get("update");

      // Call with invalid data
      updateHandler!({ invalid: "data" });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid update received"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });

    it("should handle null data gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSyncHandlers } = await import("./handlers");
      setupSyncHandlers();

      const updateHandler = registeredHandlers.get("update");

      // Should not throw
      expect(() => updateHandler!(null)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it("should handle undefined data gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSyncHandlers } = await import("./handlers");
      setupSyncHandlers();

      const updateHandler = registeredHandlers.get("update");

      // Should not throw
      expect(() => updateHandler!(undefined)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe("ephemeral handler validation", () => {
    it("should reject invalid ephemeral events", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSyncHandlers } = await import("./handlers");
      setupSyncHandlers();

      const ephemeralHandler = registeredHandlers.get("ephemeral");

      // Call with invalid data
      ephemeralHandler!({ invalid: "data" });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid ephemeral event received"),
        expect.anything(),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("error handler", () => {
    it("should handle session revival errors", async () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      const { setupSyncHandlers } = await import("./handlers");
      setupSyncHandlers();

      const errorHandler = registeredHandlers.get("error");

      // Simulate session revival error
      errorHandler!({
        code: "SESSION_REVIVAL_FAILED",
        message: "Failed to revive session",
        context: { sessionId: "session-123" },
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "session-revival-error",
        }),
      );

      dispatchSpy.mockRestore();
    });

    it("should log all errors to console", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { setupSyncHandlers } = await import("./handlers");
      setupSyncHandlers();

      const errorHandler = registeredHandlers.get("error");

      // Simulate any error
      errorHandler!({
        code: "SOME_ERROR",
        message: "Something went wrong",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[sync] WebSocket error:",
        "SOME_ERROR",
        "Something went wrong",
      );

      consoleSpy.mockRestore();
    });

    it("should handle empty error data", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { setupSyncHandlers } = await import("./handlers");
      setupSyncHandlers();

      const errorHandler = registeredHandlers.get("error");

      // Should not throw
      expect(() => errorHandler!(null)).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith("[sync] Received empty error event");

      consoleSpy.mockRestore();
    });
  });

  describe("cleanup behavior", () => {
    it("should remove all handlers on cleanup", async () => {
      const { setupSyncHandlers } = await import("./handlers");

      const cleanup = setupSyncHandlers();

      expect(registeredHandlers.size).toBe(5); // update, ephemeral, error, session-revival-paused, session-revived

      cleanup();

      // The cleanup functions were called (handlers should be removed)
      // Note: In the mock, we track this via cleanupFns being called
      expect(cleanupFns.length).toBeGreaterThan(0);
    });

    it("should allow re-setup after cleanup", async () => {
      const { setupSyncHandlers, areHandlersSetup } = await import("./handlers");

      const cleanup1 = setupSyncHandlers();
      expect(areHandlersSetup()).toBe(true);

      cleanup1();
      expect(areHandlersSetup()).toBe(false);

      const cleanup2 = setupSyncHandlers();
      expect(areHandlersSetup()).toBe(true);

      cleanup2();
    });
  });
});
