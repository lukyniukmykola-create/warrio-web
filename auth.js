(() => {
  "use strict";

  const config = window.WARRIO_WEB_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const apiKey = config.supabasePublishableKey;
  const storageKey = "warrio.auth.session.v1";
  let session = null;
  let refreshTimer = null;

  async function timedFetch(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    catch (error) { if (error?.name === "AbortError") throw new Error("auth_timeout"); throw error; }
    finally { clearTimeout(timer); }
  }

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(baseUrl)
      && /^sb_publishable_[A-Za-z0-9_-]+$/.test(String(apiKey || ""));
  }

  function readStored() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!value?.access_token || !value?.refresh_token || !value?.user?.id) return null;
      return value;
    } catch {
      return null;
    }
  }

  function store(value) {
    session = value;
    if (value) localStorage.setItem(storageKey, JSON.stringify(value));
    else localStorage.removeItem(storageKey);
    scheduleRefresh();
    window.dispatchEvent(new CustomEvent("warrio:auth", { detail: { session } }));
    return session;
  }

  function normalizeSession(payload) {
    if (!payload?.access_token || !payload?.refresh_token || !payload?.user) {
      throw new Error("invalid_auth_response");
    }
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      token_type: payload.token_type || "bearer",
      expires_at: Math.floor(Date.now() / 1000) + Number(payload.expires_in || 3600),
      user: payload.user
    };
  }

  async function authRequest(path, body, accessToken = "") {
    if (!configured()) throw new Error("auth_not_configured");
    const headers = { "Content-Type": "application/json", apikey: apiKey };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await timedFetch(`${baseUrl}/auth/v1/${path}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.msg || payload.message || payload.error_description || "auth_failed");
      error.status = response.status;
      error.code = payload.error_code || payload.code || "auth_failed";
      throw error;
    }
    return payload;
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    if (!session?.expires_at) return;
    const delay = Math.max(5000, (session.expires_at * 1000) - Date.now() - 60000);
    refreshTimer = setTimeout(() => refresh().catch(() => store(null)), delay);
  }

  async function refresh() {
    const current = session || readStored();
    if (!current?.refresh_token) throw new Error("session_missing");
    const payload = await authRequest("token?grant_type=refresh_token", {
      refresh_token: current.refresh_token
    });
    return store(normalizeSession(payload));
  }

  async function getUser(accessToken) {
    const response = await timedFetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error("session_invalid");
    return response.json();
  }

  async function initialize() {
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
    if (fragment.get("access_token") && fragment.get("refresh_token")) {
      const accessToken = fragment.get("access_token");
      const user = await getUser(accessToken);
      const redirected = store(normalizeSession({
        access_token: accessToken,
        refresh_token: fragment.get("refresh_token"),
        token_type: fragment.get("token_type") || "bearer",
        expires_in: Number(fragment.get("expires_in") || 3600),
        user
      }));
      history.replaceState(null, "", `${location.pathname}${location.search}`);
      return redirected;
    }
    const stored = readStored();
    if (!stored) return store(null);
    session = stored;
    try {
      if ((stored.expires_at || 0) <= Math.floor(Date.now() / 1000) + 30) {
        return await refresh();
      }
      const user = await getUser(stored.access_token);
      return store({ ...stored, user });
    } catch {
      return store(null);
    }
  }

  async function signIn(email, password) {
    const payload = await authRequest("token?grant_type=password", {
      email: String(email || "").trim().toLowerCase(),
      password: String(password || "")
    });
    return store(normalizeSession(payload));
  }

  async function signUp(email, password, fullName) {
    const payload = await authRequest("signup", {
      email: String(email || "").trim().toLowerCase(),
      password: String(password || ""),
      data: { full_name: String(fullName || "").trim() }
    });
    if (payload.access_token) return store(normalizeSession(payload));
    return { confirmationRequired: true, user: payload.user || null };
  }

  async function sendMagicLink(email) {
    const redirectTo = location.origin === "null" ? undefined : `${location.origin}${location.pathname}`;
    await authRequest(`otp${redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : ""}`, {
      email: String(email || "").trim().toLowerCase(),
      create_user: true
    });
    return true;
  }

  async function signOut() {
    const current = session;
    store(null);
    if (!current?.access_token) return;
    try { await authRequest("logout", undefined, current.access_token); } catch { /* local sign-out still succeeds */ }
  }

  function getSession() { return session; }
  function accessToken() { return session?.access_token || ""; }

  window.WarrioAuth = Object.freeze({
    configured, initialize, signIn, signUp, sendMagicLink, signOut,
    refresh, getSession, accessToken
  });
})();
