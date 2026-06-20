"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@/lib/supabase-browser";

type SignOutButtonProps = {
  children: React.ReactNode;
};

export function SignOutButton({ children }: SignOutButtonProps) {
  const router = useRouter();
  const supabase = createBrowserClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={handleSignOut}>
      {children}
    </Button>
  );
}
