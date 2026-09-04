import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "Book a slot — Smart Mandi" },
      { name: "description", content: "Pick a crop, centre, date and time slot to get your mandi token." },
      { property: "og:title", content: "Book a slot — Smart Mandi" },
      { property: "og:description", content: "Reserve your procurement slot and get a token number." },
    ],
  }),
  component: BookSlot,
});

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function BookSlot() {
  const navigate = useNavigate();
  const [centreId, setCentreId] = useState<string | null>(null);
  const [commodityId, setCommodityId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: centres } = useQuery({
    queryKey: ["centres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("centres").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: commodities } = useQuery({
    queryKey: ["commodities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commodities").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: slots } = useQuery({
    queryKey: ["slots", centreId],
    enabled: !!centreId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("slots")
        .select("*")
        .eq("centre_id", centreId!)
        .order("slot_date")
        .order("time_slot");
      if (error) throw error;
      return data;
    },
  });

  const dates = useMemo(() => [...new Set((slots ?? []).map((s) => s.slot_date))], [slots]);
  const daySlots = useMemo(() => (slots ?? []).filter((s) => s.slot_date === date), [slots, date]);

  const submit = async () => {
    if (!centreId || !commodityId || !slotId) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("book_token", {
      _centre_id: centreId,
      _commodity_id: commodityId,
      _slot_id: slotId,
      _quantity: Number(quantity) || 0,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Booking failed");
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    navigate({ to: "/token/$tokenId", params: { tokenId: row.id }, search: { new: true } });
  };

  return (
    <AppShell title="Book a slot" subtitle="Four quick choices and your token is ready">
      <div className="space-y-7">
        <section>
          <span className="field-label">1. Crop</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {commodities?.map((c) => (
              <Chip key={c.id} active={commodityId === c.id} onClick={() => setCommodityId(c.id)}>
                {c.name}
                <span className="mt-0.5 block text-xs opacity-75">~{c.avg_service_time_minutes} min</span>
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <Label className="field-label" htmlFor="qty">2. Quantity (quintals)</Label>
          <Input
            id="qty"
            inputMode="decimal"
            className="h-14 text-lg"
            placeholder="e.g. 25"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </section>

        <section>
          <span className="field-label">3. Procurement centre</span>
          <div className="grid gap-2">
            {centres?.map((c) => (
              <Chip
                key={c.id}
                active={centreId === c.id}
                onClick={() => {
                  setCentreId(c.id);
                  setDate(null);
                  setSlotId(null);
                }}
              >
                {c.name}
                <span className="mt-0.5 block text-xs opacity-75">{c.location}</span>
              </Chip>
            ))}
          </div>
        </section>

        {centreId ? (
          <section>
            <span className="field-label">4. Day &amp; time</span>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDate(d);
                    setSlotId(null);
                  }}
                  className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-medium ${
                    date === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </button>
              ))}
            </div>
            {date ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {daySlots.map((s) => (
                  <Chip key={s.id} active={slotId === s.id} onClick={() => setSlotId(s.id)}>
                    {s.time_slot}
                  </Chip>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={!centreId || !commodityId || !slotId || busy}
          onClick={submit}
        >
          {busy ? "Booking…" : "Confirm booking"}
        </Button>
      </div>
    </AppShell>
  );
}
