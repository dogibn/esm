"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClockIcon, LogOutIcon } from "lucide-react";

import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { createBrowserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

import { strings } from "../strings";

type UserMenuProps = {
  email: string;
  role: string;
  /** Google-provided name; null for password-only accounts. */
  displayName: string | null;
  /** Google profile picture; null when unavailable or it fails to load. */
  avatarUrl: string | null;
};

// Avatar background palette, drawn from the portal's theme tokens so the
// circle never lands outside the design's colors. The pick is hashed from the
// email: "random"-looking across staff, but stable for one person.
const AVATAR_COLORS = [
  "bg-primary text-primary-foreground",
  "bg-violet text-violet-foreground",
  "bg-teal text-teal-foreground",
  "bg-success text-success-foreground",
  "bg-warning text-warning-foreground",
  "bg-info text-info-foreground",
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

// "Dolgormaa Batsaikhan" -> DB; "dolgormaa.b@esm.mn" -> DB; single-token
// names/emails fall back to the first two characters.
function initialsFor(name: string | null, email: string) {
  const source = name?.trim() || (email.split("@")[0] ?? email);
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length >= 2
      ? `${words[0]![0]}${words[1]![0]}`
      : (words[0] ?? source).slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu({
  email,
  role,
  displayName,
  avatarUrl,
}: UserMenuProps) {
  const router = useRouter();
  const supabase = createBrowserClient();
  // Google avatar URLs can 403 (rate limits, revoked photo). Drop to initials
  // rather than render a broken image.
  const [imageFailed, setImageFailed] = useState(false);

  const showImage = Boolean(avatarUrl) && !imageFailed;
  const roleLabel =
    role === "admin" ? strings.menu.roleAdmin : strings.menu.roleAccountant;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={strings.menu.trigger}
        className={cn(
          "flex size-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50",
          showImage ? "bg-muted" : colorFor(email),
        )}
      >
        {showImage ? (
          // Plain <img>: the remote avatar host varies by identity provider,
          // which next/image would need allowlisted in next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl!}
            alt=""
            width={36}
            height={36}
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          initialsFor(displayName, email)
        )}
      </MenuTrigger>
      <MenuContent className="p-0">
        <div className="border-b border-border px-3 py-2.5">
          {displayName ? (
            <p className="truncate text-sm font-medium">{displayName}</p>
          ) : null}
          <p
            className={cn(
              "truncate text-muted-foreground",
              displayName ? "text-xs" : "text-sm font-medium text-foreground",
            )}
          >
            {email}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <div className="p-1">
          <MenuItem
            className="flex-row items-center gap-2"
            onClick={() => router.push("/history")}
          >
            <ClockIcon className="size-4 text-muted-foreground" />
            {strings.menu.history}
          </MenuItem>
          <MenuItem
            className="flex-row items-center gap-2"
            onClick={handleSignOut}
          >
            <LogOutIcon className="size-4 text-muted-foreground" />
            {strings.menu.signOut}
          </MenuItem>
        </div>
      </MenuContent>
    </Menu>
  );
}
