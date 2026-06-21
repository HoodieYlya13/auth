import type { getDictionary } from "@/lib/dictionaries/dictionaries";

export type AdminDict = Awaited<ReturnType<typeof getDictionary>>["admin"];
