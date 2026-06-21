import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function tryCatch<T, E = Error>(
  promiseOrFn: Promise<T> | (() => Promise<T> | T),
): Promise<[E, null] | [null, T]> {
  try {
    const data = await (typeof promiseOrFn === "function"
      ? promiseOrFn()
      : promiseOrFn);
    return [null, data];
  } catch (error) {
    return [error as E, null];
  }
}
