document.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.getElementById("toggleRules");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const statusSubtext = document.getElementById("statusSubtext");
  const openAppBtn = document.getElementById("openAppBtn");

  const RULESET_ID = "cors_rules";
  const ext = typeof chrome !== "undefined" && chrome.runtime ? chrome : (typeof browser !== "undefined" ? browser : null);

  const updateUI = (enabled) => {
    toggle.checked = enabled;
    if (enabled) {
      statusDot.className = "status-dot";
      statusText.textContent = "Active & Ready";
      statusSubtext.textContent = "CORS headers unlocked";
    } else {
      statusDot.className = "status-dot inactive";
      statusText.textContent = "Disabled";
      statusSubtext.textContent = "Standard CORS restrictions apply";
    }
  };

  // 1. Check current enabled rulesets via declarativeNetRequest API
  try {
    if (ext && ext.declarativeNetRequest && ext.declarativeNetRequest.getEnabledRulesets) {
      const enabledRulesets = await ext.declarativeNetRequest.getEnabledRulesets();
      const isEnabled = enabledRulesets.includes(RULESET_ID);
      updateUI(isEnabled);
    } else if (ext && ext.storage && ext.storage.local) {
      // Fallback to storage
      ext.storage.local.get(["cors_enabled"], (res) => {
        updateUI(res && res.cors_enabled !== false);
      });
    } else {
      updateUI(true);
    }
  } catch {
    updateUI(true);
  }

  // 2. Handle toggle changes
  toggle.addEventListener("change", async () => {
    const shouldEnable = toggle.checked;
    try {
      if (ext && ext.declarativeNetRequest && ext.declarativeNetRequest.updateEnabledRulesets) {
        await ext.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: shouldEnable ? [RULESET_ID] : [],
          disableRulesetIds: shouldEnable ? [] : [RULESET_ID],
        });
      }
      if (ext && ext.storage && ext.storage.local) {
        ext.storage.local.set({ cors_enabled: shouldEnable });
      }
      updateUI(shouldEnable);
    } catch (err) {
      console.error("Failed to toggle CORS ruleset:", err);
      // Revert UI on failure
      toggle.checked = !shouldEnable;
    }
  });

  // 3. Open Nuvio Web action (Universal across Desktop, Android, iPad, and iOS)
  openAppBtn.addEventListener("click", () => {
    const targetUrl = "https://nuvio-web.vercel.app";

    if (ext && ext.tabs && ext.tabs.query) {
      ext.tabs.query({ url: "*://*/*" }, (tabs) => {
        const nuvioTab = tabs && tabs.find(
          (t) =>
            t.url &&
            (t.url.includes("localhost:3000") ||
              t.url.includes("nuvio-web") ||
              t.url.includes("nuvioweb") ||
              t.url.includes("nuvio.app"))
        );
        if (nuvioTab && nuvioTab.id) {
          ext.tabs.update(nuvioTab.id, { active: true });
          if (nuvioTab.windowId && ext.windows && ext.windows.update) {
            ext.windows.update(nuvioTab.windowId, { focused: true });
          }
        } else {
          ext.tabs.create({ url: targetUrl });
        }
      });
    } else {
      window.open(targetUrl, "_blank");
    }
  });
});
