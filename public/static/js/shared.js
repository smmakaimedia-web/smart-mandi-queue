// shared.js — replaces src/integrations/supabase/client.ts, src/lib/auth.tsx,
// src/lib/queue.ts, src/components/AppShell.tsx and the sonner toaster.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const SUPABASE_URL = "https://rqxrkvewmryobubymgwj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vv0SuhWzyq6h8ZNxoBxpww_hzpd8-dB";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "smart-mandi-static-auth" },
  global: {
    // Publishable keys are opaque strings, not bearer JWTs.
    fetch: (input, init) => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) headers.delete("Authorization");
      headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
      return fetch(input, { ...init, headers });
    },
  },
});

/* ---------------- toasts (sonner replacement) ---------------- */

function toastEl() {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts";
    document.body.appendChild(box);
  }
  return box;
}

export function toast(message, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = message;
  toastEl().appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
toast.error = (m) => toast(m, "error");
toast.success = (m) => toast(m, "success");
toast.info = (m) => toast(m, "");

/* ---------------- queue maths (src/lib/queue.ts) ---------------- */

export const BUFFER_MINUTES = 5;

export function activeQueue(tokens) {
  return tokens
    .filter((t) => t.status === "booked" || t.status === "arrived")
    .sort((a, b) => a.token_number - b.token_number);
}

export function estimateWait(avgServiceMinutes, position) {
  const ahead = Math.max(position - 1, 0);
  const minutes = avgServiceMinutes * ahead + BUFFER_MINUTES;
  return {
    ahead,
    minutes,
    formula: `${avgServiceMinutes} min per farmer × ${ahead} ahead of you + ${BUFFER_MINUTES} min buffer = ${minutes} min`,
  };
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/* ---------------- auth helpers (src/lib/auth.tsx) ---------------- */

export function homeForRole(role) {
  if (role === "operator") return "operator.html";
  if (role === "admin") return "admin.html";
  return "farmer.html";
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function loadProfileAndRole(userId) {
  if (!userId) return { profile: null, role: null };
  const [{ data: p }, { data: r }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle(),
  ]);
  return { profile: p ?? null, role: r?.role ?? null };
}

/** Gate for the authenticated pages (replaces routes/_authenticated/route.tsx). */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.replace("auth.html");
    return null;
  }
  const { profile, role } = await loadProfileAndRole(session.user.id);
  return { session, user: session.user, profile, role };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("auth.html");
}

/* ---------------- shell (AppShell.tsx) ---------------- */

export function renderShell({ title, subtitle, profile, role }) {
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<header class="appbar">
       <div class="appbar-inner">
         <a class="brand" href="index.html"><span class="brand-mark">🌱</span> Smart Mandi</a>
         <div class="row">
           <span class="who" id="whoami"></span>
           <button class="icon-btn" id="signout" aria-label="Sign out">⎋</button>
         </div>
       </div>
     </header>`,
  );
  const who = document.getElementById("whoami");
  who.textContent = profile ? `${profile.name} · ${role ?? ""}` : "";
  document.getElementById("signout").addEventListener("click", () => void signOut());

  const head = document.getElementById("page-head");
  if (head) {
    head.innerHTML = `<h1 class="page-title"></h1>${subtitle ? '<p class="page-sub"></p>' : ""}`;
    head.querySelector(".page-title").textContent = title;
    if (subtitle) head.querySelector(".page-sub").textContent = subtitle;
  }
}

/* ---------------- misc ---------------- */

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
