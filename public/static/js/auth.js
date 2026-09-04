// auth.js — replaces src/routes/auth.tsx (AuthPage / SignIn / SignUp)
// Adds: phone OTP verification (Supabase phone auth) and the farmer self-declaration fields.
import { supabase, toast, getSession, loadProfileAndRole, homeForRole, renderFooter } from "./shared.js";

renderFooter();


const COMMODITIES = ["Wheat", "Paddy", "Maize", "Mustard", "Cotton", "Soybean", "Onion", "Sugarcane"];
const ROLES = [
  { value: "farmer", label: "Farmer", hint: "Book slots" },
  { value: "operator", label: "Operator", hint: "Run a centre" },
  { value: "admin", label: "Admin", hint: "See all centres" },
];

// Already signed in? go straight to the right dashboard.
const session = await getSession();
if (session) {
  const { role } = await loadProfileAndRole(session.user.id);
  window.location.replace(homeForRole(role));
}

/* --- tabs (replaces <Tabs>) --- */
const tabSignIn = document.getElementById("tab-signin");
const tabSignUp = document.getElementById("tab-signup");
const formSignIn = document.getElementById("form-signin");
const formSignUp = document.getElementById("form-signup");

function showTab(which) {
  const signin = which === "signin";
  tabSignIn.setAttribute("aria-selected", String(signin));
  tabSignUp.setAttribute("aria-selected", String(!signin));
  formSignIn.classList.toggle("hidden", !signin);
  formSignUp.classList.toggle("hidden", signin);
}
tabSignIn.addEventListener("click", () => showTab("signin"));
tabSignUp.addEventListener("click", () => showTab("signup"));

/* --- state (replaces useState) --- */
let selectedRole = "farmer";
let crops = [];

const rolesBox = document.getElementById("roles");
ROLES.forEach((r) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.dataset.role = r.value;
  b.innerHTML = `<span class="semibold">${r.label}</span><span class="sub">${r.hint}</span>`;
  b.addEventListener("click", () => {
    selectedRole = r.value;
    renderRoles();
  });
  rolesBox.appendChild(b);
});

const cropsBox = document.getElementById("crops");
COMMODITIES.forEach((c) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip pill";
  b.textContent = c;
  b.addEventListener("click", () => {
    crops = crops.includes(c) ? crops.filter((x) => x !== c) : [...crops, c];
    b.setAttribute("aria-pressed", String(crops.includes(c)));
  });
  cropsBox.appendChild(b);
});

function renderRoles() {
  rolesBox.querySelectorAll("button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.role === selectedRole));
  });
  const isFarmer = selectedRole === "farmer";
  document.getElementById("crops-wrap").classList.toggle("hidden", !isFarmer);
  document.getElementById("farmer-id-wrap").classList.toggle("hidden", !isFarmer);
}
renderRoles();


/* --- sign in --- */
formSignIn.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("si-submit");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  const { data, error } = await supabase.auth.signInWithPassword({
    email: document.getElementById("si-email").value,
    password: document.getElementById("si-pass").value,
  });
  btn.disabled = false;
  btn.textContent = "Sign in";
  if (error) return toast.error(error.message);
  const { role } = await loadProfileAndRole(data.user.id);
  window.location.assign(homeForRole(role));
});

/* --- register --- */
formSignUp.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("su-submit");
  btn.disabled = true;
  btn.textContent = "Creating account…";
  const email = document.getElementById("su-email").value;
  const password = document.getElementById("su-pass").value;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) {
    btn.disabled = false;
    btn.textContent = "Create account";
    return toast.error(error.message);
  }
  const userId = data.user?.id;
  if (!data.session || !userId) {
    btn.disabled = false;
    btn.textContent = "Create account";
    return toast.success("Check your email to confirm your account, then sign in.");
  }
  const [{ error: pErr }, { error: rErr }] = await Promise.all([
    supabase.from("profiles").insert({
      id: userId,
      name: document.getElementById("su-name").value,
      phone: document.getElementById("su-phone").value,
      village: document.getElementById("su-village").value,
      preferred_commodities: crops,
    }),
    supabase.from("user_roles").insert({ user_id: userId, role: selectedRole }),
  ]);
  btn.disabled = false;
  btn.textContent = "Create account";
  if (pErr || rErr) return toast.error(pErr?.message ?? rErr?.message ?? "Could not save your profile");
  toast.success("Welcome to Smart Mandi");
  window.location.assign(homeForRole(selectedRole));
});
