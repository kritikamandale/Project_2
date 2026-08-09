import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-deep-brown/15 bg-cream/50 px-4 py-2 text-sm font-sans text-deep-brown placeholder:text-deep-brown/40 focus-visible:outline-none focus-visible:border-olive focus-visible:ring-2 focus-visible:ring-olive/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
