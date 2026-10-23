import { HugeiconsIcon } from "@hugeicons/react";
import { GroupLayersIcon } from "@hugeicons/core-free-icons";

import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <HugeiconsIcon
            icon={GroupLayersIcon}
            className="size-5 text-muted-foreground"
          />
          <div>
            <h1 className="text-sm font-semibold">Складка</h1>
            <p className="text-xs text-muted-foreground">
              групування товарів
            </p>
          </div>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
