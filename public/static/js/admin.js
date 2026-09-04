// admin.js — replaces src/routes/_authenticated/admin.tsx (AdminDashboard)
// The recharts BarChart is redrawn as plain CSS bars — same booked/served series.
import { supabase, requireAuth, renderShell, BUFFER_MINUTES, todayISO, escapeHtml, toast } from "./shared.js";

const auth = await requireAuth();
if (!auth) throw new Error("not signed in");

const today = todayISO();
renderShell({ title: "All centres today", subtitle: today, profile: auth.profile, role: auth.role });

const [{ data: centres }, { data: tokens }] = await Promise.all([
  supabase.from("centres").select("id, name, location").order("name"),
  supabase.from("tokens").select("id, centre_id, status, commodities(avg_service_time_minutes)").eq("token_date", today),
]);

const rows = (centres ?? []).map((c) => {
  const list = (tokens ?? []).filter((t) => t.centre_id === c.id);
  const served = list.filter((t) => t.status === "served").length;
  const waiting = list.filter((t) => t.status === "booked" || t.status === "arrived").length;
  const avgService = list.length
    ? list.reduce((s, t) => s + (t.commodities?.avg_service_time_minutes ?? 10), 0) / list.length
    : 0;
  const avgWait = Math.round((avgService * Math.max(waiting - 1, 0)) / 2 + BUFFER_MINUTES);
  return { name: c.name, location: c.location, booked: list.length, served, waiting, avgWait };
});

const totals = rows.reduce(
  (a, r) => ({ booked: a.booked + r.booked, served: a.served + r.served, waiting: a.waiting + r.waiting }),
  { booked: 0, served: 0, waiting: 0 },
);

document.getElementById("totals").innerHTML = [
  { label: "Tokens booked", value: totals.booked },
  { label: "Farmers served", value: totals.served },
  { label: "Still waiting", value: totals.waiting },
]
  .map(
    (s) =>
      `<div class="card tight center"><p class="bold" style="font-size:1.875rem;color:var(--primary);margin:0">${s.value}</p>
       <p class="xs muted mt-1" style="margin-bottom:0">${s.label}</p></div>`,
  )
  .join("");

const max = Math.max(1, ...rows.map((r) => Math.max(r.booked, r.served)));
document.getElementById("chart").innerHTML = rows
  .map(
    (r) => `
    <div class="chart-col">
      <div class="chart-bars">
        <div class="chart-bar booked" style="height:${(r.booked / max) * 100}%"><span>${r.booked}</span></div>
        <div class="chart-bar served" style="height:${(r.served / max) * 100}%"><span>${r.served}</span></div>
      </div>
      <div class="chart-label">${escapeHtml(r.name.split(" ")[0])}</div>
    </div>`,
  )
  .join("");

document.getElementById("breakdown").innerHTML = rows
  .map(
    (r) => `
    <div class="card tight" style="margin-bottom:.75rem">
      <p class="semibold" style="margin:0">${escapeHtml(r.name)}</p>
      <p class="xs muted" style="margin:.15rem 0 0">${escapeHtml(r.location)}</p>
      <div class="grid3 mt-3" style="text-align:center">
        <div><p class="bold" style="font-size:1.25rem;margin:0">${r.booked}</p><p class="xs muted" style="margin:0">booked</p></div>
        <div><p class="bold" style="font-size:1.25rem;margin:0">${r.served}</p><p class="xs muted" style="margin:0">served</p></div>
        <div><p class="bold" style="font-size:1.25rem;margin:0">${r.avgWait} min</p><p class="xs muted" style="margin:0">avg wait</p></div>
      </div>
    </div>`,
  )
  .join("");


/* ---------- Pending farmer verifications (self-declaration approval workflow) ---------- */

const pendingBox = document.getElementById("pending");

async function renderPending() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, phone, phone_verified, village, id_type, id_number, document_path, verification_status, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    pendingBox.innerHTML = `<p class="small muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    pendingBox.innerHTML = `<div class="dashed">No farmers are waiting for verification.</div>`;
    return;
  }

  pendingBox.innerHTML = "";
  for (const p of data) {
    let docLink = "";
    if (p.document_path) {
      const { data: signed } = await supabase.storage.from("farmer-documents").createSignedUrl(p.document_path, 300);
      if (signed?.signedUrl) {
        docLink = `<p class="small mt-2"><a class="link-btn" href="${signed.signedUrl}" target="_blank" rel="noopener">View submitted document</a></p>`;
      }
    }
    const card = document.createElement("div");
    card.className = "card tight";
    card.style.marginBottom = ".75rem";
    card.innerHTML = `
      <div class="row">
        <div class="grow">
          <p class="semibold" style="margin:0">${escapeHtml(p.name)}</p>
          <p class="xs muted" style="margin:.15rem 0 0">${escapeHtml(p.village || "—")} · ${escapeHtml(p.phone || "no phone")}
            ${p.phone_verified ? '<span class="status-pill verified">phone verified</span>' : '<span class="status-pill pending">phone unverified</span>'}</p>
        </div>
        <span class="status-pill pending">pending</span>
      </div>
      <p class="small mt-2" style="margin-bottom:0">${escapeHtml(p.id_type || "No ID type given")}: <span class="semibold">${escapeHtml(p.id_number || "—")}</span></p>
      ${docLink}
      <div class="grid2 mt-3">
        <button class="btn sm" data-approve="${p.id}">Approve</button>
        <button class="btn sm outline" data-reject="${p.id}">Reject</button>
      </div>`;
    pendingBox.appendChild(card);
  }

  pendingBox.querySelectorAll("[data-approve], [data-reject]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const approve = btn.hasAttribute("data-approve");
      const id = btn.getAttribute(approve ? "data-approve" : "data-reject");
      btn.disabled = true;
      const { error: uErr } = await supabase
        .from("profiles")
        .update({ verification_status: approve ? "verified" : "rejected" })
        .eq("id", id);
      if (uErr) {
        btn.disabled = false;
        toast.error(uErr.message);
        return;
      }
      toast.success(approve ? "Farmer verified — booking unlocked" : "Farmer rejected");
      await renderPending();
    });
  });
}

await renderPending();
