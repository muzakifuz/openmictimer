"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const id = crypto.randomUUID();
    router.replace(`/event/${id}`);
  }, [router]);

  return <div className="min-h-screen bg-base" />;
}
