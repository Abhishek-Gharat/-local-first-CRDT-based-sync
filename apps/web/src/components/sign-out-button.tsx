"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      <LogOut aria-hidden />
      <span className="hidden sm:inline">Sign out</span>
      <span className="sr-only sm:hidden">Sign out</span>
    </Button>
  );
}
