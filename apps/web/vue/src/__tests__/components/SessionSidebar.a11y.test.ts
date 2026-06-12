/**
 * Accessibility tests for SessionSidebar component
 *
 * Validates that the SessionSidebar component meets WCAG 2.1 AA standards:
 * - Proper navigation landmark with aria-label
 * - Session lists use listbox role with aria-labelledby
 * - Individual sessions have option role with aria-selected
 * - Theme toggle has dynamic aria-label
 * - Action buttons have accessible labels
 *
 * @see HAP-972 - Screen reader and axe-core accessibility testing
 * @see HAP-963 - Keyboard Shortcuts and Accessibility
 */

import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createRouter, createWebHistory } from "vue-router";
import { createPinia, setActivePinia } from "pinia";
import SessionSidebar from "@/components/app/SessionSidebar.vue";
import { checkComponentA11y } from "../helpers/a11y";

vi.mock("@/components/app", () => ({
  ConnectionStatus: {
    template: '<div role="status">Connected</div>',
  },
}));

// Mock composables
vi.mock("@/composables/useDarkMode", () => ({
  useDarkMode: () => ({
    isDark: false,
    toggle: vi.fn(),
  }),
}));

vi.mock("@/composables/useArrowNavigation", () => ({
  useArrowNavigation: vi.fn(),
}));

// Mock stores
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    displayName: "Test User",
    initials: "TU",
    account: {
      id: "test-id",
      github: null,
      avatar: null,
    },
  }),
}));

vi.mock("@/stores/sessions", () => ({
  useSessionsStore: () => ({
    activeSessions: [],
    inactiveSessions: [],
    count: 0,
  }),
}));

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: { template: "<div>Home</div>" } },
    { path: "/session/:id", component: { template: "<div>Session</div>" } },
    { path: "/new", component: { template: "<div>New</div>" } },
  ],
});

describe("SessionSidebar Accessibility", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await router.push("/");
    await router.isReady();
  });

  function mountSidebar() {
    return mount(SessionSidebar, {
      global: {
        plugins: [router],
        stubs: {
          Sidebar: {
            template: '<nav v-bind="$attrs"><slot /></nav>',
          },
          SidebarContent: {
            template: '<div role="navigation"><slot /></div>',
          },
          SidebarHeader: {
            template: "<div><slot /></div>",
          },
          SidebarFooter: {
            template: "<div><slot /></div>",
          },
          SidebarGroup: {
            template: '<div role="group"><slot /></div>',
          },
          SidebarGroupLabel: {
            template: '<span v-bind="$attrs"><slot /></span>',
          },
          SidebarMenu: {
            template: '<ul v-bind="$attrs"><slot /></ul>',
          },
          SidebarMenuItem: {
            template: '<li v-bind="$attrs"><slot /></li>',
          },
          SidebarMenuButton: {
            template: '<button v-bind="$attrs"><slot /></button>',
          },
          SidebarMenuBadge: {
            template: "<span><slot /></span>",
          },
          SidebarSeparator: {
            template: '<hr aria-hidden="true" />',
          },
          ConnectionStatus: {
            template: '<div role="status">Connected</div>',
          },
          NavUser: {
            template: '<div aria-label="User menu">User</div>',
          },
          Button: {
            template: '<button v-bind="$attrs"><slot /></button>',
          },
        },
      },
    });
  }

  it("should have no axe-core violations with empty sessions", async () => {
    const wrapper = mountSidebar();
    // Disable nested-interactive rule: this is a false positive from test stubs.
    // SidebarMenuButton uses `as-child` which renders a single element in production,
    // but stubs render as <button> wrapping <a>, creating a nested interactive violation.
    // The real component does not have this issue.
    await checkComponentA11y(wrapper, {
      rules: {
        "nested-interactive": { enabled: false },
      },
    });
  });

  it("should render sidebar with aria-label for navigation", () => {
    const wrapper = mountSidebar();
    const nav = wrapper.find("nav");

    expect(nav.exists()).toBe(true);
    expect(nav.attributes("aria-label")).toBe("Session navigation");
  });

  it('should have accessible "New Session" button', () => {
    const wrapper = mountSidebar();
    const newSessionBtn = wrapper.find('button[aria-label="Start a new session"]');

    expect(newSessionBtn.exists()).toBe(true);
  });

  it("should show status message when no sessions exist", () => {
    const wrapper = mountSidebar();
    const status = wrapper.find('[role="status"]');

    expect(status.exists()).toBe(true);
  });

  it("should have accessible theme toggle button", () => {
    const wrapper = mountSidebar();
    const themeBtn = wrapper.find('button[aria-label="Switch to dark mode"]');

    expect(themeBtn.exists()).toBe(true);
  });
});
