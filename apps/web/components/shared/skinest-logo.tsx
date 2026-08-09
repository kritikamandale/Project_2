import React from "react";
import Link from "next/link";

interface SkinestLogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  textClassName?: string;
  className?: string;
  variant?: "default" | "light" | "white" | "dark";
  href?: string;
}

const SIZE_MAP = {
  xs: { box: "w-6 h-6", text: "text-base" },
  sm: { box: "w-8 h-8", text: "text-lg" },
  md: { box: "w-9 h-9", text: "text-xl" },
  lg: { box: "w-10 h-10", text: "text-2xl" },
  xl: { box: "w-12 h-12", text: "text-3xl" },
};

export function SkinestLogoIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="skinest-logo-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5C6040" />
          <stop offset="60%" stopColor="#484C31" />
          <stop offset="100%" stopColor="#2D301E" />
        </linearGradient>
        <linearGradient id="skinest-drop-grad" x1="256" y1="70" x2="256" y2="430" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#F5EFD9" />
          <stop offset="100%" stopColor="#E4DAAE" />
        </linearGradient>
        <linearGradient id="skinest-butter-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF2A1" />
          <stop offset="100%" stopColor="#F4D84A" />
        </linearGradient>
        <filter id="skinest-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#1A1C12" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Squircle Tile Container */}
      <rect width="512" height="512" rx="128" fill="url(#skinest-logo-bg)" />

      {/* Inner Glass Edge */}
      <rect x="14" y="14" width="484" height="484" rx="114" fill="none" stroke="#F5EFD9" strokeOpacity="0.25" strokeWidth="6" />

      {/* Main Emblem Group */}
      <g filter="url(#skinest-shadow)">
        {/* Outer Teardrop in Warm Cream */}
        <path d="M 256 80 C 256 80 135 225 135 318 C 135 385 189 438 256 438 C 323 438 377 385 377 318 C 377 225 256 80 256 80 Z" fill="url(#skinest-drop-grad)" />

        {/* Translucent Layer Contour */}
        <path d="M 256 125 C 256 125 168 240 168 312 C 168 360 207 398 256 398 C 305 398 344 360 344 312 C 344 240 256 125 256 125 Z" fill="#5C6040" fillOpacity="0.16" />

        {/* AI Sparkle Star Core (Deep Brown) */}
        <path d="M 256 215 C 256 262 218 288 218 288 C 218 288 256 314 256 361 C 256 314 294 288 294 288 C 294 288 256 262 256 215 Z" fill="#28261E" />

        {/* Radiant Secondary Sparkle (Butter Gold) */}
        <path d="M 324 172 C 324 192 306 202 306 202 C 306 202 324 212 324 232 C 324 212 342 202 342 202 C 342 202 324 192 324 172 Z" fill="url(#skinest-butter-grad)" />
      </g>
    </svg>
  );
}

export function SkinestLogo({
  size = "md",
  showText = true,
  textClassName = "",
  className = "",
  variant = "default",
  href,
}: SkinestLogoProps) {
  const config = SIZE_MAP[size] || SIZE_MAP.md;

  let textColor = "text-zinc-800 dark:text-white";
  if (variant === "white") textColor = "text-white";
  if (variant === "dark") textColor = "text-zinc-900";
  if (variant === "light") textColor = "text-white/90";

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className={`relative flex shrink-0 items-center justify-center ${config.box} transition-transform hover:scale-105`}>
        <SkinestLogoIcon className="h-full w-full drop-shadow-sm" />
      </div>
      {showText && (
        <span className={`font-heading font-bold tracking-tight ${config.text} ${textColor} ${textClassName}`}>
          Skinest
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center rounded-lg focus:outline-none focus:ring-2 focus:ring-skin-400">
        {content}
      </Link>
    );
  }

  return content;
}
