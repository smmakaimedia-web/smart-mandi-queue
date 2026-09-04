// operator.js — replaces src/routes/_authenticated/operator.tsx (OperatorDashboard + ServeDialog)
import { supabase, requireAuth, renderShell, toast, activeQueue, todayISO, escapeHtml } from "./shared.js";

const auth = await requireAuth();
if (!auth) throw new Error("not signed in");

const today = todayISO();
renderShell({ title: "Today's queue", subtitle: today, profile: auth.profile, role: auth.role });

const STATUS = { booked: "Waiting", arrived: "At counter", served: "Served", no_show: "No-show" };

const els = {
  select: document.getElementById("centre-select"),
  nowServing: document.getElementById("now-serving"),
  summary: document.getElementById("queue-summary"),
  callNext: document.getElementById("call-next"),
  tokens: document.getElementById("tokens"),
  modal: document.getElementById("serve-modal"),
};

let centreId = null;
let tokens = [];
let farmers = {};
let channel = null;
let serveFor = null;
let paid = true;

/* --- centres --- */
const { data: centres } = await supabase.from("centres").select("*").order("name");
(centres ?? []).forEach((c) => {
  const o = document.createElement("option");
  o.value = c.id;
  o.textContent = c.name;
  els.select.appendChild(o);
});
els.select.addEventListener("change", () => selectCentre(els.select.value));

if (centres?.length) await selectCentre(centres[0].id);

async function selectCentre(id) {
  centreId = id;
  els.select.value = id;
  if (channel) await supabase.removeChannel(channel);
  channel = supabase
    .channel(`op-queue-${centreId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tokens", filter: `centre_id=eq.${centreId}` },
      () => void refresh(),
    )
    .subscribe();
  await refresh();
}

async function refresh() {
  const { data, error } = await supabase
    .from("tokens")
    .select("id, token_number, status, quantity, farmer_id, commodities(name), slots(time_slot)")
    .eq("centre_id", centreId)
    .eq("token_date", today)
    .order("token_number");
  if (error) return toast.error(error.message);
  tokens = data ?? [];

  const ids = [...new Set(tokens.map((t) => t.farmer_id))];
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, name, phone, village").in("id", ids);
    farmers = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  } else {
    farmers = {};
  }
  render();
}

function render() {
  const queue = activeQueue(tokens);
  const nowServing = queue.find((t) => t.status === "arrived");
  const nextToken = queue.find((t) => t.status === "booked");

  els.nowServing.textContent = nowServing ? nowServing.token_number : "—";
  els.summary.textContent = `${queue.length} in queue · next up ${nextToken ? `token ${nextToken.token_number}` : "none"}`;
  els.callNext.disabled = !nextToken;

  if (!tokens.length) {
    els.tokens.innerHTML = `<div class="dashed">No bookings for today at this centre.</div>`;
    return;
  }

  els.tokens.innerHTML = tokens
    .map((t) => {
      const f = farmers[t.farmer_id];
      const done = t.status === "served" || t.status === "no_show";
      return `
      <div class="card tight" style="margin-bottom:.75rem">
        <div class="row">
          <div class="token-square" style="width:3rem;height:3rem">${t.token_number}</div>
          <div class="grow">
            <p class="semibold truncate" style="margin:0">${escapeHtml(f?.name ?? "Farmer")}</p>
            <p class="small muted truncate" style="margin:.15rem 0 0">
              ${escapeHtml(t.commodities?.name)} · ${Number(t.quantity)} qtl · ${escapeHtml(t.slots?.time_slot)}
            </p>
            ${f?.village ? `<p class="xs muted truncate" style="margin:.15rem 0 0">${escapeHtml(f.village)} · ${escapeHtml(f.phone ?? "")}</p>` : ""}
          </div>
          <span class="badge ${t.status === "arrived" ? "on" : ""}">${STATUS[t.status]}</span>
        </div>
        ${
          done
            ? ""
            : `<div class="grid3 mt-3">
                 <button class="btn outline sm" data-act="arrived" data-id="${t.id}">Arrived</button>
                 <button class="btn sm" data-act="serve" data-id="${t.id}">Serve</button>
                 <button class="btn outline sm" data-act="no_show" data-id="${t.id}">No-show</button>
               </div>`
        }
      </div>`;
    })
    .join("");
}

/* --- actions (delegated listeners replace onClick props) --- */
els.tokens.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const token = tokens.find((t) => t.id === btn.dataset.id);
  if (btn.dataset.act === "serve") return openServe(token);
  const { error } = await supabase.from("tokens").update({ status: btn.dataset.act }).eq("id", token.id);
  if (error) return toast.error(error.message);
  await refresh();
});

els.callNext.addEventListener("click", async () => {
  const queue = activeQueue(tokens);
  const nowServing = queue.find((t) => t.status === "arrived");
  const nextToken = queue.find((t) => t.status === "booked");
  if (!nextToken) return toast.info("No one else is waiting");
  if (nowServing) await supabase.from("tokens").update({ status: "served" }).eq("id", nowServing.id);
  const { error } = await supabase.from("tokens").update({ status: "arrived" }).eq("id", nextToken.id);
  if (error) return toast.error(error.message);
  toast.success(`Token ${nextToken.token_number} called`);
  await refresh();
});

/* --- serve dialog --- */
function openServe(token) {
  serveFor = token;
  paid = true;
  document.getElementById("serve-title").textContent = `Log procurement — token ${token.token_number}`;
  document.getElementById("serve-qty").value = String(Number(token.quantity) || "");
  document.getElementById("serve-price").value = "";
  syncPaid();
  els.modal.classList.remove("hidden");
}

function closeServe() {
  serveFor = null;
  els.modal.classList.add("hidden");
}

function syncPaid() {
  document.getElementById("paid-yes").className = paid ? "btn" : "btn outline";
  document.getElementById("paid-no").className = paid ? "btn outline" : "btn";
}

document.getElementById("paid-yes").addEventListener("click", () => {
  paid = true;
  syncPaid();
});
document.getElementById("paid-no").addEventListener("click", () => {
  paid = false;
  syncPaid();
});
document.getElementById("serve-cancel").addEventListener("click", closeServe);
els.modal.addEventListener("click", (e) => {
  if (e.target === els.modal) closeServe();
});

document.getElementById("serve-save").addEventListener("click", async () => {
  if (!serveFor) return;
  const save = document.getElementById("serve-save");
  save.disabled = true;
  save.textContent = "Saving…";
  const { error } = await supabase.from("transactions").insert({
    token_id: serveFor.id,
    quantity: Number(document.getElementById("serve-qty").value) || 0,
    price: Number(document.getElementById("serve-price").value) || 0,
    payment_status: paid ? "paid" : "pending",
  });
  if (!error) await supabase.from("tokens").update({ status: "served" }).eq("id", serveFor.id);
  save.disabled = false;
  save.textContent = "Save & mark served";
  if (error) return toast.error(error.message);
  toast.success(`Token ${serveFor.token_number} served`);
  closeServe();
  await refresh();
});
