"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";

/** Выход: очищает серверную сессию и возвращает на страницу входа. */
export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => void handleLogout()}
      disabled={isPending}
      aria-label="Выйти"
      title="Выйти"
    >
      <HugeiconsIcon icon={Logout01Icon} />
    </Button>
  );
}
