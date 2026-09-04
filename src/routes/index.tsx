import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ClipboardList, LineChart, Sprout } from "lucide-react";
import { useAuth, homeForRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Mandi — Book your mandi slot, skip the queue" },
      {
        name: "description",
        content:
          "Farmers book a procurement slot, get a token number and watch their live queue position. Operators run the day's queue, admins track every centre.",
      },
      { property: "og:title", content: "Smart Mandi — Book your mandi slot, skip the queue" },
      {
        property: "og:description",
        content: "Slot booking, token numbers and a live queue for agricultural procurement centres.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: ClipboardList, title: "Book a slot", text: "Pick your crop, centre, day and time. Get a token instantly." },
  { icon: Clock, title: "Live queue", text: "See your position and wait time update as the queue moves." },
  { icon: LineChart, title: "Centre insight", text: "Operators call the next token; admins see every centre." },
];

function Landing() {
  const { session, role, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-12">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sprout className="size-7" />
        </span>
        <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          Know your turn before you leave the village.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Smart Mandi gives every farmer a booked slot, a token number and a live queue position at
          their procurement centre — so nobody waits all day for their turn.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {session ? (
            <Button asChild size="lg" className="h-13 px-7 text-base">
              <Link to={homeForRole(role)}>Open my dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="h-13 px-7 text-base" disabled={loading}>
              <Link to="/auth">Get started</Link>
            </Button>
          )}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
