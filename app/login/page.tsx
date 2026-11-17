"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { withBasePath } from "@/lib/base-path";
import { AlertCircle, KeyRound, Loader2, UserRound } from "lucide-react";
import { pulpAuthService } from "@/services/pulp/auth-service";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/cn";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    let active = true;

    async function check() {
      const sessionUser = await pulpAuthService.getSessionUser();
      if (active && sessionUser) {
        router.replace(nextPath);
      }
    }

    void check();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await pulpAuthService.login(username, password);
    if (!result.ok) {
      setError(result.detail);
      setIsLoading(false);
      return;
    }

    router.replace(nextPath);
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(24,24,27,0.08),transparent)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(255,255,255,0.06),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-zinc-300/25 blur-3xl dark:bg-zinc-600/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-zinc-400/20 blur-3xl dark:bg-zinc-500/10"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:px-6">
        <div className="w-full max-w-[420px]">
          <header className="mb-10 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <Image
                src={withBasePath("/pulp_logo_icon.svg")}
                alt="Pulp"
                width={56}
                height={47}
                className="h-11 w-auto"
                priority
              />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Pulp Admin — use your Pulp account credentials
            </p>
          </header>

          <section
            className={cn(
              "rounded-2xl border border-zinc-200/80 bg-white/90 p-8 shadow-xl shadow-zinc-950/5 backdrop-blur-md",
              "dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-black/20"
            )}
          >
            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              <FormField
                label={<span className="font-medium text-zinc-700 dark:text-zinc-300">Username</span>}
                className="gap-2"
              >
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                    aria-hidden
                  />
                  <Input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    required
                    className={cn(
                      "w-full border-zinc-200 bg-zinc-50/80 py-2.5 pl-10 pr-3 transition-colors",
                      "placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400/20",
                      "dark:border-zinc-700 dark:bg-zinc-950/50 dark:focus:border-zinc-500 dark:focus:bg-zinc-950 dark:focus:ring-zinc-500/20"
                    )}
                    placeholder="username"
                  />
                </div>
              </FormField>

              <FormField
                label={<span className="font-medium text-zinc-700 dark:text-zinc-300">Password</span>}
                className="gap-2"
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                    aria-hidden
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    className={cn(
                      "w-full border-zinc-200 bg-zinc-50/80 py-2.5 pl-10 pr-3 transition-colors",
                      "placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400/20",
                      "dark:border-zinc-700 dark:bg-zinc-950/50 dark:focus:border-zinc-500 dark:focus:bg-zinc-950 dark:focus:ring-zinc-500/20"
                    )}
                    placeholder="••••••••"
                  />
                </div>
              </FormField>

              <Button
                type="submit"
                disabled={isLoading}
                className="mt-1 w-full justify-center py-2.5 text-sm font-medium"
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Signing in…
                  </span>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>

            {error ? (
              <div
                role="alert"
                className={cn(
                  "mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800",
                  "dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
                )}
              >
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
                <p className="leading-snug">{error}</p>
              </div>
            ) : null}
          </section>

          <p className="mt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Session is stored in a secure cookie after login.
          </p>
        </div>
      </div>
    </main>
  );
}
