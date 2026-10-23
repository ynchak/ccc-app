import { LoginForm } from "@/components/auth/login-form";
import { BrandMark } from "@/components/brand-mark";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <BrandMark className="size-5" />
          <div>
            <h1 className="text-sm font-semibold">Akin</h1>
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
