import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { usePurchasesStore } from "./purchases";

function customerInfo({
  pro = false,
  subscriptions = {},
  entitlements = {},
}: {
  pro?: boolean;
  subscriptions?: Record<string, unknown>;
  entitlements?: Record<string, boolean>;
} = {}) {
  return {
    activeSubscriptions: subscriptions,
    entitlements: {
      all: {
        pro: { isActive: pro },
        ...Object.fromEntries(
          Object.entries(entitlements).map(([id, isActive]) => [id, { isActive }]),
        ),
      },
    },
  } as any;
}

function offerings() {
  return {
    current: {
      availablePackages: [
        { identifier: "happy_monthly", packageType: "monthly" },
        { identifier: "happy_yearly", packageType: "custom" },
        { identifier: "happy_lifetime", packageType: "lifetime" },
      ],
    },
  } as any;
}

describe("usePurchasesStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("initializes with idle state and empty purchase data", () => {
    const store = usePurchasesStore();

    expect(store.isConfigured).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.status).toBe("idle");
    expect(store.customerInfo).toBeNull();
    expect(store.offerings).toBeNull();
    expect(store.lastError).toBeNull();
    expect(store.isPaywallVisible).toBe(false);
    expect(store.isPro).toBe(false);
    expect(store.isSubscribed).toBe(false);
    expect(store.activeEntitlements).toEqual([]);
    expect(store.currentOffering).toBeNull();
    expect(store.availablePackages).toEqual([]);
    expect(store.monthlyPackage).toBeUndefined();
    expect(store.annualPackage).toBeUndefined();
    expect(store.hasError).toBe(false);
  });

  it("derives subscription and entitlement state from customer info", () => {
    const store = usePurchasesStore();

    store.setCustomerInfo(
      customerInfo({
        pro: true,
        subscriptions: { happy_pro_monthly: {} },
        entitlements: {
          beta: true,
          expired: false,
        },
      }),
    );

    expect(store.isPro).toBe(true);
    expect(store.isSubscribed).toBe(true);
    expect(store.activeEntitlements).toEqual(["pro", "beta"]);
    expect(store.hasEntitlement("pro")).toBe(true);
    expect(store.hasEntitlement("beta")).toBe(true);
    expect(store.hasEntitlement("expired")).toBe(false);
    expect(store.hasEntitlement("missing")).toBe(false);
  });

  it("derives current, monthly, and annual packages from offerings", () => {
    const store = usePurchasesStore();

    store.setOfferings(offerings());

    expect(store.currentOffering).toBe(store.offerings?.current);
    expect(store.availablePackages).toHaveLength(3);
    expect(store.monthlyPackage?.identifier).toBe("happy_monthly");
    expect(store.annualPackage?.identifier).toBe("happy_yearly");
  });

  it("tracks loading, purchasing, restoring, success, and errors", () => {
    const store = usePurchasesStore();

    store.setLoading(true);
    expect(store.isLoading).toBe(true);
    expect(store.status).toBe("loading");

    store.setLoading(false);
    expect(store.isLoading).toBe(false);
    expect(store.status).toBe("idle");

    store.setPurchasing(true);
    expect(store.status).toBe("purchasing");
    store.setPurchasing(false);
    expect(store.status).toBe("idle");

    store.setRestoring(true);
    expect(store.status).toBe("restoring");
    store.setRestoring(false);
    expect(store.status).toBe("idle");

    store.setError("network", "Network unavailable");
    expect(store.status).toBe("error");
    expect(store.hasError).toBe(true);
    expect(store.lastError).toEqual({
      code: "network",
      message: "Network unavailable",
      timestamp: new Date("2026-06-10T12:00:00.000Z"),
    });

    store.clearError();
    expect(store.status).toBe("idle");
    expect(store.lastError).toBeNull();
    expect(store.hasError).toBe(false);

    store.setError("network", "Network unavailable");
    store.setSuccess();
    expect(store.status).toBe("success");
    expect(store.lastError).toBeNull();
  });

  it("updates configuration, paywall state, and resets all state", () => {
    const store = usePurchasesStore();

    store.setConfigured(true);
    store.setPaywallVisible(true);
    store.setCustomerInfo(customerInfo({ pro: true }));
    store.setOfferings(offerings());
    store.setError("purchase_failed", "Purchase failed");

    store.$reset();

    expect(store.isConfigured).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.status).toBe("idle");
    expect(store.customerInfo).toBeNull();
    expect(store.offerings).toBeNull();
    expect(store.lastError).toBeNull();
    expect(store.isPaywallVisible).toBe(false);
  });
});
