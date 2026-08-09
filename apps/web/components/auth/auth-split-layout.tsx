"use client";

import secondSkinImg from "../../public/second-skin.png";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <div className="h-screen h-dvh w-full flex flex-col lg:flex-row bg-cream text-deep-brown font-sans overflow-hidden">
      {/* ── Bigger section (4 out of 7 parts = ~57.15% width on desktop) — Image on LEFT ── */}
      <div
        className="hidden lg:block w-full lg:w-[57.15%] relative h-full overflow-hidden"
        style={{
          backgroundImage: `url(${secondSkinImg.src})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Direct img element using static import src */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={secondSkinImg.src}
          alt="Skinest — Advanced AI Skin Care"
          className="w-full h-full object-cover object-center absolute inset-0 z-0"
        />

        {/* Soft cream edge blend on the right side of the image */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: "linear-gradient(to left, #F5EFD9 0%, rgba(245,239,217,0.1) 15%, transparent 35%)",
          }}
        />
      </div>

      {/* ── Smaller section (3 out of 7 parts = ~42.85% width on desktop) — Login Form on RIGHT ── */}
      <div className="w-full lg:w-[42.85%] h-full flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 z-10 shrink-0 bg-cream overflow-y-auto">
        <div className="w-full max-w-md my-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
