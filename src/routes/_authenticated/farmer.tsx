import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, ChevronRight, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/farmer")({
  head: () => ({
    meta: [
      { title: "My bookings — Smart Mandi" },
      { name: "description", content: "Your mandi slot bookings, token numbers and live queue links." },
      { property: "og:title", content: "My bookings — Smart Mandi" },
      { property: "og:description", content: "Track your procurement tokens and queue position." },
    ],
  }),
  component: FarmerHome,
});

const STATUS_LABEL: Record<string, string> = {
  booked: "Waiting",
  arrived: "Called",
  served: "Served",
  no_show: "Missed",
};

function FarmerHome() {
  const { user, profile } = useAuth();

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["my-tokens", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, token_number, token_date, status, quantity, centres(name, location), commodities(name), slots(time_slot)")
        .eq("farmer_id", user!.id)
        .order("token_date", { ascending: false })
        .order("token_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell
      title={`Namaste${profile?.name ? `, ${profile.name.split(" ")[0]}` : ""}`}
      subtitle={profile?.village ? `${profile.village}` : "Book a slot at your procurement centre"}
    >
      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link to="/book">
          <CalendarPlus className="size-5" /> Book a new slot
        </Link>
      </Button>

      <h2 className="mt-8 mb-3 text-lg font-semibold">My tokens</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !tokens?.length ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No bookings yet. Book your first slot above.
        </div>
      ) : (
        <ul className="space-y-3">
          {tokens.map((t) => (
            <li key={t.id}>
              <Link
                to="/token/$tokenId"
                params={{ tokenId: t.id }}
                search={{ new: false }}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:bg-muted/60"
              >
                <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <span className="text-[10px] font-semibold uppercase">Token</span>
                  <span className="text-xl leading-none font-bold">{t.token_number}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.centres?.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {t.commodities?.name} · {t.token_date} · {t.slots?.time_slot}
                  </p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {t.centres?.location}
                  </p>
                </div>
                <Badge variant={t.status === "served" ? "secondary" : "default"}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </Badge>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
