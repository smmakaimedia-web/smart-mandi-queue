// landing.js — replaces src/routes/index.tsx
import { getSession, loadProfileAndRole, homeForRole, renderFooter } from "./shared.js";

renderFooter();

const cta = document.getElementById("cta");
const session = await getSession();
if (session) {
  const { role } = await loadProfileAndRole(session.user.id);
  cta.textContent = "Open my dashboard";
  cta.href = homeForRole(role);
}
