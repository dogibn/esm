"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

import type { UserRow } from "../api";
import type { UserRole } from "../schemas";
import { strings } from "../strings";

import { AddUserDialog } from "./AddUserDialog";

const s = strings;

// The pending change a confirm dialog is asking about. Revoking access and
// handing someone the admin role are both one-click and consequential, so
// every row action pauses here first.
type Pending =
  | { kind: "revoke"; user: UserRow }
  | { kind: "restore"; user: UserRow }
  | { kind: "role"; user: UserRow; role: UserRole };

/**
 * Users and access — admin only (the page guards it, and every route below
 * calls requireAdmin regardless).
 *
 * `currentUserId` is what makes the "You" marker and the disabled self-actions
 * possible. The server refuses self-revocation and last-admin removal anyway;
 * the UI just avoids offering a door that is locked.
 */
export function UsersView({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const activeAdmins = users.filter((u) => u.isActive && u.role === "admin").length;

  const apply = async (p: Pending) => {
    const body =
      p.kind === "role" ? { role: p.role } : { isActive: p.kind === "restore" };

    const res = await fetch(`/api/users/${p.user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(b?.error ?? `HTTP ${res.status}`);
    }

    toast({
      message:
        p.kind === "role"
          ? s.toasts.roleChanged(p.user.email, p.role)
          : p.kind === "restore"
            ? s.toasts.restored(p.user.email)
            : s.toasts.revoked(p.user.email),
      variant: "success",
    });
    router.refresh();
  };

  return (
    <PageContainer>
      <PageHeader
        title={s.page.title}
        description={s.page.description}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus />
            {s.add}
          </Button>
        }
      />

      <Card size="sm">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{s.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.columns.email}</TableHead>
                  <TableHead>{s.columns.role}</TableHead>
                  <TableHead>{s.columns.status}</TableHead>
                  <TableHead className="text-right">{s.columns.activity}</TableHead>
                  <TableHead>{s.columns.added}</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <UserRowCells
                    key={u.id}
                    user={u}
                    isSelf={u.id === currentUserId}
                    isLastAdmin={
                      u.isActive && u.role === "admin" && activeAdmins <= 1
                    }
                    onAction={setPending}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddUserDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={(email) => {
          toast({ message: s.toasts.added(email), variant: "success" });
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        title={confirmTitle(pending)}
        body={confirmBody(pending)}
        note={confirmNote(pending)}
        confirmLabel={confirmLabel(pending)}
        busyLabel={confirmBusy(pending)}
        cancelLabel={s.confirm.cancel}
        errorLabel={s.confirm.error}
        destructive={pending?.kind === "revoke"}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={async () => {
          if (pending) await apply(pending);
        }}
      />
    </PageContainer>
  );
}

function UserRowCells({
  user,
  isSelf,
  isLastAdmin,
  onAction,
}: {
  user: UserRow;
  isSelf: boolean;
  isLastAdmin: boolean;
  onAction: (p: Pending) => void;
}) {
  // Losing the last active admin locks everyone out of these screens, and an
  // admin demoting or revoking themselves does the same by a shorter route.
  const lockedOut = isSelf || isLastAdmin;
  const nextRole: UserRole = user.role === "admin" ? "accountant" : "admin";
  const demoting = nextRole === "accountant";

  return (
    <TableRow className={user.isActive ? "" : "opacity-60"}>
      <TableCell className="font-medium">
        {user.email}
        {isSelf ? (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {s.you}
          </span>
        ) : null}
      </TableCell>
      <TableCell>{s.roles[user.role]}</TableCell>
      <TableCell>
        <Badge variant={user.isActive ? "default" : "secondary"}>
          {user.isActive ? s.active : s.revoked}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {user.operationCount}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(user.createdAt)}
      </TableCell>
      <TableCell className="text-right">
        <Menu>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${s.rowMenu.label} — ${user.email}`}
              >
                <MoreHorizontal />
              </Button>
            }
          />
          <MenuContent>
            <MenuItem
              disabled={demoting && lockedOut}
              onClick={() => onAction({ kind: "role", user, role: nextRole })}
            >
              <span className="font-medium">
                {user.role === "admin"
                  ? s.rowMenu.makeAccountant
                  : s.rowMenu.makeAdmin}
              </span>
              <span className="text-xs text-muted-foreground">
                {s.roleHint[nextRole]}
              </span>
            </MenuItem>
            {user.isActive ? (
              <MenuItem
                disabled={lockedOut}
                className="text-destructive"
                onClick={() => onAction({ kind: "revoke", user })}
              >
                <span className="font-medium">{s.rowMenu.revoke}</span>
              </MenuItem>
            ) : (
              <MenuItem onClick={() => onAction({ kind: "restore", user })}>
                <span className="font-medium">{s.rowMenu.restore}</span>
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      </TableCell>
    </TableRow>
  );
}

// The ConfirmDialog stays mounted so it can animate out, which means these
// read `pending` after it clears. Empty strings render nothing visible on a
// dialog that is already closing.
function confirmTitle(p: Pending | null): string {
  if (!p) return "";
  if (p.kind === "revoke") return s.confirm.revokeTitle;
  if (p.kind === "restore") return s.confirm.restoreTitle;
  return s.confirm.roleTitle;
}

function confirmBody(p: Pending | null): string {
  if (!p) return "";
  if (p.kind === "revoke") return s.confirm.revokeBody(p.user.email);
  if (p.kind === "restore") return s.confirm.restoreBody(p.user.email);
  return s.confirm.roleBody(p.user.email, p.role);
}

function confirmNote(p: Pending | null): string | null {
  if (!p) return null;
  if (p.kind === "revoke") return s.confirm.revokeNote(p.user.operationCount);
  if (p.kind === "role") return s.confirm.roleNote(p.role);
  return null;
}

function confirmLabel(p: Pending | null): string {
  if (!p) return "";
  if (p.kind === "revoke") return s.confirm.revokeConfirm;
  if (p.kind === "restore") return s.confirm.restoreConfirm;
  return s.confirm.roleConfirm;
}

function confirmBusy(p: Pending | null): string {
  if (!p) return "";
  if (p.kind === "revoke") return s.confirm.revokeBusy;
  if (p.kind === "restore") return s.confirm.restoreBusy;
  return s.confirm.roleBusy;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
