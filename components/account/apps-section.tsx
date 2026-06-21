"use client";

import { useRouter } from "next/navigation";
import { AppWindow } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/account/section";
import { revokeApp } from "@/lib/actions/account-actions";
import type { AccountDict } from "@/components/account/account-dict";

interface LinkedApp {
  clientDbId: string;
  name: string;
  roles: string[];
  linkedAt: string;
}

export function AppsSection({
  apps,
  dict,
}: {
  apps: LinkedApp[];
  dict: AccountDict;
}) {
  const router = useRouter();

  const handleRevoke = async (clientDbId: string) => {
    if (!window.confirm(dict.revokeConfirm)) return;
    const result = await revokeApp(clientDbId);
    if (result.success) {
      toast.success(dict.appRevoked);
      router.refresh();
    } else {
      toast.error(result.error || dict.profileError);
    }
  };

  return (
    <Section title={dict.appsTitle} description={dict.appsDescription}>
      {apps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noApps}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {apps.map((app) => (
            <li key={app.clientDbId} className="flex items-center gap-3 py-3">
              <AppWindow className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{app.name}</p>
                <p className="text-xs text-muted-foreground">
                  {dict.rolesLabel}: {app.roles.join(", ") || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(app.clientDbId)}
                className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 cursor-pointer"
              >
                {dict.revoke}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
