import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <LoadingSpinner spinnerClassName="size-16" />
    </div>
  );
}
