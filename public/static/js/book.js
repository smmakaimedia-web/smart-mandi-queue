// book.js — replaces src/routes/_authenticated/book.tsx (BookSlot + Chip)
import { supabase, requireAuth, renderShell, toast } from "./shared.js";

const auth = await requireAuth();
if (!auth) throw new Error("not signed in");

renderShell({
  title: "Book a slot",
  subtitle: "Four quick choices and your token is ready",
  profile: auth.profile,
  role: auth.role,
});

// state (useState replacement)
const state = { centreId: null, commodityId: null, date: null, slotId: null, slots: [], busy: false };

const els = {
  commodities: document.getElementById("commodities"),
  centres: document.getElementById("centres"),
  when: document.getElementById("when"),
  dates: document.getElementById("dates"),
  slots: document.getElementById("slots"),
  qty: document.getElementById("qty"),
  confirm: document.getElementById("confirm"),
};

function chip(label, sub, active, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.setAttribute("aria-pressed", String(active));
  b.innerHTML = sub ? `${label}<span class="sub">${sub}</span>` : label;
  b.addEventListener("click", onClick);
  return b;
}

function syncConfirm() {
  els.confirm.disabled = !(state.centreId && state.commodityId && state.slotId) || state.busy;
}

/* --- crops --- */
const { data: commodities } = await supabase.from("commodities").select("*").order("name");
(commodities ?? []).forEach((c) => {
  els.commodities.appendChild(
    chip(c.name, `~${c.avg_service_time_minutes} min`, false, () => {
      state.commodityId = c.id;
      [...els.commodities.children].forEach((b, i) =>
        b.setAttribute("aria-pressed", String(commodities[i].id === c.id)),
      );
      syncConfirm();
    }),
  );
});

/* --- centres --- */
const { data: centres } = await supabase.from("centres").select("*").order("name");
(centres ?? []).forEach((c) => {
  els.centres.appendChild(
    chip(c.name, c.location, false, async () => {
      state.centreId = c.id;
      state.date = null;
      state.slotId = null;
      [...els.centres.children].forEach((b, i) => b.setAttribute("aria-pressed", String(centres[i].id === c.id)));
      await loadSlots();
      syncConfirm();
    }),
  );
});

/* --- slots --- */
async function loadSlots() {
  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("centre_id", state.centreId)
    .order("slot_date")
    .order("time_slot");
  if (error) return toast.error(error.message);
  state.slots = data ?? [];
  renderDates();
}

function renderDates() {
  els.when.classList.remove("hidden");
  els.dates.innerHTML = "";
  els.slots.innerHTML = "";
  const dates = [...new Set(state.slots.map((s) => s.slot_date))];
  dates.forEach((d) => {
    const label = new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    els.dates.appendChild(
      chip(label, null, false, () => {
        state.date = d;
        state.slotId = null;
        [...els.dates.children].forEach((b, i) => b.setAttribute("aria-pressed", String(dates[i] === d)));
        renderSlots();
        syncConfirm();
      }),
    );
  });
}

function renderSlots() {
  els.slots.innerHTML = "";
  const daySlots = state.slots.filter((s) => s.slot_date === state.date);
  daySlots.forEach((s) => {
    els.slots.appendChild(
      chip(s.time_slot, null, false, () => {
        state.slotId = s.id;
        [...els.slots.children].forEach((b, i) => b.setAttribute("aria-pressed", String(daySlots[i].id === s.id)));
        syncConfirm();
      }),
    );
  });
}

/* --- confirm booking (book_token RPC, unchanged) --- */
els.confirm.addEventListener("click", async () => {
  if (!state.centreId || !state.commodityId || !state.slotId) return;
  state.busy = true;
  els.confirm.disabled = true;
  els.confirm.textContent = "Booking…";
  const { data, error } = await supabase.rpc("book_token", {
    _centre_id: state.centreId,
    _commodity_id: state.commodityId,
    _slot_id: state.slotId,
    _quantity: Number(els.qty.value) || 0,
  });
  state.busy = false;
  els.confirm.textContent = "Confirm booking";
  syncConfirm();
  if (error || !data) return toast.error(error?.message ?? "Booking failed");
  const row = Array.isArray(data) ? data[0] : data;
  window.location.assign(`token.html?id=${encodeURIComponent(row.id)}&new=true`);
});
