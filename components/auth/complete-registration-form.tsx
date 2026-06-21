"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeRegistration } from "@/lib/actions/account-actions";

interface RegisterDict {
  usernameLabel: string;
  usernamePlaceholder: string;
  usernameHint: string;
  firstNameLabel: string;
  lastNameLabel: string;
  birthdayLabel: string;
  optional: string;
  submit: string;
  success: string;
  error: string;
}

interface Props {
  locale: string;
  returnTo?: string;
  email: string;
  dict: RegisterDict;
}

export function CompleteRegistrationForm({
  locale,
  returnTo,
  email,
  dict,
}: Props) {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const toastId = toast.loading(dict.submit);

    const result = await completeRegistration(
      { username, firstName, lastName, birthday },
      locale,
      returnTo,
    );

    if (result.success && result.redirectTo) {
      toast.success(dict.success, { id: toastId });
      window.location.href = result.redirectTo;
      return;
    }

    toast.error(result.error || dict.error, { id: toastId });
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground -mt-2">{email}</p>

      <Field label={dict.usernameLabel} htmlFor="username">
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={dict.usernamePlaceholder}
          autoComplete="username"
          className="w-full h-9 bg-background/50 border-input"
          disabled={isSubmitting}
          required
          minLength={3}
          maxLength={30}
        />
        <p className="text-[11px] text-muted-foreground px-0.5">
          {dict.usernameHint}
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={`${dict.firstNameLabel} (${dict.optional})`}
          htmlFor="firstName"
        >
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="w-full h-9 bg-background/50 border-input"
            disabled={isSubmitting}
            maxLength={50}
          />
        </Field>
        <Field
          label={`${dict.lastNameLabel} (${dict.optional})`}
          htmlFor="lastName"
        >
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            className="w-full h-9 bg-background/50 border-input"
            disabled={isSubmitting}
            maxLength={50}
          />
        </Field>
      </div>

      <Field
        label={`${dict.birthdayLabel} (${dict.optional})`}
        htmlFor="birthday"
      >
        <Input
          id="birthday"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full h-9 bg-background/50 border-input"
          disabled={isSubmitting}
        />
      </Field>

      <Button
        type="submit"
        disabled={isSubmitting || username.trim().length < 3}
        className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 className="animate-spin size-4" />}
        {dict.submit}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
