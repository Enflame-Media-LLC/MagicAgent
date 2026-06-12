import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { useVoiceStore } from "./voice";

describe("useVoiceStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("initializes with defaults when no persisted preferences exist", () => {
    const store = useVoiceStore();

    expect(store.status).toBe("disconnected");
    expect(store.mode).toBe("idle");
    expect(store.isMuted).toBe(false);
    expect(store.conversationId).toBeNull();
    expect(store.activeSessionId).toBeNull();
    expect(store.error).toBeNull();
    expect(store.voiceLanguage).toBe("en");
    expect(store.voiceAssistantEnabled).toBe(true);
    expect(store.statusMessage).toBe("Voice assistant offline");
  });

  it("loads persisted language and assistant preference", () => {
    localStorage.setItem("happy_voice_language", "es");
    localStorage.setItem("happy_voice_assistant_enabled", "false");

    const store = useVoiceStore();

    expect(store.voiceLanguage).toBe("es");
    expect(store.voiceAssistantEnabled).toBe(false);
  });

  it("falls back to defaults when persisted preferences are missing or unreadable", () => {
    localStorage.setItem("happy_voice_language", "");
    localStorage.setItem("happy_voice_assistant_enabled", "true");

    const storeWithEmptyLanguage = useVoiceStore();
    expect(storeWithEmptyLanguage.voiceLanguage).toBe("en");
    expect(storeWithEmptyLanguage.voiceAssistantEnabled).toBe(true);

    setActivePinia(createPinia());
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage unavailable");
    });

    const storeWithUnavailableStorage = useVoiceStore();
    expect(storeWithUnavailableStorage.voiceLanguage).toBe("en");
    expect(storeWithUnavailableStorage.voiceAssistantEnabled).toBe(true);
  });

  it("persists language and assistant preference changes", async () => {
    const store = useVoiceStore();

    store.setVoiceLanguage("pl");
    store.setVoiceAssistantEnabled(false);
    await nextTick();

    expect(localStorage.getItem("happy_voice_language")).toBe("pl");
    expect(localStorage.getItem("happy_voice_assistant_enabled")).toBe("false");
  });

  it("ignores persistence failures when preferences change", async () => {
    const store = useVoiceStore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => {
      store.setVoiceLanguage("ja");
      store.setVoiceAssistantEnabled(false);
    }).not.toThrow();

    await nextTick();
    expect(store.voiceLanguage).toBe("ja");
    expect(store.voiceAssistantEnabled).toBe(false);
  });

  it("updates connection status and derived state", () => {
    const store = useVoiceStore();

    store.setStatus("connecting");
    expect(store.isConnecting).toBe(true);
    expect(store.statusMessage).toBe("Connecting to voice assistant...");

    store.setStatus("connected");
    store.setMode("listening");
    expect(store.isActive).toBe(true);
    expect(store.isListening).toBe(true);
    expect(store.statusMessage).toBe("Listening...");

    store.setMode("speaking");
    expect(store.isSpeaking).toBe(true);
    expect(store.statusMessage).toBe("Speaking...");
  });

  it("clears transient voice session state when disconnected", () => {
    const store = useVoiceStore();

    store.setError("Temporary failure");
    store.setConversationId("conversation-1");
    store.setActiveSessionId("session-1");
    store.setMode("speaking");

    store.setStatus("disconnected");

    expect(store.error).toBeNull();
    expect(store.mode).toBe("idle");
    expect(store.conversationId).toBeNull();
    expect(store.activeSessionId).toBeNull();
    expect(store.statusMessage).toBe("Voice assistant offline");
  });

  it("reports fallback messages for unknown or empty error states", () => {
    const store = useVoiceStore();

    store.setStatus("unknown" as never);
    expect(store.statusMessage).toBe("Unknown");

    store.setError("");
    expect(store.hasError).toBe(false);
    expect(store.statusMessage).toBe("");
  });

  it("handles mute, identifiers, errors, and reset", () => {
    const store = useVoiceStore();

    store.setConversationId("conversation-1");
    store.setActiveSessionId("session-1");
    store.toggleMute();
    expect(store.isMuted).toBe(true);

    store.setStatus("connected");
    expect(store.statusMessage).toBe("Muted");

    store.setMuted(false);
    store.setError("Microphone denied");
    expect(store.hasError).toBe(true);
    expect(store.statusMessage).toBe("Microphone denied");

    store.setStatus("connected");
    store.setStatus("error");
    expect(store.hasError).toBe(false);
    expect(store.statusMessage).toBe("Voice connection error");

    store.setMode("speaking");
    store.setConversationId("conversation-2");
    store.setActiveSessionId("session-2");
    store.setStatus("disconnected");
    expect(store.mode).toBe("idle");
    expect(store.conversationId).toBeNull();
    expect(store.activeSessionId).toBeNull();
    expect(store.error).toBeNull();

    store.$reset();
    expect(store.status).toBe("disconnected");
    expect(store.mode).toBe("idle");
    expect(store.isMuted).toBe(false);
    expect(store.conversationId).toBeNull();
    expect(store.activeSessionId).toBeNull();
    expect(store.error).toBeNull();
  });
});
