import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button, ErrorNote, Panel, Shell } from "@/components/timecapsule-ui";
import { LoaderCircle } from "lucide-react";

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (data && typeof data === "object" && "error" in data) {
      return (data as { error: string }).error;
    }
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function returnPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}

function otherAuthPath(path: "/login" | "/register"): string {
  const next = returnPath();
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}

export function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
      navigate(returnPath());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <section className="mx-auto max-w-[420px] pt-10">
        <Panel>
          <h1 className="serif mb-1 text-2xl">Welcome back</h1>
          <p className="mb-6 text-sm text-[#756f66]">
            Sign in to your timecapsule account.
          </p>
          {error && <ErrorNote message={error} />}
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-[#d9d1c5] bg-[#fffdf8] px-4 py-2.5 text-sm outline-none focus:border-[#292723]"
                autoComplete="email"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-[#d9d1c5] bg-[#fffdf8] px-4 py-2.5 text-sm outline-none focus:border-[#292723]"
                autoComplete="current-password"
              />
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-[#756f66]">
            Don&apos;t have an account?{" "}
            <Link href={otherAuthPath("/register")} className="font-medium text-[#292723] underline">
              Create one
            </Link>
          </p>
        </Panel>
      </section>
    </Shell>
  );
}

export function RegisterPage() {
  const [, navigate] = useLocation();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ email, password, displayName });
      navigate(returnPath());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <section className="mx-auto max-w-[420px] pt-10">
        <Panel>
          <h1 className="serif mb-1 text-2xl">Create your account</h1>
          <p className="mb-6 text-sm text-[#756f66]">
            Sign up to save your timecapsules.
          </p>
          {error && <ErrorNote message={error} />}
          <form onSubmit={submit} className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Display name
              <input
                type="text"
                required
                maxLength={50}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl border border-[#d9d1c5] bg-[#fffdf8] px-4 py-2.5 text-sm outline-none focus:border-[#292723]"
                autoComplete="name"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-[#d9d1c5] bg-[#fffdf8] px-4 py-2.5 text-sm outline-none focus:border-[#292723]"
                autoComplete="email"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Password
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-[#d9d1c5] bg-[#fffdf8] px-4 py-2.5 text-sm outline-none focus:border-[#292723]"
                autoComplete="new-password"
              />
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-[#756f66]">
            Already have an account?{" "}
            <Link href={otherAuthPath("/login")} className="font-medium text-[#292723] underline">
              Sign in
            </Link>
          </p>
        </Panel>
      </section>
    </Shell>
  );
}
