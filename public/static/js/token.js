// token.js — replaces src/routes/_authenticated/token.$tokenId.tsx (TokenPage)
// Live queue: Supabase Realtime subscription re-fetches and re-renders (was useEffect + react-query invalidate).
import {
  supabase,
  requireAuth,
  renderShell,
  activeQueue,
  estimateWait,
  formatMinutes,
  escapeHtml,
} from "./shared.js";

const params = new URLSearchParams(window.location.search);
const tokenId = params.get("id");
const isNew = params.get("new") === "true";

const auth = await requireAuth();
if (!auth) throw new Error("not signed in");

renderShell({ title: "Your token", subtitle: "", profile: auth.profile, role: auth.role });

const view = document.getElementById("view");
let token = null;
let queue = [];
let channel = null;

async function loadToken() {
  const { data, error } = await supabase
    .from("tokens")
    .select(
      "id, token_number, token_date, status, quantity, centre_id, centres(name, location), commodities(name, avg_service_time_minutes), slots(time_slot)",
    )
    .eq("id", tokenId)
    .single();
  if (error) {
    view.innerHTML = `<p class="small muted">${escapeHtml(error.message)}</p>`;
    return false;
  }
  token = data;
  return true;
}

async function loadQueue() {
  const { data } = await supabase
    .from("tokens")
    .select("id, token_number, status")
    .eq("centre_id", token.centre_id)
    .eq("token_date", token.token_date)
    .order("token_number");
  queue = data ?? [];
}

function render() {
  const sub = document.querySelector(".page-sub");
  const subtitle = `${token.centres?.name ?? ""} · ${token.slots?.time_slot ?? ""}`;
  if (sub) sub.textContent = subtitle;
  else document.getElementById("page-head").insertAdjacentHTML("beforeend", `<p class="page-sub">${escapeHtml(subtitle)}</p>`);

  const waiting = activeQueue(queue);
  const position = waiting.findIndex((t) => t.id === token.id) + 1;
  const avg = token.commodities?.avg_service_time_minutes ?? 10;
  const wait = estimateWait(avg, position);
  const nowServing = waiting.find((t) => t.status === "arrived");
  const isDone = token.status === "served" || token.status === "no_show";
  const isCalled = token.status === "arrived";
  const closeToCall = !isDone && !isCalled && position > 0 && position <= 3;

  let banner = "";
  if (isNew) banner += `<div class="banner ok">✅ Booking confirmed. Show this token at the centre.</div>`;
  if (isCalled) {
    banner += `<div class="banner call">🔔 Your token has been called — go to the counter now.</div>`;
  } else if (closeToCall) {
    const msg =
      wait.ahead === 0
        ? "You're next — stay near the counter."
        : `Almost your turn — only ${wait.ahead} ${wait.ahead === 1 ? "farmer" : "farmers"} ahead.`;
    banner += `<div class="banner warn">🔔 ${msg}</div>`;
  }

  const stats = isDone
    ? `<div class="card center mt-4"><p class="semibold" style="font-size:1.125rem;margin:0">
         ${token.status === "served" ? "Procurement complete" : "Marked as no-show"}</p></div>`
    : `<div class="grid2 mt-4">
         <div class="card center"><p class="uppercase-label">Your position</p><p class="bold" style="font-size:2.25rem;margin:.25rem 0 0">${position || "—"}</p></div>
         <div class="card center"><p class="uppercase-label">Est. wait</p><p class="bold" style="font-size:2.25rem;margin:.25rem 0 0">${formatMinutes(wait.minutes)}</p></div>
       </div>`;

  view.innerHTML = `
    ${banner}
    <div class="card center" style="border-radius:1.5rem">
      <p class="uppercase-label">Token number</p>
      <p class="token-big">${token.token_number}</p>
      <p class="small muted mt-3">${escapeHtml(token.commodities?.name)} · ${Number(token.quantity)} quintals · ${escapeHtml(token.token_date)}</p>
    </div>
    ${stats}
    <div class="card tight mt-4" style="background:var(--muted);box-shadow:none">
      <p class="small semibold" style="margin:0">ℹ️ How we calculate your wait</p>
      <p class="small muted mt-1" style="margin-bottom:0">${escapeHtml(wait.formula)}</p>
      <p class="small muted mt-2" style="margin-bottom:0">Now serving at this centre:
        <span class="semibold" style="color:var(--foreground)">${nowServing ? `Token ${nowServing.token_number}` : "no one yet"}</span>
        · ${waiting.length} farmers still in the queue.</p>
    </div>
    <!-- SMS INTEGRATION STUB — not wired to a real provider yet. -->
    <div class="note mt-4">💬 <span class="semibold" style="color:var(--foreground)">SMS alerts (coming soon).</span>
      An SMS will be sent when 3 farmers are left ahead of you. Placeholder only — no messages are sent yet.</div>
    <a class="btn outline mt-6" href="farmer.html">Back to my bookings</a>`;
}

if (await loadToken()) {
  await loadQueue();
  render();

  // Live updates: the operator advancing the queue pushes changes straight here.
  channel = supabase
    .channel(`queue-${token.centre_id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tokens", filter: `centre_id=eq.${token.centre_id}` },
      async () => {
        await loadToken();
        await loadQueue();
        render();
      },
    )
    .subscribe();

  window.addEventListener("beforeunload", () => {
    if (channel) void supabase.removeChannel(channel);
  });
}
