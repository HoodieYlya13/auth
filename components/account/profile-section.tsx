"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/lib/actions/account-actions";
import { Section } from "@/components/account/section";
import { AvatarPicker } from "@/components/account/avatar-picker";
import type { AccountDict } from "@/components/account/account-dict";
import { tryCatch } from "@/lib/utils";

interface ProfileValues {
  username: string;
  firstName: string;
  lastName: string;
  birthday: string;
}

export function ProfileSection({
  initial,
  avatarUrl,
  dict,
}: {
  initial: ProfileValues;
  avatarUrl: string | null;
  dict: AccountDict;
}) {
  const [values, setValues] = useState<ProfileValues>(initial);
  const savedRef = useRef<ProfileValues>(initial);
  const [isPending, startTransition] = useTransition();

  const set = (key: keyof ProfileValues) => (v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const snapshot = savedRef.current;
    const next = values;
    savedRef.current = next;
    toast.success(dict.profileSaved);
    startTransition(async () => {
      const [error, result] = await tryCatch(updateProfile(next));
      if (error || !result || !result.success) {
        savedRef.current = snapshot;
        setValues(snapshot);
        toast.error(result?.error || dict.profileError);
      }
    });
  };

  return (
    <Section title={dict.profileTitle} description={dict.profileDescription}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Labelled label={dict.photoLabel} htmlFor={null}>
          <AvatarPicker
            initialUrl={avatarUrl}
            fallback={(initial.firstName || initial.username).charAt(0)}
            dict={dict}
          />
        </Labelled>
        <Labelled label={dict.usernameLabel} htmlFor="username">
          <Input
            id="username"
            autoComplete="username"
            value={values.username}
            onChange={(e) => set("username")(e.target.value)}
            className="h-9 bg-background/50"
            minLength={3}
            maxLength={30}
            required
          />
        </Labelled>
        <div className="grid grid-cols-2 gap-3">
          <Labelled label={dict.firstNameLabel} htmlFor="firstName">
            <Input
              id="firstName"
              autoComplete="given-name"
              value={values.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              className="h-9 bg-background/50"
              maxLength={50}
            />
          </Labelled>
          <Labelled label={dict.lastNameLabel} htmlFor="lastName">
            <Input
              id="lastName"
              autoComplete="family-name"
              value={values.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              className="h-9 bg-background/50"
              maxLength={50}
            />
          </Labelled>
        </div>
        <Labelled label={dict.birthdayLabel} htmlFor="birthday">
          <Input
            id="birthday"
            type="date"
            value={values.birthday}
            onChange={(e) => set("birthday")(e.target.value)}
            className="h-9 bg-background/50"
          />
        </Labelled>
        <div>
          <Button
            type="submit"
            disabled={isPending}
            className="h-9 cursor-pointer gap-2"
          >
            {isPending && <Loader2 className="animate-spin size-4" />}
            {dict.saveProfile}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/** `htmlFor: null` for a group that isn't one field (the photo buttons). */
function Labelled({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string | null;
  children: React.ReactNode;
}) {
  const className =
    "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  return (
    <div className="flex flex-col gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={className}>
          {label}
        </label>
      ) : (
        <p className={className}>{label}</p>
      )}
      {children}
    </div>
  );
}
