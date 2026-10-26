"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removeAvatar, uploadAvatar } from "@/lib/actions/account-actions";
import type { AccountDict } from "@/components/account/account-dict";
import { tryCatch } from "@/lib/utils";

const SIZE = 256;

// Center-crop to a square and downscale so uploads stay small regardless of the source photo.
async function toSquareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("Encoding failed");
  return blob;
}

export function AvatarPicker({
  initialUrl,
  fallback,
  dict,
}: {
  initialUrl: string | null;
  fallback: string;
  dict: AccountDict;
}) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    startTransition(async () => {
      const [resizeError, blob] = await tryCatch(toSquareImage(file));
      if (resizeError || !blob) {
        toast.error(dict.photoInvalid);
        return;
      }
      const previous = url;
      const preview = URL.createObjectURL(blob);
      setUrl(preview);

      const form = new FormData();
      form.append("avatar", blob, "avatar");
      const [error, result] = await tryCatch(uploadAvatar(form));
      URL.revokeObjectURL(preview);
      if (error || !result || !result.success) {
        setUrl(previous);
        toast.error(result?.error || dict.photoError);
        return;
      }
      setUrl(result.avatarUrl ?? null);
      toast.success(dict.photoSaved);
    });
  };

  const handleRemove = () => {
    const previous = url;
    setUrl(null);
    startTransition(async () => {
      const [error, result] = await tryCatch(removeAvatar());
      if (error || !result || !result.success) {
        setUrl(previous);
        toast.error(result?.error || dict.photoError);
        return;
      }
      toast.success(dict.photoRemoved);
    });
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        aria-label={url ? dict.changePhoto : dict.uploadPhoto}
        className="group relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-full border border-border bg-muted"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-lg font-semibold uppercase text-muted-foreground">
            {fallback}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Camera className="size-5" />
          )}
        </span>
      </button>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="h-9 cursor-pointer"
        >
          {url ? dict.changePhoto : dict.uploadPhoto}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleRemove}
            disabled={isPending}
            className="h-9 cursor-pointer gap-2 text-muted-foreground"
          >
            <Trash2 className="size-4" />
            {dict.removePhoto}
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
