"use client";

import { useState } from "react";

export default function TransferModal({
  open,
  url,
  onClose,
}: {
  open: boolean;
  url: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
    url
  )}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (e.g. insecure context) -- the link is
      // still visible on screen for the person to copy manually.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-lg border border-base-border bg-base-card p-6 text-center">
        <h2 className="text-lg font-semibold text-white">Transfer the Timer</h2>
        <p className="mt-1 text-sm text-white/60">
          Scan this on another phone or laptop to take over the live timer.
        </p>
        <div className="mt-4 flex justify-center">
          <img
            src={qrSrc}
            alt="QR code linking to the live timer"
            width={240}
            height={240}
            className="rounded-lg bg-white p-2"
          />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-base-border bg-base px-3 py-2">
          <span className="truncate text-xs text-white/70">{url}</span>
          <button
            onClick={copyLink}
            className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-base-border px-4 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          Close
        </button>
      </div>
    </div>
  );
}
