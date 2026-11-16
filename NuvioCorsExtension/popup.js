document.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.getElementById("toggleRules");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const statusSubtext = document.getElementById("statusSubtext");
  const openAppBtn = document.getElementById("openAppBtn");

  const RULESET_ID = "cors_rules";

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
    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.getEnabledRulesets) {
      const enabledRulesets = await chrome.declarativeNetRequest.getEnabledRulesets();
      const isEnabled = enabledRulesets.includes(RULESET_ID);
      updateUI(isEnabled);
    } else {
      // Fallback to storage
      chrome.storage.local.get(["cors_enabled"], (res) => {
        updateUI(res.cors_enabled !== false);
      });
    }
  } catch {
    updateUI(true);
  }

  // 2. Handle toggle changes
  toggle.addEventListener("change", async () => {
    const shouldEnable = toggle.checked;
    try {
      if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateEnabledRulesets) {
        await chrome.declarativeNetRequest.updateEnabledRulesets({
          enableRulesetIds: shouldEnable ? [RULESET_ID] : [],
          disableRulesetIds: shouldEnable ? [] : [RULESET_ID],
        });
      }
      chrome.storage.local.set({ cors_enabled: shouldEnable });
      updateUI(shouldEnable);
    } catch (err) {
      console.error("Failed to toggle CORS ruleset:", err);
      // Revert UI on failure
      toggle.checked = !shouldEnable;
    }
  });

  // 3. Open Nuvio Web action
  openAppBtn.addEventListener("click", () => {
    chrome.tabs.query({ url: "*://*/*" }, (tabs) => {
      const nuvioTab = tabs.find(
        (t) =>
          t.url &&
          (t.url.includes("localhost:3000") ||
            t.url.includes("nuvioweb") ||
            t.url.includes("nuvio-web-enhanced"))
      );
      if (nuvioTab && nuvioTab.id) {
        chrome.tabs.update(nuvioTab.id, { active: true });
        if (nuvioTab.windowId) {
          chrome.windows.update(nuvioTab.windowId, { focused: true });
        }
      } else {
        chrome.tabs.create({ url: "http://localhost:3000" });
      }
    });
  });
});
