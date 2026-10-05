import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { fetchAdminIdentity } from "@/lib/api/auth";
import { ACCESS_COOKIE, BrokaApiError } from "@/lib/api/client";
import type { AdminIdentity } from "@/types/broka";

export async function getAdminSession(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  try {
    return await fetchAdminIdentity(token);
  } catch (error) {
    if (error instanceof BrokaApiError) return null;
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminIdentity> {
  const admin = await getAdminSession();
  if (!admin) redirect("/login?reason=restricted");
  return admin;
}
