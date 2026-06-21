"use client";

import { useRouter } from "next/navigation";
import { Monitor } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/account/section";
import { revokeUserSession } from "@/lib/actions/account-actions";
import type { AccountDict } from "@/components/account/account-dict";
import { LocalDate } from "@/components/local-date";

interface SessionInfo {
  id: string;
  isCurrent: boolean;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export function SessionsSection({
  sessions,
  dict,
}: {
  sessions: SessionInfo[];
  dict: AccountDict;
}) {
  const router = useRouter();

  const handleRevoke = async (id: string) => {
    const result = await revokeUserSession(id);
    if (result.success) {
      toast.success(dict.sessionRevoked);
      router.refresh();
    } else {
      toast.error(result.error || dict.profileError);
    }
  };

  return (
    <Section title={dict.sessionsTitle} description={dict.sessionsDescription}>
      <ul className="flex flex-col divide-y divide-border">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-3">
            <Monitor className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {s.userAgent || dict.unknownDevice}
                {s.isCurrent && (
                  <span className="ml-2 text-[11px] font-medium text-primary">
                    {dict.currentSession}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {dict.created} <LocalDate date={s.createdAt} showTime />
              </p>
            </div>
            {!s.isCurrent && (
              <button
                type="button"
                onClick={() => handleRevoke(s.id)}
                className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 cursor-pointer"
              >
                {dict.revoke}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
