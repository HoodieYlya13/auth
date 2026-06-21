"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/actions/account-actions";
import { Section } from "@/components/account/section";
import type { AccountDict } from "@/components/account/account-dict";

interface ProfileValues {
  username: string;
  firstName: string;
  lastName: string;
  birthday: string;
}

export function ProfileSection({
  initial,
  dict,
}: {
  initial: ProfileValues;
  dict: AccountDict;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileValues>(initial);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof ProfileValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await updateProfile(values);
    if (result.success) {
      toast.success(dict.profileSaved);
      router.refresh();
    } else toast.error(result.error || dict.profileError);
    setBusy(false);
  };

  return (
    <Section title={dict.profileTitle} description={dict.profileDescription}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Labelled label={dict.usernameLabel}>
          <Input
            value={values.username}
            onChange={(e) => set("username")(e.target.value)}
            className="h-9 bg-background/50"
            minLength={3}
            maxLength={30}
            required
          />
        </Labelled>
        <div className="grid grid-cols-2 gap-3">
          <Labelled label={dict.firstNameLabel}>
            <Input
              value={values.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              className="h-9 bg-background/50"
              maxLength={50}
            />
          </Labelled>
          <Labelled label={dict.lastNameLabel}>
            <Input
              value={values.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              className="h-9 bg-background/50"
              maxLength={50}
            />
          </Labelled>
        </div>
        <Labelled label={dict.birthdayLabel}>
          <Input
            type="date"
            value={values.birthday}
            onChange={(e) => set("birthday")(e.target.value)}
            className="h-9 bg-background/50"
          />
        </Labelled>
        <div>
          <Button
            type="submit"
            disabled={busy}
            className="h-9 cursor-pointer gap-2"
          >
            {busy && <Loader2 className="animate-spin size-4" />}
            {dict.saveProfile}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
