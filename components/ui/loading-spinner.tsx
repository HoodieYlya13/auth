import * as React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  spinnerClassName?: string;
}

export function LoadingSpinner({
  className,
  spinnerClassName,
  ...props
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn("flex justify-center items-center w-full", className)}
      {...props}
    >
      <div
        className={cn(
          "size-8 rounded-full border-4 border-primary border-t-transparent animate-spin",
          spinnerClassName,
        )}
      />
    </div>
  );
}
