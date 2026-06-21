"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setUserRoles } from "@/lib/actions/admin-actions";
import { cn } from "@/lib/utils";
import type { AdminDict } from "@/components/admin/admin-dict";

interface Membership {
  clientDbId: string;
  clientName: string;
  availableRoles: string[];
  roles: string[];
}

interface UserView {
  id: string;
  email: string;
  username: string | null;
  admin: boolean;
  memberships: Membership[];
}

export function UsersManager({
  users,
  dict,
}: {
  users: UserView[];
  dict: AdminDict;
}) {
  const router = useRouter();

  const toggleRole = async (
    userId: string,
    membership: Membership,
    role: string,
  ) => {
    const next = membership.roles.includes(role)
      ? membership.roles.filter((r) => r !== role)
      : [...membership.roles, role];
    const result = await setUserRoles(userId, membership.clientDbId, next);
    if (result.success) {
      toast.success(dict.saved);
      router.refresh();
    } else toast.error(result.error || dict.error);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">{dict.usersTitle}</h1>
      {users.length === 0 && (
        <p className="text-sm text-muted-foreground">{dict.noUsers}</p>
      )}
      <div className="flex flex-col gap-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <p className="font-medium">{user.username ?? "—"}</p>
              {user.admin && (
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase">
                  {dict.adminBadge}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>

            {user.memberships.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {dict.noMemberships}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {user.memberships.map((m) => (
                  <div
                    key={m.clientDbId}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="text-sm w-40 truncate">
                      {m.clientName}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {m.availableRoles.map((role) => {
                        const active = m.roles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => toggleRole(user.id, m, role)}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-xs cursor-pointer transition-colors",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-accent",
                            )}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
