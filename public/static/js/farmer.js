// farmer.js — replaces src/routes/_authenticated/farmer.tsx (FarmerHome)
import { supabase, requireAuth, renderShell, escapeHtml, renderVerificationBanner, toast } from "./shared.js";

const auth = await requireAuth();
if (auth) {
  const first = auth.profile?.name ? `, ${auth.profile.name.split(" ")[0]}` : "";
  renderShell({
    title: `Namaste${first}`,
    subtitle: auth.profile?.village || "Book a slot at your procurement centre",
    profile: auth.profile,
    role: auth.role,
  });
  const verified = renderVerificationBanner(auth.profile);
  if (!verified) {
    const cta = document.getElementById("book-cta");
    cta.removeAttribute("href");
    cta.setAttribute("aria-disabled", "true");
    cta.style.opacity = ".55";
    cta.addEventListener("click", (e) => {
      e.preventDefault();
      toast.error("Booking unlocks once an admin verifies your farmer details.");
    });
  }
  await renderTokens(auth.user.id);
}


const STATUS_LABEL = { booked: "Waiting", arrived: "Called", served: "Served", no_show: "Missed" };

async function renderTokens(userId) {
  const box = document.getElementById("tokens");
  const { data, error } = await supabase
    .from("tokens")
    .select(
      "id, token_number, token_date, status, quantity, centres(name, location), commodities(name), slots(time_slot)",
    )
    .eq("farmer_id", userId)
    .order("token_date", { ascending: false })
    .order("token_number", { ascending: true });

  if (error) {
    box.innerHTML = `<p class="small muted">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    box.innerHTML = `<div class="dashed">No bookings yet. Book your first slot above.</div>`;
    return;
  }
  box.innerHTML = data
    .map(
      (t) => `
      <a class="card tight row" style="margin-bottom:.75rem" href="token.html?id=${encodeURIComponent(t.id)}">
        <div class="token-square" style="flex-direction:column">
          <span class="xs semibold" style="text-transform:uppercase">Token</span>
          <span style="font-size:1.25rem;line-height:1">${t.token_number}</span>
        </div>
        <div class="grow">
          <p class="semibold truncate" style="margin:0">${escapeHtml(t.centres?.name)}</p>
          <p class="small muted truncate" style="margin:.15rem 0 0">
            ${escapeHtml(t.commodities?.name)} · ${escapeHtml(t.token_date)} · ${escapeHtml(t.slots?.time_slot)}
          </p>
          <p class="xs muted truncate" style="margin:.15rem 0 0">📍 ${escapeHtml(t.centres?.location)}</p>
        </div>
        <span class="badge ${t.status === "served" ? "" : "on"}">${STATUS_LABEL[t.status] ?? t.status}</span>
      </a>`,
    )
    .join("");
}
