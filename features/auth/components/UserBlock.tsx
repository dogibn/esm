"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { sidebarRailHiddenClass } from "@/components/ui/sidebar";
import { createBrowserClient } from "@/lib/supabase-browser";
import { cn } from "@/lib/utils";

import { strings } from "../strings";

type UserBlockProps = {
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

/**
 * Who you are and how to leave, at the foot of the sidebar — the one place for
 * "things about me", which is why there is no account menu in the header.
 *
 * In the rail the name and role drop away and the avatar stacks above sign-out:
 * leaving must stay reachable in every state.
 */
export function UserBlock({ email, role, displayName, avatarUrl }: UserBlockProps) {
  const router = useRouter();
  const supabase = createBrowserClient();
  // Google avatar URLs can 403 (rate limits, revoked photo). Drop to initials
  // rather than render a broken image.
  const [imageFailed, setImageFailed] = useState(false);

  const showImage = Boolean(avatarUrl) && !imageFailed;
  const roleLabel = role === "admin" ? strings.user.roleAdmin : strings.user.roleAccountant;
  const name = displayName?.trim() || email;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        "max-md:flex-col group-data-[collapsed=true]/sidebar:flex-col",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold",
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
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          initialsFor(displayName, email)
        )}
      </span>

      <span className={cn("flex min-w-0 flex-1 flex-col", sidebarRailHiddenClass)}>
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleSignOut}
        aria-label={strings.user.signOut}
        title={strings.user.signOut}
      >
        <LogOutIcon />
      </Button>
    </div>
  );
}
