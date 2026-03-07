const state = {
  user: null,
  session: null,
  channels: [],
  skills: [],
  connection: null,
};

const $ = (id) => document.getElementById(id);

const setStatus = (id, tone, value) => {
  const el = $(id);
  el.className = `status ${tone}`;
  el.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

const toJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  const body = await toJson(response);
  if (!response.ok) {
    throw new Error(JSON.stringify(body));
  }
  return body;
};

const setUserIdHints = (userId) => {
  $("bootstrapUserId").value = userId;
  $("channelUserId").value = userId;
  $("skillsUserId").value = userId;
};

const parseEnvPairs = (text) => {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    env[key.trim()] = rest.join("=").trim();
  }
  return env;
};

const renderChannelTable = () => {
  const tbody = $("channelsTable");
  tbody.innerHTML = "";
  for (const channel of state.channels) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${channel.channelId}</td><td>${channel.authMode}</td><td>${channel.setupType}</td>`;
    tbody.appendChild(tr);
  }
};

const renderSkillTable = () => {
  const tbody = $("skillsTable");
  tbody.innerHTML = "";
  for (const skill of state.skills) {
    const missing =
      skill.missingRequirements.length === 0 ? "none" : skill.missingRequirements.join(", ");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${skill.skillKey}</td><td>${skill.source}</td><td>${missing}</td>`;
    tbody.appendChild(tr);
  }
};

const handleCallbackIfPresent = async () => {
  if (window.location.pathname !== "/auth/callback") {
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const stateParam = params.get("state");
  if (!code || !stateParam) {
    setStatus("loginStatus", "bad", "Missing code/state on callback URL.");
    window.history.replaceState({}, "", "/");
    return;
  }
  try {
    const session = await api(
      `/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(stateParam)}`,
    );
    state.session = session;
    localStorage.setItem("openclawPortalSession", JSON.stringify(session));
    setStatus("loginStatus", "ok", session);
  } catch (error) {
    setStatus("loginStatus", "bad", String(error));
  } finally {
    window.history.replaceState({}, "", "/");
  }
};

const restoreSession = () => {
  const raw = localStorage.getItem("openclawPortalSession");
  if (!raw) {
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    state.session = parsed;
    setStatus("loginStatus", "ok", parsed);
  } catch {
    localStorage.removeItem("openclawPortalSession");
  }
};

$("signupBtn").addEventListener("click", async () => {
  try {
    const user = await api("/api/onboarding/signup", {
      method: "POST",
      body: JSON.stringify({
        email: $("signupEmail").value.trim(),
        displayName: $("signupName").value.trim(),
      }),
    });
    state.user = user;
    setUserIdHints(user.userId);
    setStatus("signupStatus", "ok", user);
  } catch (error) {
    setStatus("signupStatus", "bad", String(error));
  }
});

$("inviteBtn").addEventListener("click", async () => {
  try {
    const result = await api("/api/onboarding/invite/accept", {
      method: "POST",
      body: JSON.stringify({
        token: $("inviteToken").value.trim(),
        email: $("inviteEmail").value.trim(),
        displayName: $("inviteName").value.trim(),
      }),
    });
    state.user = result.user;
    setUserIdHints(result.user.userId);
    setStatus("inviteStatus", "ok", result);
  } catch (error) {
    setStatus("inviteStatus", "bad", String(error));
  }
});

$("loginBtn").addEventListener("click", async () => {
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        tenantHint: $("tenantHint").value.trim() || undefined,
        redirectUri: `${window.location.origin}/auth/callback`,
      }),
    });
    setStatus("loginStatus", "warn", "Redirecting to identity provider...");
    window.location.href = result.redirectUrl;
  } catch (error) {
    setStatus("loginStatus", "bad", String(error));
  }
});

$("refreshBtn").addEventListener("click", async () => {
  try {
    if (!state.session?.refreshToken) {
      throw new Error("No refresh token in session.");
    }
    const refreshed = await api("/api/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: state.session.refreshToken }),
    });
    state.session = refreshed;
    localStorage.setItem("openclawPortalSession", JSON.stringify(refreshed));
    setStatus("loginStatus", "ok", refreshed);
  } catch (error) {
    setStatus("loginStatus", "bad", String(error));
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    if (!state.session?.refreshToken) {
      throw new Error("No refresh token in session.");
    }
    await api("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: state.session.refreshToken }),
    });
    state.session = null;
    localStorage.removeItem("openclawPortalSession");
    setStatus("loginStatus", "ok", "Logged out");
  } catch (error) {
    setStatus("loginStatus", "bad", String(error));
  }
});

