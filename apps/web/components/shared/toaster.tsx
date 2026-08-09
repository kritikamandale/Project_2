"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "font-sans bg-cream border border-deep-brown/10 text-deep-brown rounded-xl shadow-sm",
        },
      }}
    />
  );
}
