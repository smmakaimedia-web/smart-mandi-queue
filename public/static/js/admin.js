// admin.js — replaces src/routes/_authenticated/admin.tsx (AdminDashboard)
// The recharts BarChart is redrawn as plain CSS bars — same booked/served series.
import { supabase, requireAuth, renderShell, BUFFER_MINUTES, todayISO, escapeHtml } from "./shared.js";

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
