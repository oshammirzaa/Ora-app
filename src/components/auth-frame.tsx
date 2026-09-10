import { Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { OraMark } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-[430px] bg-bg px-4 py-10 text-fg">
      <div className="mx-auto w-full max-w-sm space-y-6">
        <OraMark />
        <div>
          <h1 className="font-display text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
        <Link to="/" className="block text-sm text-faint hover:text-fg">
          Back to advisors
        </Link>
      </div>
    </main>
  );
}

export function SocialSignIn({ callbackURL = "/me" }: { callbackURL?: string }) {
  return (
    <div className="space-y-2">
      {GROK_PROVIDERS.map((p) => (
        <Button
          key={p.providerId}
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => signIn(p.providerId, { callbackURL })}
        >
          Continue with {p.label}
        </Button>
      ))}
    </div>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minLength={8}
          required
          autoComplete={autoComplete}
          className="pr-11"
        />
        <button
          type="button"
          className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center text-faint hover:text-fg"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}