$("bootstrapBtn").addEventListener("click", async () => {
  try {
    const bootstrap = await api("/api/onboarding/bootstrap", {
      method: "POST",
      body: JSON.stringify({
        tenantId: $("tenantId").value.trim(),
        workspaceId: $("workspaceId").value.trim() || undefined,
        ownerUserId: $("bootstrapUserId").value.trim(),
        profile: $("profile").value,
      }),
    });
    setStatus("bootstrapStatus", "ok", bootstrap);
  } catch (error) {
    setStatus("bootstrapStatus", "bad", String(error));
  }
});

$("completeSetupBtn").addEventListener("click", async () => {
  try {
    const complete = await api("/api/onboarding/setup/complete", {
      method: "POST",
      body: JSON.stringify({
        userId: $("bootstrapUserId").value.trim(),
        tenantId: $("tenantId").value.trim(),
        workspaceId: $("workspaceId").value.trim() || "default",
      }),
    });
    setStatus("bootstrapStatus", "ok", complete);
  } catch (error) {
    setStatus("bootstrapStatus", "bad", String(error));
  }
});

$("loadChannelsBtn").addEventListener("click", async () => {
  try {
    const { channels } = await api("/api/channels/catalog");
    state.channels = channels;
    $("channelId").innerHTML = channels
      .map(
        (entry) =>
          `<option value="${entry.channelId}">${entry.channelId} (${entry.authMode})</option>`,
      )
      .join("");
    renderChannelTable();
    setStatus("channelsStatus", "ok", { loaded: channels.length });
  } catch (error) {
    setStatus("channelsStatus", "bad", String(error));
  }
});

$("connectChannelBtn").addEventListener("click", async () => {
  try {
    const connection = await api("/api/channels/connections", {
      method: "POST",
      body: JSON.stringify({
        userId: $("channelUserId").value.trim(),
        channelId: $("channelId").value,
        accountLabel: $("accountLabel").value.trim() || "primary",
      }),
    });
    state.connection = connection;
    $("connectionId").value = connection.connectionId;
    setStatus("channelsStatus", "ok", connection);
  } catch (error) {
    setStatus("channelsStatus", "bad", String(error));
  }
});

$("verifyChannelBtn").addEventListener("click", async () => {
  try {
    const connectionId = $("connectionId").value.trim();
    const verified = await api(
      `/api/channels/connections/${encodeURIComponent(connectionId)}/verify`,
      {
        method: "POST",
        body: JSON.stringify({ ok: true }),
      },
    );
    setStatus("channelsStatus", "ok", verified);
  } catch (error) {
    setStatus("channelsStatus", "bad", String(error));
  }
});

$("loadSkillsBtn").addEventListener("click", async () => {
  try {
    const { skills } = await api("/api/skills/catalog");
    state.skills = skills;
    $("skillKey").innerHTML = skills
      .map(
        (entry) => `<option value="${entry.skillKey}">${entry.title} (${entry.skillKey})</option>`,
      )
      .join("");
    renderSkillTable();
    setStatus("skillsStatus", "ok", { loaded: skills.length });
  } catch (error) {
    setStatus("skillsStatus", "bad", String(error));
  }
});

$("installSkillBtn").addEventListener("click", async () => {
  try {
    const result = await api("/api/skills/install", {
      method: "POST",
      body: JSON.stringify({
        userId: $("skillsUserId").value.trim(),
        skillKey: $("skillKey").value,
      }),
    });
    $("configSkillKey").value = $("skillKey").value;
    setStatus("skillsStatus", "ok", result);
  } catch (error) {
    setStatus("skillsStatus", "bad", String(error));
  }
});

$("configureSkillBtn").addEventListener("click", async () => {
  try {
    const skillKey = $("configSkillKey").value.trim();
    const result = await api(`/api/skills/${encodeURIComponent(skillKey)}/configure`, {
      method: "POST",
      body: JSON.stringify({
        userId: $("skillsUserId").value.trim(),
        enabled: true,
        env: parseEnvPairs($("envPairs").value),
      }),
    });
    setStatus("skillsStatus", "ok", result);
  } catch (error) {
    setStatus("skillsStatus", "bad", String(error));
  }
});

restoreSession();
await handleCallbackIfPresent();
