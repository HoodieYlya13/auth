"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";
import {
  createClient,
  deleteClient,
  regenerateClientSecret,
  updateClient,
  type ClientInput,
} from "@/lib/actions/admin-actions";
import type { AdminDict } from "@/components/admin/admin-dict";

interface ClientView {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  trusted: boolean;
  roles: string[];
  defaultRoles: string[];
  allowedScopes: string[];
  confidential: boolean;
}

export function ClientsManager({
  clients,
  dict,
}: {
  clients: ClientView[];
  dict: AdminDict;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{dict.clientsTitle}</h1>
        <Button
          size="sm"
          className="h-8 gap-1.5 cursor-pointer"
          onClick={() => {
            setCreating((v) => !v);
            setEditingId(null);
          }}
        >
          <Plus className="size-4" />
          {dict.newClient}
        </Button>
      </div>

      {secret && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold">{dict.secretTitle}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {dict.secretWarning}
          </p>
          <code className="mt-2 block break-all rounded bg-background border border-border p-2 text-xs">
            {secret}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(secret);
              toast.success(dict.copied);
            }}
          >
            {dict.copy}
          </Button>
        </div>
      )}

      {creating && (
        <ClientForm
          dict={dict}
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            const result = await createClient(input);
            if (result.success) {
              toast.success(dict.saved);
              if (result.secret) setSecret(result.secret);
              setCreating(false);
              router.refresh();
            } else toast.error(result.error || dict.error);
            return result.success;
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        {clients.length === 0 && (
          <p className="text-sm text-muted-foreground">{dict.noClients}</p>
        )}
        {clients.map((client) =>
          editingId === client.id ? (
            <ClientForm
              key={client.id}
              dict={dict}
              initial={client}
              onCancel={() => setEditingId(null)}
              onSubmit={async (input) => {
                const result = await updateClient(client.id, input);
                if (result.success) {
                  toast.success(dict.saved);
                  setEditingId(null);
                  router.refresh();
                } else {
                  toast.error(result.error || dict.error);
                }
                return result.success;
              }}
            />
          ) : (
            <div
              key={client.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{client.name}</p>
                    <Badge>
                      {client.trusted ? dict.trustedBadge : dict.untrustedBadge}
                    </Badge>
                    <Badge>
                      {client.confidential
                        ? dict.confidentialBadge
                        : dict.publicBadge}
                    </Badge>
                  </div>
                  <code className="text-xs text-muted-foreground break-all">
                    {client.clientId}
                  </code>
                  <dl className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    <div>
                      {dict.redirectsLabel}: {client.redirectUris.join(", ")}
                    </div>
                    <div>
                      {dict.rolesLabel}: {client.roles.join(", ")}
                    </div>
                    <div>
                      {dict.defaultRolesLabel}: {client.defaultRoles.join(", ")}
                    </div>
                    <div>
                      {dict.scopesLabel}: {client.allowedScopes.join(", ")}
                    </div>
                  </dl>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(client.id);
                      setCreating(false);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
                  >
                    {dict.edit}
                  </button>
                  {client.confidential && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(dict.regenerateConfirm)) return;
                        const result = await regenerateClientSecret(client.id);
                        if (result.success && result.secret) {
                          setSecret(result.secret);
                          toast.success(dict.saved);
                        } else toast.error(result.error || dict.error);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
                    >
                      {dict.regenerate}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={dict.delete}
                    onClick={async () => {
                      if (!window.confirm(dict.deleteConfirm)) return;
                      const result = await deleteClient(client.id);
                      if (result.success) {
                        toast.success(dict.saved);
                        router.refresh();
                      } else {
                        toast.error(result.error || dict.error);
                      }
                    }}
                    className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function ClientForm({
  dict,
  initial,
  onCancel,
  onSubmit,
}: {
  dict: AdminDict;
  initial?: ClientView;
  onCancel: () => void;
  onSubmit: (input: ClientInput) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [redirectUris, setRedirectUris] = useState(
    (initial?.redirectUris ?? []).join("\n"),
  );
  const [postLogout, setPostLogout] = useState(
    (initial?.postLogoutRedirectUris ?? []).join("\n"),
  );
  const [roles, setRoles] = useState(
    (initial?.roles ?? ["USER", "ADMIN"]).join(", "),
  );
  const [defaultRoles, setDefaultRoles] = useState(
    (initial?.defaultRoles ?? ["USER"]).join(", "),
  );
  const [scopes, setScopes] = useState(
    (
      initial?.allowedScopes ?? ["openid", "profile", "email", "offline_access"]
    ).join(", "),
  );
  const [trusted, setTrusted] = useState(initial?.trusted ?? false);
  const [confidential, setConfidential] = useState(
    initial?.confidential ?? false,
  );
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSubmit({
          name,
          redirectUris,
          postLogoutRedirectUris: postLogout,
          roles,
          defaultRoles,
          allowedScopes: scopes,
          trusted,
          confidential,
        });
        setBusy(false);
      }}
      className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
    >
      <FormRow label={dict.formName}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
          required
        />
      </FormRow>
      <FormRow label={dict.formRedirect} hint={dict.formRedirectHint}>
        <textarea
          value={redirectUris}
          onChange={(e) => setRedirectUris(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
          required
        />
      </FormRow>
      <FormRow label={dict.formPostLogout}>
        <textarea
          value={postLogout}
          onChange={(e) => setPostLogout(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
        />
      </FormRow>
      <div className="grid grid-cols-2 gap-3">
        <FormRow label={dict.formRoles} hint={dict.formRolesHint}>
          <Input
            value={roles}
            onChange={(e) => setRoles(e.target.value)}
            className="h-9"
          />
        </FormRow>
        <FormRow label={dict.formDefaultRoles} hint={dict.formDefaultRolesHint}>
          <Input
            value={defaultRoles}
            onChange={(e) => setDefaultRoles(e.target.value)}
            className="h-9"
          />
        </FormRow>
      </div>
      <FormRow label={dict.formScopes}>
        <Input
          value={scopes}
          onChange={(e) => setScopes(e.target.value)}
          className="h-9"
        />
      </FormRow>
      <div className="flex flex-col gap-2">
        <Checkbox
          checked={trusted}
          onChange={setTrusted}
          label={dict.formTrusted}
          hint={dict.formTrustedHint}
        />
        {!initial && (
          <Checkbox
            checked={confidential}
            onChange={setConfidential}
            label={dict.formConfidential}
            hint={dict.formConfidentialHint}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={busy}
          className="h-9 gap-2 cursor-pointer"
        >
          {busy && <Loader2 className="animate-spin size-4" />}
          {initial ? dict.save : dict.create}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-9 cursor-pointer"
        >
          {dict.cancel}
        </Button>
      </div>
    </form>
  );
}

function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = `chk-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1 py-1">
      <label
        htmlFor={id}
        className="flex items-center gap-2.5 cursor-pointer select-none"
      >
        <ShadcnCheckbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onChange(!!v)}
        />
        <span className="text-sm font-medium leading-none">{label}</span>
      </label>
      {hint && (
        <p className="text-[11px] text-muted-foreground pl-[26px] select-none">
          {hint}
        </p>
      )}
    </div>
  );
}
