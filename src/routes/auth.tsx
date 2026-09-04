import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, homeForRole, type AppRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Smart Mandi" },
      { name: "description", content: "Sign in or register as a farmer, centre operator or admin." },
      { property: "og:title", content: "Sign in — Smart Mandi" },
      { property: "og:description", content: "Register to book mandi slots and track your queue." },
    ],
  }),
  component: AuthPage,
});

const COMMODITIES = ["Wheat", "Paddy", "Maize", "Mustard", "Cotton", "Soybean", "Onion", "Sugarcane"];
const ROLES: { value: AppRole; label: string; hint: string }[] = [
  { value: "farmer", label: "Farmer", hint: "Book slots" },
  { value: "operator", label: "Operator", hint: "Run a centre" },
  { value: "admin", label: "Admin", hint: "See all centres" },
];

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) navigate({ to: homeForRole(role), replace: true });
  }, [loading, session, role, navigate]);

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sprout className="size-5" />
          </span>
          <span className="text-lg font-semibold">Smart Mandi</span>
        </Link>
        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Register</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignIn />
          </TabsContent>
          <TabsContent value="signup">
            <SignUp />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) toast.error(error.message);
      }}
    >
      <div>
        <Label className="field-label" htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" required className="h-12" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label className="field-label" htmlFor="si-pass">Password</Label>
        <Input id="si-pass" type="password" required className="h-12" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="h-13 w-full text-base" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignUp() {
  const [form, setForm] = useState({ name: "", phone: "", village: "", email: "", password: "" });
  const [selectedRole, setSelectedRole] = useState<AppRole>("farmer");
  const [crops, setCrops] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="mt-5 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          setBusy(false);
          toast.error(error.message);
          return;
        }
        const userId = data.user?.id;
        if (!data.session || !userId) {
          setBusy(false);
          toast.success("Check your email to confirm your account, then sign in.");
          return;
        }
        const [{ error: pErr }, { error: rErr }] = await Promise.all([
          supabase.from("profiles").insert({
            id: userId,
            name: form.name,
            phone: form.phone,
            village: form.village,
            preferred_commodities: crops,
          }),
          supabase.from("user_roles").insert({ user_id: userId, role: selectedRole }),
        ]);
        setBusy(false);
        if (pErr || rErr) {
          toast.error(pErr?.message ?? rErr?.message ?? "Could not save your profile");
          return;
        }
        toast.success("Welcome to Smart Mandi");
        window.location.assign(homeForRole(selectedRole));
      }}
    >
      <div>
        <Label className="field-label" htmlFor="su-name">Full name</Label>
        <Input id="su-name" required className="h-12" value={form.name} onChange={set("name")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="field-label" htmlFor="su-phone">Phone</Label>
          <Input id="su-phone" inputMode="tel" className="h-12" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <Label className="field-label" htmlFor="su-village">Village</Label>
          <Input id="su-village" className="h-12" value={form.village} onChange={set("village")} />
        </div>
      </div>

      <div>
        <span className="field-label">I am a</span>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setSelectedRole(r.value)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                selectedRole === r.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span className="block text-sm font-semibold">{r.label}</span>
              <span className="block text-xs text-muted-foreground">{r.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedRole === "farmer" ? (
        <div>
          <span className="field-label">Crops I usually sell</span>
          <div className="flex flex-wrap gap-2">
            {COMMODITIES.map((c) => {
              const on = crops.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCrops((p) => (on ? p.filter((x) => x !== c) : [...p, c]))}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <Label className="field-label" htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required className="h-12" value={form.email} onChange={set("email")} />
      </div>
      <div>
        <Label className="field-label" htmlFor="su-pass">Password</Label>
        <Input id="su-pass" type="password" required minLength={6} className="h-12" value={form.password} onChange={set("password")} />
      </div>
      <Button type="submit" className="h-13 w-full text-base" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
