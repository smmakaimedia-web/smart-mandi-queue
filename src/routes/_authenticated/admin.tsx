import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BUFFER_MINUTES, todayISO } from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "All centres — Smart Mandi" },
      { name: "description", content: "Today's tokens, farmers served and average wait time across every procurement centre." },
      { property: "og:title", content: "All centres — Smart Mandi" },
      { property: "og:description", content: "Cross-centre procurement overview for administrators." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const today = todayISO();

  const { data } = useQuery({
    queryKey: ["admin-overview", today],
    queryFn: async () => {
      const [{ data: centres, error: cErr }, { data: tokens, error: tErr }] = await Promise.all([
        supabase.from("centres").select("id, name, location").order("name"),
        supabase
          .from("tokens")
          .select("id, centre_id, status, commodities(avg_service_time_minutes)")
          .eq("token_date", today),
      ]);
      if (cErr) throw cErr;
      if (tErr) throw tErr;
      return { centres: centres ?? [], tokens: tokens ?? [] };
    },
  });

  const rows = (data?.centres ?? []).map((c) => {
    const list = (data?.tokens ?? []).filter((t) => t.centre_id === c.id);
    const served = list.filter((t) => t.status === "served").length;
    const waiting = list.filter((t) => t.status === "booked" || t.status === "arrived").length;
    const avgService =
      list.length === 0
        ? 0
        : list.reduce((s, t) => s + (t.commodities?.avg_service_time_minutes ?? 10), 0) / list.length;
    const avgWait = Math.round((avgService * Math.max(waiting - 1, 0)) / 2 + BUFFER_MINUTES);
    return { name: c.name, location: c.location, booked: list.length, served, waiting, avgWait };
  });

  const totals = rows.reduce(
    (a, r) => ({ booked: a.booked + r.booked, served: a.served + r.served, waiting: a.waiting + r.waiting }),
    { booked: 0, served: 0, waiting: 0 },
  );

  return (
    <AppShell title="All centres today" subtitle={today}>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Tokens booked", value: totals.booked },
          { label: "Farmers served", value: totals.served },
          { label: "Still waiting", value: totals.waiting },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center shadow-soft">
            <p className="text-3xl font-bold text-primary">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <h2 className="mb-3 text-lg font-semibold">Activity per centre</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} tickFormatter={(v: string) => v.split(" ")[0]!} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="booked" name="Booked" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="served" name="Served" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Centre breakdown</h2>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.name} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="font-semibold">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.location}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold">{r.booked}</p>
                <p className="text-xs text-muted-foreground">booked</p>
              </div>
              <div>
                <p className="text-xl font-bold">{r.served}</p>
                <p className="text-xs text-muted-foreground">served</p>
              </div>
              <div>
                <p className="text-xl font-bold">{r.avgWait} min</p>
                <p className="text-xs text-muted-foreground">avg wait</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
