import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-sans font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:     "bg-butter text-deep-brown hover:bg-butter/90 font-sans font-medium uppercase tracking-wider",
        destructive: "bg-rose-700 text-cream hover:bg-rose-800 font-sans font-medium",
        outline:     "border border-deep-brown/20 bg-transparent text-deep-brown hover:bg-deep-brown/5 font-sans font-medium",
        secondary:   "bg-olive text-cream hover:bg-olive/90 font-sans font-medium",
        ghost:       "text-deep-brown hover:bg-deep-brown/10 hover:text-deep-brown font-sans font-medium",
        link:        "text-olive underline-offset-4 hover:underline font-sans font-medium",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm:      "h-9 rounded-lg px-4 text-xs",
        lg:      "h-12 rounded-xl px-8 text-base",
        icon:    "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
