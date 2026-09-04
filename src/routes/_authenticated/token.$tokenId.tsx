import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { BellRing, CheckCircle2, Info, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { activeQueue, estimateWait, formatMinutes } from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/token/$tokenId")({
  validateSearch: (search: Record<string, unknown>) => ({ new: search['new'] === true || search['new'] === "true" }),
  head: () => ({
    meta: [
      { title: "My token — Smart Mandi" },
      { name: "description", content: "Live queue position and estimated wait time for your mandi token." },
      { property: "og:title", content: "My token — Smart Mandi" },
      { property: "og:description", content: "Watch your queue position update live." },
    ],
  }),
  component: TokenPage,
});

function TokenPage() {
  const { tokenId } = Route.useParams();
  const { new: isNew } = Route.useSearch();
  const queryClient = useQueryClient();

  const { data: token } = useQuery({
    queryKey: ["token", tokenId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select(
          "id, token_number, token_date, status, quantity, centre_id, centres(name, location), commodities(name, avg_service_time_minutes), slots(time_slot)",
        )
        .eq("id", tokenId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const centreId = token?.centre_id;
  const tokenDate = token?.token_date;

  const { data: queue } = useQuery({
    queryKey: ["queue", centreId, tokenDate],
    enabled: !!centreId && !!tokenDate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, token_number, status")
        .eq("centre_id", centreId!)
        .eq("token_date", tokenDate!)
        .order("token_number");
      if (error) throw error;
      return data;
    },
  });

  // Live updates: the operator advancing the queue pushes changes straight here.
  useEffect(() => {
    if (!centreId) return;
    const channel = supabase
      .channel(`queue-${centreId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tokens", filter: `centre_id=eq.${centreId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["queue", centreId, tokenDate] });
          void queryClient.invalidateQueries({ queryKey: ["token", tokenId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [centreId, tokenDate, tokenId, queryClient]);

  if (!token) {
    return (
      <AppShell title="Your token">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  const waiting = activeQueue(queue ?? []);
  const idx = waiting.findIndex((t) => t.id === token.id);
  const position = idx + 1;
  const avg = token.commodities?.avg_service_time_minutes ?? 10;
  const wait = estimateWait(avg, position);
  const nowServing = waiting.find((t) => t.status === "arrived");
  const isDone = token.status === "served" || token.status === "no_show";
  const isCalled = token.status === "arrived";
  const closeToCall = !isDone && !isCalled && position > 0 && position <= 3;

  return (
    <AppShell title="Your token" subtitle={`${token.centres?.name} · ${token.slots?.time_slot}`}>
      {isNew ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm font-medium text-primary">
          <CheckCircle2 className="size-5" /> Booking confirmed. Show this token at the centre.
        </div>
      ) : null}

      {isCalled ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-accent p-4 text-accent-foreground">
          <BellRing className="size-6" />
          <p className="font-semibold">Your token has been called — go to the counter now.</p>
        </div>
      ) : closeToCall ? (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-warning p-4 text-warning-foreground">
          <BellRing className="size-6" />
          <p className="font-semibold">
            Almost your turn — only {wait.ahead} {wait.ahead === 1 ? "farmer" : "farmers"} ahead.
          </p>
        </div>
      ) : null}

      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Token number</p>
        <p className="mt-1 text-7xl leading-none font-bold text-primary">{token.token_number}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {token.commodities?.name} · {Number(token.quantity)} quintals · {token.token_date}
        </p>
      </div>

      {isDone ? (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-lg font-semibold">
            {token.status === "served" ? "Procurement complete" : "Marked as no-show"}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Your position</p>
            <p className="mt-1 text-4xl font-bold">{position || "—"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Est. wait</p>
            <p className="mt-1 text-4xl font-bold">{formatMinutes(wait.minutes)}</p>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Info className="size-4" /> How we calculate your wait
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{wait.formula}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Now serving at this centre: <span className="font-semibold text-foreground">
            {nowServing ? `Token ${nowServing.token_number}` : "no one yet"}
          </span>{" "}
          · {waiting.length} farmers still in the queue.
        </p>
      </div>

      {/* SMS INTEGRATION STUB — not wired to a real provider yet. */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <MessageSquare className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold text-foreground">SMS alerts (coming soon).</span> An SMS
          will be sent when 3 farmers are left ahead of you. Placeholder only — no messages are sent
          yet.
        </p>
      </div>

      <Button asChild variant="outline" className="mt-6 h-12 w-full">
        <Link to="/farmer">Back to my bookings</Link>
      </Button>
    </AppShell>
  );
}
