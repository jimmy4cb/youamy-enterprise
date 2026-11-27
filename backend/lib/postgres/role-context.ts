import { AsyncLocalStorage } from "node:async_hooks";
import type { AdminRole } from "../admin-auth";

type AdminDatabaseRoleContext = {
  roleName: string;
  adminUserId: number;
};

const databaseRoleNames: Record<AdminRole, string> = {
  super_admin: "yel_admin_super",
  listings_admin: "yel_admin_listings",
  orders_admin: "yel_admin_orders",
  support_agent: "yel_admin_support",
  content_editor: "yel_admin_content",
};

const roleContext = new AsyncLocalStorage<AdminDatabaseRoleContext>();

export function bindDatabaseRoleForAdmin(role: AdminRole, adminUserId: number): void {
  const roleName = databaseRoleNames[role];
  if (!roleName || !Number.isSafeInteger(adminUserId) || adminUserId < 1) {
    throw new Error("Cannot establish a database role for this admin session.");
  }
  roleContext.enterWith({ roleName, adminUserId });
}

export function getAdminDatabaseRoleContext(): AdminDatabaseRoleContext | undefined {
  return roleContext.getStore();
}
