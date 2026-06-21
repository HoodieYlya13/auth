"use client";

import { useEffect, useState } from "react";

interface LocalDateProps {
  date: string | Date;
  showTime?: boolean;
}

export function LocalDate({ date, showTime = false }: LocalDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <span className="opacity-0">00/00/0000</span>;

  const d = new Date(date);
  return <span>{showTime ? d.toLocaleString() : d.toLocaleDateString()}</span>;
}
