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
  const phone = document.getElementById("su-phone").value.trim();
  const isFarmer = selectedRole === "farmer";

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

  // Optional supporting document → private Supabase Storage bucket, keyed by user id.
  let documentPath = null;
  const file = document.getElementById("su-doc").files?.[0];
  if (isFarmer && file) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/id-document.${ext}`;
    const { error: upErr } = await supabase.storage.from("farmer-documents").upload(path, file, { upsert: true });
    if (upErr) toast.error(`Document upload failed: ${upErr.message}`);
    else documentPath = path;
  }

  const [{ error: pErr }, { error: rErr }] = await Promise.all([
    supabase.from("profiles").insert({
      id: userId,
      name: document.getElementById("su-name").value,
      phone,
      village: document.getElementById("su-village").value,
      preferred_commodities: crops,
      phone_verified: false,
      id_type: isFarmer ? document.getElementById("su-idtype").value : null,
      id_number: isFarmer ? document.getElementById("su-idnumber").value.trim() || null : null,
      document_path: documentPath,
      // Farmers start as "pending" and need admin approval; staff accounts don't book.
      verification_status: isFarmer ? "pending" : "verified",
    }),
    supabase.from("user_roles").insert({ user_id: userId, role: selectedRole }),
  ]);
  btn.disabled = false;
  btn.textContent = "Create account";
  if (pErr || rErr) return toast.error(pErr?.message ?? rErr?.message ?? "Could not save your profile");

  if (phone) return startOtp(phone);
  toast.success("Welcome to Smart Mandi");
  window.location.assign(homeForRole(selectedRole));
});

/* --- phone OTP verification (Supabase phone auth) --- */
const formOtp = document.getElementById("form-otp");
const otpHint = document.getElementById("otp-hint");
const otpError = document.getElementById("otp-error");
const otpResend = document.getElementById("otp-resend");
let otpPhone = "";
let cooldownTimer = null;

function startCooldown(seconds = 30) {
  clearInterval(cooldownTimer);
  let left = seconds;
  otpResend.disabled = true;
  otpResend.textContent = `Resend code in ${left}s`;
  cooldownTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(cooldownTimer);
      otpResend.disabled = false;
      otpResend.textContent = "Resend code";
    } else {
      otpResend.textContent = `Resend code in ${left}s`;
    }
  }, 1000);
}

async function sendCode(phone) {
  otpError.textContent = "";
  otpHint.textContent = "Sending code…";
  // Adds the phone to the signed-in account; Supabase sends the SMS code.
  const { error } = await supabase.auth.updateUser({ phone });
  if (error) {
    otpHint.textContent = `Enter the 6-digit code sent to ${phone}`;
    otpError.textContent = `Could not send the code: ${error.message}`;
    otpResend.disabled = false;
    otpResend.textContent = "Resend code";
    return;
  }
  otpHint.textContent = `Enter the 6-digit code sent to ${phone}`;
  startCooldown(30);
}

function startOtp(phone) {
  otpPhone = phone;
  formSignUp.classList.add("hidden");
  formSignIn.classList.add("hidden");
  document.querySelector(".tabs").classList.add("hidden");
  formOtp.classList.remove("hidden");
  void sendCode(phone);
}

otpResend.addEventListener("click", () => void sendCode(otpPhone));

document.getElementById("otp-skip").addEventListener("click", () => {
  toast.info("You can verify your phone later.");
  window.location.assign(homeForRole(selectedRole));
});

formOtp.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("otp-submit");
  const code = document.getElementById("otp-code").value.trim();
  otpError.textContent = "";
  if (code.length !== 6) {
    otpError.textContent = "Enter the 6-digit code.";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Verifying…";
  const { error } = await supabase.auth.verifyOtp({ phone: otpPhone, token: code, type: "phone_change" });
  btn.disabled = false;
  btn.textContent = "Verify and continue";
  if (error) {
    otpError.textContent = "That code is wrong or expired. Request a new one.";
    return;
  }
  const { data: sess } = await supabase.auth.getUser();
  if (sess?.user) await supabase.from("profiles").update({ phone_verified: true }).eq("id", sess.user.id);
  toast.success("Phone verified");
  window.location.assign(homeForRole(selectedRole));
});

