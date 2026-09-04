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
  renderFooter();
}

/* ---------------- footer (shared partial, rendered once per page) ---------------- */

// [PLACEHOLDER] Replace these three values with the real support details.
export const CONTACT = {
  email: "support@smartmandi.example", // [PLACEHOLDER]
  helpline: "+91 00000 00000", // [PLACEHOLDER]
  address: "Smart Mandi Cell, District Procurement Office, [City], [State] 000000", // [PLACEHOLDER]
};

// Only links we are confident are the official portals are hyperlinked;
// anything uncertain stays as plain text on purpose.
const SCHEMES = [
  { name: "PM-KISAN", desc: "₹6,000 a year income support for landholding farmer families.", url: "https://pmkisan.gov.in/" },
  { name: "PMFBY (Fasal Bima)", desc: "Crop insurance against natural loss of yield.", url: "https://pmfby.gov.in/" },
  { name: "Kisan Credit Card (KCC)", desc: "Short-term credit for crop inputs at subsidised interest.", url: null },
  { name: "e-NAM", desc: "Online national market to sell produce across mandis.", url: "https://www.enam.gov.in/web/" },
];

export function renderFooter() {
  if (document.querySelector(".site-footer")) return;
  const links = [
    ["Home", "index.html"],
    ["Book a Slot", "book.html"],
    ["My Queue Status", "farmer.html"],
    ["Operator Login", "auth.html"],
    ["Admin Login", "auth.html"],
  ];
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="footer-inner">
      <div>
        <h3 class="footer-title">Quick Links</h3>
        <ul class="footer-list">
          ${links.map(([label, href]) => `<li><a href="${href}">${label}</a></li>`).join("")}
        </ul>
      </div>
      <div>
        <h3 class="footer-title">Contact</h3>
        <ul class="footer-list">
          <li><a href="mailto:${CONTACT.email}">${escapeHtml(CONTACT.email)}</a></li>
          <li><a href="tel:${CONTACT.helpline.replace(/\s/g, "")}">${escapeHtml(CONTACT.helpline)}</a> · helpline</li>
          <li>${escapeHtml(CONTACT.address)}</li>
        </ul>
        <p class="footer-note">[PLACEHOLDER] contact details — replace before launch.</p>
      </div>
      <div>
        <h3 class="footer-title">Farmer Welfare Schemes</h3>
        <ul class="footer-list">
          ${SCHEMES.map(
            (s) =>
              `<li>${
                s.url
                  ? `<a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>`
                  : `<span class="semibold">${escapeHtml(s.name)}</span>`
              } — ${escapeHtml(s.desc)}</li>`,
          ).join("")}
        </ul>
      </div>
    </div>
    <p class="footer-bottom">Smart Mandi · Slot booking and live queue for procurement centres</p>`;
  document.body.appendChild(footer);
}

/* ---------------- farmer verification helpers ---------------- */

export const VERIFICATION_TEXT = {
  pending: "Your farmer status is pending verification. You can browse, but booking unlocks once an admin approves your details.",
  rejected: "Your farmer verification was rejected. Please contact the centre or resubmit your ID details to book a slot.",
};

export function renderVerificationBanner(profile, mountId = "verify-banner") {
  const mount = document.getElementById(mountId);
  if (!mount || !profile) return profile?.verification_status === "verified";
  const status = profile.verification_status ?? "pending";
  if (status === "verified") {
    mount.innerHTML = "";
    return true;
  }
  mount.innerHTML = `<div class="banner warn"><span>⚠️</span><span>${escapeHtml(VERIFICATION_TEXT[status] ?? VERIFICATION_TEXT.pending)}</span></div>`;
  return false;
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
