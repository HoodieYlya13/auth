import type { getDictionary } from "@/lib/dictionaries/dictionaries";

export type AccountDict = Awaited<
  ReturnType<typeof getDictionary>
>["account"];
