import type { UserRole } from "./schemas";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  accountant: "Accountant",
};

export const strings = {
  page: {
    title: "Users and access",
    description:
      "Who can sign in to the portal, and what they can change. Adding an address here is the whole grant — they sign in with Google straight away.",
  },
  add: "Add user",
  empty: "No users yet.",
  you: "You",
  columns: {
    email: "Email",
    role: "Role",
    status: "Status",
    added: "Added",
    activity: "Actions logged",
    menu: "",
  },
  roles: ROLE_LABEL,
  roleHint: {
    admin: "Full access, including these setup screens and everyone's history.",
    accountant: "Day-to-day work. Cannot change setup, and sees only their own history.",
  } as Record<UserRole, string>,
  active: "Active",
  revoked: "Revoked",
  rowMenu: {
    label: "Manage access",
    makeAdmin: "Make admin",
    makeAccountant: "Make accountant",
    revoke: "Revoke access",
    restore: "Restore access",
  },
  form: {
    title: "Add user",
    email: "Email",
    emailPlaceholder: "name@esm.edu.mn",
    emailHint:
      "Must be the address they sign in with. Password sign-in additionally needs a Supabase account (pnpm provision:users); Google sign-in works immediately.",
    role: "Role",
    save: "Add user",
    saving: "Adding…",
    cancel: "Cancel",
    error: "Could not add the user. Please try again.",
  },
  confirm: {
    revokeTitle: "Revoke access?",
    revokeBody: (email: string) =>
      `${email} will be signed out on their next request and won't be able to sign back in.`,
    revokeNote: (n: number) =>
      n === 0
        ? "Their record is kept so access can be restored later."
        : `Their ${n} logged ${n === 1 ? "action stays" : "actions stay"} in History — nothing is deleted.`,
    revokeConfirm: "Revoke access",
    revokeBusy: "Revoking…",

    restoreTitle: "Restore access?",
    restoreBody: (email: string) =>
      `${email} will be able to sign in again with the role they had.`,
    restoreConfirm: "Restore access",
    restoreBusy: "Restoring…",

    roleTitle: "Change role?",
    roleBody: (email: string, role: UserRole) =>
      `${email} will become ${role === "admin" ? "an" : "a"} ${ROLE_LABEL[role].toLowerCase()}.`,
    roleNote: (role: UserRole) =>
      role === "admin"
        ? "Admins can manage users, setup screens, and undo anyone's actions."
        : "They will lose access to the setup screens, including this one.",
    roleConfirm: "Change role",
    roleBusy: "Saving…",

    cancel: "Cancel",
    error: "Could not apply the change. Please try again.",
  },
  toasts: {
    added: (email: string) => `${email} can now sign in.`,
    revoked: (email: string) => `Access revoked for ${email}.`,
    restored: (email: string) => `Access restored for ${email}.`,
    roleChanged: (email: string, role: UserRole) =>
      `${email} is now ${role === "admin" ? "an admin" : "an accountant"}.`,
  },
  errors: {
    notFound: "That user no longer exists.",
    duplicate: (email: string) => `${email} already has access.`,
    selfRevoke: "You can't revoke your own access.",
    selfDemote: "You can't remove your own admin role.",
    lastAdmin:
      "This is the last active admin. Make someone else an admin first, or nobody can manage users.",
  },
  // Summaries written to the operations log. Past tense, no trailing period —
  // they read as one line in the History table.
  audit: {
    added: (email: string, role: UserRole) =>
      `Added ${email} as ${ROLE_LABEL[role].toLowerCase()}`,
    restored: (email: string, role: UserRole) =>
      `Restored access for ${email} as ${ROLE_LABEL[role].toLowerCase()}`,
    revoked: (email: string) => `Revoked access for ${email}`,
    reactivated: (email: string) => `Restored access for ${email}`,
    roleChanged: (email: string, role: UserRole) =>
      `Changed ${email} to ${ROLE_LABEL[role].toLowerCase()}`,
    noChange: (email: string) => `Reviewed access for ${email}`,
  },
};
