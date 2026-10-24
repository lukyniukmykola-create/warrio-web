(() => {
  "use strict";

  const config = window.WARRIO_WEB_CONFIG || {};
  const publishableKey = config.supabasePublishableKey;
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");

  function isConfigured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(baseUrl)
      && /^sb_publishable_[A-Za-z0-9_-]+$/.test(String(publishableKey || ""));
  }

  async function rpc(name, payload, options = {}) {
    if (!isConfigured()) throw new Error("Supabase configuration is incomplete.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: publishableKey
        },
        body: JSON.stringify(payload || {}),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function health() {
    const startedAt = performance.now();
    const payload = await rpc("get_public_warranty", {
      lookup_token: "warrio-healthcheck-token-not-present"
    });
    return {
      ok: Array.isArray(payload),
      latencyMs: Math.round(performance.now() - startedAt)
    };
  }

  function verificationUrl(token = "") {
    const path = config.verificationPath || "verify/index.html";
    return token ? `${path}?token=${encodeURIComponent(token)}` : path;
  }

  function activationUrl(organizationSlug, serialNumber, activationCode) {
    const path = config.activationPath || "activate/index.html";
    const url = new URL(path, window.location.href);
    url.searchParams.set("org", organizationSlug || "");
    url.searchParams.set("sn", serialNumber || "");
    url.searchParams.set("code", activationCode || "");
    return url.href;
  }

  window.WarrioBackend = Object.freeze({ isConfigured, health, rpc, verificationUrl, activationUrl });
})();
