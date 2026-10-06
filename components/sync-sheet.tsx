"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCode, normalizeCode } from "@/lib/format";
import type { SyncSettings } from "@/lib/sync";
import type { SyncStatus } from "@/components/use-shared-trip";

export function SyncSheet({
  open,
  onOpenChange,
  code,
  status,
  error,
  settings,
  onSettings,
  onCreate,
  onJoin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: string;
  status: SyncStatus;
  error: string | null;
  settings: SyncSettings;
  onSettings: (patch: Partial<SyncSettings>) => void;
  onCreate: () => Promise<void>;
  onJoin: (code: string) => Promise<void>;
}) {
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await onCreate();
      toast.success("Shared plan created. Send the code.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the plan.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    try {
      await onJoin(joinCode);
      toast.success("Opened the shared plan.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open that code.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    const link = new URL(window.location.href);
    link.searchParams.set("trip", code);
    await navigator.clipboard.writeText(code ? link.toString() : code);
    toast.success(code ? "Link copied." : "Nothing to copy yet.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-8">
          <SheetTitle className="font-serif text-2xl">Share the week</SheetTitle>
          <SheetDescription>
            GitHub Pages hosts the site. The plan itself is a file in the repository, so each of you can edit it from your own browser.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          <div className="rounded-2xl bg-secondary px-4 py-4">
            <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">Share code</p>
            <p className="mt-1 font-mono text-3xl tracking-[0.18em]">{formatCode(code)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {status === "saved" && "Saved to the repo."}
              {status === "saving" && "Saving…"}
              {status === "watching" && "You can read this plan. Add a token below to change it."}
              {status === "local" && "Only in this browser until you create a shared plan."}
              {status === "error" && "The last save did not land."}
              {status === "loading" && "Opening…"}
            </p>
            {error && <p className="mt-2 text-sm text-primary">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={() => void create()} disabled={busy || !settings.token}>
                {code ? "Save now" : "Create shared plan"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void copy()} disabled={!code}>
                Copy link
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="join-code">Open a code</Label>
            <div className="flex gap-2">
              <Input
                id="join-code"
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeCode(event.target.value))}
                placeholder="ABC·123"
                className="font-mono tracking-[0.14em]"
              />
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void join()}>
                Open
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-serif text-lg">GitHub access</p>
            <p className="text-sm text-muted-foreground">
              Each of you creates a fine-grained personal access token with Contents set to read and write, limited to this repository. Paste it here. It stays in this browser and is never written into the trip file. Both of you need write access to the repo.
            </p>
            <Field label="Token" value={settings.token} secret onChange={(token) => onSettings({ token })} />
            <Field label="Owner" value={settings.owner} onChange={(owner) => onSettings({ owner })} />
            <Field label="Repository" value={settings.repo} onChange={(repo) => onSettings({ repo })} />
            <Field label="Branch" value={settings.branch} onChange={(branch) => onSettings({ branch })} />
          </div>

          <div className="space-y-3">
            <p className="font-serif text-lg">Google Maps</p>
            <p className="text-sm text-muted-foreground">
              Optional. Without a key, routes are estimated and the map is a sketch. With a key, place search, transit lines, fares, and hotels come from Google. Restrict the key to this site.
            </p>
            <Field label="Maps key" value={settings.mapsKey} secret onChange={(mapsKey) => onSettings({ mapsKey })} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  secret,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secret?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={secret ? "password" : "text"} value={value} autoComplete="off" onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
