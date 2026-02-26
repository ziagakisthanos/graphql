// Handles login, logout, JWT storage, and page auth guard.
const TOKEN_KEY = "gql_jwt";

// ── Token storage ─────────────────────────────────────────────────
function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── JWT decode ────────────────────────────────────────────────────
function decodeToken(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ── Auth guard ────────────────────────────────────────────────────
function requireAuth() {
  const token = getToken();
  if (!token) {
    window.location.href = "/";
    return false;
  }
  const payload = decodeToken(token);
  // Reject if decode failed, exp is missing, or exp is in the past
  if (!payload?.exp || new Date(payload.exp * 1000) < new Date()) {
    clearToken();
    window.location.href = "/";
    return false;
  }
  return true;
}

// ── Logout ────────────────────────────────────────────────────────
function logout() {
  clearToken();
  window.location.href = "/";
}

// ── Login form helpers ────────────────────────────────────────────
function showLoginError(message) {
  const el = document.getElementById("error-msg");
  if (!el) return;
  el.textContent = message;
  el.style.display = "block";
}

function hideLoginError() {
  const el = document.getElementById("error-msg");
  if (!el) return;
  el.textContent = "";
  el.style.display = "none";
}

function setLoginLoading(loading) {
  const btn = document.getElementById("submit-btn");
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle("loading", loading);
}

// ── Login handler ─────────────────────────────────────────────────
// On success the API returns a JWT which we store in localStorage.
async function handleLogin(event) {
  event.preventDefault();
  hideLoginError();
  setLoginLoading(true);

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    showLoginError("Please enter your username and password.");
    setLoginLoading(false);
    return;
  }

  try {
    const response = await fetch(API.signin, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${username}:${password}`),
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      showLoginError("Invalid credentials. Please try again.");
      setLoginLoading(false);
      return;
    }

    if (!response.ok) {
      showLoginError(`Unexpected error (${response.status}). Please try again.`);
      setLoginLoading(false);
      return;
    }

    // The upstream may return the JWT as plain text or inside a JSON object
    const contentType = response.headers.get("content-type") ?? "";
    let token;

    if (contentType.includes("application/json")) {
      const data = await response.json();
      token = data.token ?? data.jwt ?? data.access_token;
      if (typeof token !== "string") {
        token = typeof data === "string" ? data : null;
      }
    } else {
      token = (await response.text()).trim().replace(/^"|"$/g, "");
    }

    if (!token) {
      showLoginError("Received an invalid token. Please contact support.");
      setLoginLoading(false);
      return;
    }

    saveToken(token);
    window.location.href = "/profile.html";

  } catch (err) {
    console.error("Login error:", err);
    showLoginError("Connection error. Please check your internet and try again.");
    setLoginLoading(false);
  }
}

// ── Init ──────────────────────────────────────────────────────────
const loginForm = document.getElementById("login-form");
if (loginForm) {
  if (getToken()) {
    window.location.href = "/profile.html";
  }
  loginForm.addEventListener("submit", handleLogin);
}