import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { activeQueue, todayISO } from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/operator")({
  head: () => ({
    meta: [
      { title: "Centre queue — Smart Mandi" },
      { name: "description", content: "Run today's procurement queue: call the next token, mark arrivals and log payments." },
      { property: "og:title", content: "Centre queue — Smart Mandi" },
      { property: "og:description", content: "Operator dashboard for a procurement centre." },
    ],
  }),
  component: OperatorDashboard,
});

type Row = {
  id: string;
  token_number: number;
  status: "booked" | "arrived" | "served" | "no_show";
  quantity: number;
  farmer_id: string;
  commodities: { name: string } | null;
  slots: { time_slot: string } | null;
};

const STATUS: Record<string, string> = {
  booked: "Waiting",
  arrived: "At counter",
  served: "Served",
  no_show: "No-show",
};

function OperatorDashboard() {
  const queryClient = useQueryClient();
  const [centreId, setCentreId] = useState<string | undefined>();
  const [serveFor, setServeFor] = useState<Row | null>(null);
  const today = todayISO();

  const { data: centres } = useQuery({
    queryKey: ["centres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("centres").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!centreId && centres?.length) setCentreId(centres[0]!.id);
  }, [centres, centreId]);

  const { data: tokens } = useQuery({
    queryKey: ["op-queue", centreId, today],
    enabled: !!centreId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tokens")
        .select("id, token_number, status, quantity, farmer_id, commodities(name), slots(time_slot)")
        .eq("centre_id", centreId!)
        .eq("token_date", today)
        .order("token_number");
      if (error) throw error;
      return data as Row[];
    },
  });

  const { data: farmers } = useQuery({
    queryKey: ["op-farmers", tokens?.map((t) => t.farmer_id).join(",")],
    enabled: !!tokens?.length,
    queryFn: async () => {
      const ids = [...new Set(tokens!.map((t) => t.farmer_id))];
      const { data, error } = await supabase.from("profiles").select("id, name, phone, village").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p]));
    },
  });

  useEffect(() => {
    if (!centreId) return;
    const channel = supabase
      .channel(`op-queue-${centreId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tokens", filter: `centre_id=eq.${centreId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["op-queue", centreId, today] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [centreId, today, queryClient]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["op-queue", centreId, today] });

  const setStatus = async (id: string, status: Row["status"]) => {
    const { error } = await supabase.from("tokens").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void refresh();
  };

  const queue = activeQueue(tokens ?? []);
  const nowServing = queue.find((t) => t.status === "arrived");
  const nextToken = queue.find((t) => t.status === "booked");

  const callNext = async () => {
    if (!nextToken) {
      toast.info("No one else is waiting");
      return;
    }
    if (nowServing) await supabase.from("tokens").update({ status: "served" }).eq("id", nowServing.id);
    const { error } = await supabase.from("tokens").update({ status: "arrived" }).eq("id", nextToken.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Token ${nextToken.token_number} called`);
    void refresh();
  };

  return (
    <AppShell title="Today's queue" subtitle={today}>
      <Select value={centreId ?? ""} onValueChange={setCentreId}>
        <SelectTrigger className="h-12 w-full">
          <SelectValue placeholder="Choose your centre" />
        </SelectTrigger>
        <SelectContent>
          {centres?.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Now serving</p>
        <p className="text-5xl font-bold text-primary">{nowServing ? nowServing.token_number : "—"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {queue.length} in queue · next up {nextToken ? `token ${nextToken.token_number}` : "none"}
        </p>
        <Button className="mt-4 h-14 w-full text-base" onClick={callNext} disabled={!nextToken}>
          <PhoneCall className="size-5" /> Call next token
        </Button>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Booked tokens</h2>
      {!tokens?.length ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No bookings for today at this centre.
        </p>
      ) : (
        <ul className="space-y-3">
          {tokens.map((t) => (
            <li key={t.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                  {t.token_number}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{farmers?.[t.farmer_id]?.name ?? "Farmer"}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {t.commodities?.name} · {Number(t.quantity)} qtl · {t.slots?.time_slot}
                  </p>
                  {farmers?.[t.farmer_id]?.village ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {farmers[t.farmer_id]!.village} · {farmers[t.farmer_id]!.phone}
                    </p>
                  ) : null}
                </div>
                <Badge variant={t.status === "arrived" ? "default" : "secondary"}>{STATUS[t.status]}</Badge>
              </div>
              {t.status === "served" || t.status === "no_show" ? null : (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button variant="outline" className="h-11" onClick={() => setStatus(t.id, "arrived")}>
                    <BellRing className="size-4" /> Arrived
                  </Button>
                  <Button className="h-11" onClick={() => setServeFor(t)}>
                    Serve
                  </Button>
                  <Button variant="outline" className="h-11" onClick={() => setStatus(t.id, "no_show")}>
                    No-show
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ServeDialog token={serveFor} onClose={() => setServeFor(null)} onDone={refresh} />
    </AppShell>
  );
}

function ServeDialog({
  token,
  onClose,
  onDone,
}: {
  token: Row | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [paid, setPaid] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (token) {
      setQuantity(String(Number(token.quantity) || ""));
      setPrice("");
      setPaid(true);
    }
  }, [token]);

  const save = async () => {
    if (!token) return;
    setBusy(true);
    const { error } = await supabase.from("transactions").insert({
      token_id: token.id,
      quantity: Number(quantity) || 0,
      price: Number(price) || 0,
      payment_status: paid ? "paid" : "pending",
    });
    if (!error) await supabase.from("tokens").update({ status: "served" }).eq("id", token.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Token ${token.token_number} served`);
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!token} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log procurement — token {token?.token_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="field-label" htmlFor="q">Quantity received (quintals)</Label>
            <Input id="q" inputMode="decimal" className="h-12" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <Label className="field-label" htmlFor="p">Total price (₹)</Label>
            <Input id="p" inputMode="decimal" className="h-12" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={paid ? "default" : "outline"} className="h-12" onClick={() => setPaid(true)}>
              Paid
            </Button>
            <Button variant={paid ? "outline" : "default"} className="h-12" onClick={() => setPaid(false)}>
              Payment pending
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button className="h-12 w-full" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save & mark served"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
