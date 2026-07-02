"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

// Free Pexels stock photos (CC0 / free to use)
const PX = (id: number, w = 800, h = 1000) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&dpr=1`;

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

const IconScan = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="7" y="7" width="10" height="10" rx="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconBrain = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.04-4.04 3 3 0 0 1-1-3 2.5 2.5 0 0 1 1.5-4.5 2.5 2.5 0 0 1 2-2.5Z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.04-4.04 3 3 0 0 0 1-3 2.5 2.5 0 0 0-1.5-4.5A2.5 2.5 0 0 0 14.5 2Z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="9 12 11 14 15 10" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7 16l4-4 4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconDoctor = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <circle cx="12" cy="7" r="4"/>
    <path d="M5.5 21a7 7 0 0 1 13 0" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 11h4v4h-4z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconLeaf = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5">
    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-5 h-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
    <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const StarFill = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-400">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-skin-100 shadow-sm">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <span className="font-heading font-bold text-xl text-skin-800">SkinAI</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[["#about","About"],["#how-it-works","How It Works"],["#features","Features"],["#faq","FAQ"]].map(([h,l]) => (
            <a key={h} href={h} className="text-sm font-medium text-gray-600 hover:text-skin-600 transition-colors">{l}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link href="/login">Sign In</Link></Button>
          <Button size="sm" className="bg-skin-500 hover:bg-skin-600 text-white shadow-sm" asChild>
            <Link href="/register">Get Started Free</Link>
          </Button>
        </div>

        <button className="md:hidden p-2 rounded-md text-gray-600" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
            {mobileOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>}
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ height:0,opacity:0 }} animate={{ height:"auto",opacity:1 }} exit={{ height:0,opacity:0 }}
            transition={{ duration:0.2 }} className="md:hidden overflow-hidden bg-white border-t border-skin-100">
            <div className="container mx-auto px-6 py-4 flex flex-col gap-4">
              {[["#about","About"],["#how-it-works","How It Works"],["#features","Features"],["#faq","FAQ"]].map(([h,l]) => (
                <a key={h} href={h} className="text-sm font-medium text-gray-600" onClick={() => setMobileOpen(false)}>{l}</a>
              ))}
              <div className="flex gap-3 pt-2 border-t border-skin-100">
                <Button variant="outline" size="sm" className="flex-1" asChild><Link href="/login">Sign In</Link></Button>
                <Button size="sm" className="flex-1 bg-skin-500 hover:bg-skin-600 text-white" asChild><Link href="/register">Get Started</Link></Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-gradient-to-br from-skin-50 via-white to-skin-100/40">
      <div className="absolute top-20 -left-40 w-96 h-96 rounded-full bg-skin-200/40 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -right-40 w-96 h-96 rounded-full bg-skin-100/60 blur-3xl pointer-events-none" />

      <div className="container relative z-10 mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — text */}
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6 border border-teal-200">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              AI-Powered · Dermatologist-Reviewed · Made for India
            </motion.div>

            <motion.h1 variants={fadeUp} className="font-heading text-6xl md:text-7xl font-bold text-gray-900 leading-[1.05] tracking-tight mb-6">
              Know Your Skin.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-skin-500 to-skin-700">
                Transform
              </span>{" "}
              Your Routine.
            </motion.h1>

            <motion.p variants={fadeUp} className="text-xl text-gray-500 leading-relaxed mb-10">
              SkinAI analyses your skin using advanced AI, detects conditions with clinical accuracy,
              and builds a <strong className="text-gray-700">personalised skincare routine</strong> — reviewed
              by real dermatologists.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 mb-10">
              <Button size="lg" className="bg-skin-500 hover:bg-skin-600 text-white text-base px-8 h-12 shadow-lg shadow-skin-200" asChild>
                <Link href="/register">Get Started Free →</Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12 border-skin-200 hover:bg-skin-50" asChild>
                <Link href="/login">Sign In to Your Account</Link>
              </Button>
            </motion.div>

            <motion.div variants={fadeUp} className="flex items-center gap-6">
              {/* Trusted-by avatar cluster — more real faces reads as more human,
                  less purely clinical/AI. */}
              <div className="flex -space-x-3">
                {[6977987, 3762765, 32707142, 7622743].map((id, i) => (
                  <div key={id} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden relative" style={{ zIndex: 6 - i }}>
                    <Image src={PX(id, 80, 80)} alt="SkinAI user" fill className="object-cover" sizes="40px" />
                  </div>
                ))}
                {/* TODO: replace with real customer photography — pravatar.cc
                    placeholders used here only because these two extra faces
                    have no existing sourced photo in this asset pipeline. */}
                {["skinai-user-5", "skinai-user-6"].map((seed, i) => (
                  <div key={seed} className="w-10 h-10 rounded-full border-2 border-white overflow-hidden relative" style={{ zIndex: 2 - i }}>
                    <Image src={`https://i.pravatar.cc/80?u=${seed}`} alt="SkinAI user" fill className="object-cover" sizes="40px" />
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 mb-0.5">
                  {[1,2,3,4,5].map(i => <StarFill key={i} />)}
                </div>
                <p className="text-sm text-gray-500"><strong className="text-gray-900">10,000+</strong> skin analyses done</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — portrait with floating AI cards */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
            className="relative flex justify-center"
          >
            {/* Main portrait */}
            <div className="relative w-80 h-[480px] md:w-96 md:h-[560px] rounded-3xl overflow-hidden shadow-2xl">
              <Image
                src={PX(3762754, 800, 1000)}
                alt="Woman with healthy, glowing skin — SkinAI analysis result"
                fill
                className="object-cover object-top"
                priority
                sizes="(max-width: 768px) 320px, 384px"
              />
              {/* Subtle gradient at bottom */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              {/* Scan line animation overlay */}
              <div className="absolute inset-0 flex flex-col justify-center pointer-events-none">
                <div className="mx-6 h-0.5 bg-gradient-to-r from-transparent via-skin-400/80 to-transparent animate-[scan-line_3s_ease-in-out_infinite]" />
              </div>
            </div>

            {/* Floating: Analysis complete — teal tags the AI-analysis output specifically */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.5 }}
              className="absolute -bottom-4 -left-4 md:-left-8 bg-white rounded-2xl shadow-xl p-4 border border-teal-100 min-w-[200px]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">AI</div>
                <div>
                  <p className="text-xs text-gray-400">Analysis Complete</p>
                  <p className="font-number text-sm font-bold text-gray-900">Fitzpatrick Type III</p>
                </div>
              </div>
              <div className="flex gap-2">
                {[["Hydration","78%","bg-teal-100 text-teal-700"],["UV Damage","Low","bg-teal-50 text-teal-600"]].map(([l,v,c]) => (
                  <div key={l} className={`font-number rounded-lg px-2 py-1 text-xs font-semibold ${c}`}>{l}: {v}</div>
                ))}
              </div>
            </motion.div>

            {/* Floating: Detected conditions — AI output, teal-tagged */}
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.5 }}
              className="absolute -top-4 -right-4 md:-right-8 bg-white rounded-2xl shadow-xl p-4 border border-teal-100"
            >
              <p className="text-xs font-bold text-gray-900 mb-2">Conditions Detected</p>
              {[
                ["Mild Acne", "Low severity"],
                ["Hyperpigmentation", "Moderate"],
                ["Dehydration", "High"],
              ].map(([c, s]) => (
                <div key={c} className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-teal-400 flex-shrink-0" />
                  <span className="text-xs text-gray-700 font-medium">{c}</span>
                  <span className="text-xs text-gray-400 ml-auto">{s}</span>
                </div>
              ))}
            </motion.div>

            {/* Trust badge — a confidence percentage, teal-tagged */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.5 }}
              className="absolute bottom-24 -right-4 md:-right-8 bg-teal-600 text-white rounded-xl shadow-lg px-3 py-2"
            >
              <p className="font-number text-xs font-bold">95% Accurate</p>
              <p className="text-xs opacity-80">Dermatologist Verified</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function StatsSection() {
  return (
    // Full-bleed twilight-indigo trust band — the palette's "weightier, more
    // premium" dark treatment. These are AI-analysis output stats, so the
    // numbers themselves are teal-tagged (muted-teal = the AI/analysis accent).
    <section className="bg-gray-900 py-14">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[["95%","AI Analysis Accuracy"],["15+","Skin Conditions Detected"],["50+","Expert Dermatologists"],["100%","Privacy Guaranteed"]].map(([n,l]) => (
            <motion.div key={l} variants={fadeUp}>
              <p className="font-number text-4xl md:text-5xl font-bold text-teal-300 mb-2">{n}</p>
              <p className="text-sm text-gray-300 font-medium">{l}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── What We Detect (Minimalist-inspired) ────────────────────────────────────

const CONDITIONS = [
  { id: 6977987, label: "Acne & Breakouts",       desc: "Grade I–IV acne, comedones, pustules, cystic spots",          badge: "Most Common" },
  { id: 5069473, label: "Dryness & Dehydration",  desc: "Moisture barrier assessment, transepidermal water loss",       badge: null },
  { id: 6706877, label: "Dark Circles",            desc: "Periorbital pigmentation, puffiness, hollowness detection",   badge: null },
  { id: 3762765, label: "Radiance & Glow",         desc: "Luminosity score, dullness analysis, skin vitality index",    badge: "New" },
  { id: 5253959, label: "Texture & Pores",         desc: "Pore size mapping, skin roughness, fine texture scoring",     badge: null },
  { id: 3762758, label: "Hyperpigmentation",       desc: "Melasma, sunspots, post-inflammatory marks, tone unevenness", badge: null },
];

function ConditionsSection() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-14">
            <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">What We Analyse</span>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-gray-900 mt-3 mb-4">
              15+ skin attributes. One scan.
            </h2>
            <p className="text-xl text-gray-500 max-w-xl mx-auto">
              SkinAI detects every major skin concern with clinical detail — far beyond what you see in the mirror.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {CONDITIONS.map(({ id, label, desc, badge }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="group rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 bg-white"
              >
                {/* Image */}
                <div className="relative h-52 overflow-hidden">
                  <Image
                    src={PX(id, 600, 600)}
                    alt={`${label} — skin condition detected by SkinAI`}
                    fill
                    className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {badge && (
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-skin-500 text-white">
                      {badge}
                    </span>
                  )}
                  {/* Condition name overlay on image */}
                  <div className="absolute bottom-3 left-4">
                    <p className="text-white font-heading font-bold text-lg leading-tight">{label}</p>
                  </div>
                </div>
                {/* Description */}
                <div className="p-4">
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-skin-500" />
                    <span className="text-xs text-skin-600 font-medium">Detected with severity score</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div variants={fadeUp} className="text-center mt-10">
            <p className="text-sm text-gray-400 mb-4">+ Rosacea · Seborrheic Dermatitis · Redness · Fine Lines · Wrinkles · Sun Damage · Oiliness</p>
            <Button className="bg-skin-500 hover:bg-skin-600 text-white" asChild>
              <Link href="/register">Run Your Free Analysis →</Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <section id="about" className="py-24 bg-skin-50">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}
          className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">About SkinAI</span>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-gray-900 mt-3 mb-6">
              What is SkinAI?
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              SkinAI combines computer vision, the SkinAI Intelligence Engine, and dermatologist expertise to give you
              <strong className="text-gray-700"> personalised, science-backed skincare advice</strong> — from your phone.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <IconScan />, title: "Scan in Seconds", desc: "Use your phone camera — no app needed. Our TensorFlow model detects 15+ skin conditions in real time.", cardCls: "border-skin-100 bg-white", iconCls: "bg-skin-100 text-skin-600" },
              { icon: <IconBrain />, title: "AI That Understands You", desc: "Beyond the scan, our AI combines your skin type, Fitzpatrick tone, lifestyle, and diet into a complete profile.", cardCls: "border-skin-100 bg-white", iconCls: "bg-skin-100 text-skin-600" },
              { icon: <IconDoctor />, title: "Dermatologist Review", desc: "Every analysis is reviewed by a certified dermatologist who validates and refines the AI findings before you see results.", cardCls: "border-skin-100 bg-white", iconCls: "bg-skin-100 text-skin-600" },
            ].map(({ icon, title, desc, cardCls, iconCls }) => (
              <motion.div key={title} variants={fadeUp} className={`p-7 rounded-2xl border hover:shadow-lg transition-shadow ${cardCls}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${iconCls}`}>{icon}</div>
                <h3 className="font-heading text-xl font-semibold text-gray-900 mb-3">{title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Why We Built This ────────────────────────────────────────────────────────

function WhyWeBuiltSection() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}
          className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div variants={fadeUp}>
              <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">Why We Built This</span>
              <h2 className="font-heading text-4xl font-medium text-gray-900 mt-3 mb-6 leading-tight">
                Great skin advice shouldn't be a luxury.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-5">
                Most skincare advice is calibrated for Western skin. For India's diverse Fitzpatrick types, humidity-driven conditions, and unique dietary factors, that advice simply doesn't work.
              </p>
              <p className="text-gray-500 leading-relaxed mb-5">
                A good dermatologist visit costs <strong className="text-gray-700">₹500–₹2,000</strong> with waiting rooms, repeat appointments, and generic prescriptions. Most people end up following influencer routines that damage their skin.
              </p>
              <p className="text-gray-500 leading-relaxed">
                We built SkinAI to <strong className="text-gray-700">democratise expert skin analysis</strong>, surface products available in India (Nykaa, Minimalist, Dermaco), and make dermatologist expertise accessible to everyone — free.
              </p>
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-4">
              {[
                { emoji: "😩", title: "Generic Advice Fails Indian Skin", desc: "Advice optimised for Fitzpatrick I–II causes hyperpigmentation on darker tones. SkinAI is calibrated for all 6 types." },
                { emoji: "💸", title: "Expensive Dermatologist Visits", desc: "Most people can't afford frequent consultations. SkinAI puts expert-level analysis in everyone's hands, free." },
                { emoji: "🧴", title: "Product Overload with No Direction", desc: "Thousands of products, contradictory claims. SkinAI cuts through noise with ingredient-level, evidence-backed picks." },
                { emoji: "📵", title: "No Way to Track Skin Changes", desc: "Progress is invisible without tracking. SkinAI logs your journey so you can see what's working." },
              ].map(({ emoji, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 bg-skin-50 rounded-xl border border-skin-100">
                  <span className="text-2xl flex-shrink-0">{emoji}</span>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1 text-sm">{title}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const STEPS = [
  { step:"01", title:"Scan Your Skin",           desc:"Open the camera in your browser. Capture your face. Your image is processed instantly and never stored.",          icon:<IconScan />,  imgId:6977987 },
  { step:"02", title:"Tell Us About You",         desc:"Answer a short questionnaire about lifestyle, diet, sleep, and skin concerns for a personalised profile.",         icon:<IconBrain />, imgId:5069473 },
  { step:"03", title:"AI Analyses Everything",    desc:"The SkinAI Intelligence Engine generates your personalised routine using your full skin profile, with ingredient-level justification.",  icon:<IconStar />,  imgId:3762756 },
  { step:"04", title:"Track Your Progress",       desc:"Follow your roadmap, log adherence, and rescan weekly to watch your skin transform over time.",                     icon:<IconChart />, imgId:6706877 },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-skin-50">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">How It Works</span>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-gray-900 mt-3 mb-4">
              From scan to skincare routine in minutes
            </h2>
            <p className="text-xl text-gray-500 max-w-xl mx-auto">Four steps to the most personalised skincare plan you've ever had.</p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {STEPS.map(({ step, title, desc, icon, imgId }, i) => (
              <motion.div key={step} variants={fadeUp} className="relative">
                {i < 3 && <div className="hidden md:block absolute top-10 left-[calc(100%-12px)] w-6 h-0.5 bg-skin-200 z-10" />}
                <div className="bg-white rounded-2xl overflow-hidden border border-skin-100 shadow-sm hover:shadow-md transition-shadow h-full">
                  {/* Step image */}
                  <div className="relative h-40 overflow-hidden">
                    <Image
                      src={PX(imgId, 400, 300)}
                      alt={title}
                      fill
                      className="object-cover object-center"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-skin-300">{step}</span>
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur text-white flex items-center justify-center">{icon}</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-heading text-base font-semibold text-gray-900 mb-2">{title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon:<IconScan />,   title:"Real-Time Skin Scan",         desc:"Browser-based TF.js detection — no app, no delay. 15+ conditions with confidence scores.",              tag:"AI"       },
  { icon:<IconBrain />,  title:"AI Routine Engine",           desc:"Powered by the SkinAI Intelligence Engine. Your routine is generated from your full skin profile, not a template.",  tag:"AI"       },
  // This card gets a human photo instead of an icon — dermatologist review is
  // inherently a human-in-the-loop feature, not a purely AI/icon one.
  // TODO: replace with real customer/dermatologist photography (stock Pexels photo).
  { icon:<IconDoctor />, title:"Dermatologist Review",        desc:"Real dermatologists review every AI report. They approve, flag concerns, or add clinical notes.",        tag:"Medical", img: 8783902 },
  { icon:<IconLeaf />,   title:"Indian Product Database",     desc:"Recommendations from Nykaa, Minimalist, Dermaco, Dot & Key. Vetted for Indian climate and skin tones.",  tag:"India"    },
  { icon:<IconChart />,  title:"Progress Tracking",           desc:"Weekly rescans, adherence heatmaps, and a progress timeline show your skin's full journey.",             tag:"Tracking" },
  { icon:<IconShield />, title:"Privacy by Design",           desc:"Images processed ephemerally — never stored. Delete your account and all data instantly.",              tag:"Privacy"  },
  { icon:<IconLock />,   title:"Fitzpatrick-Aware AI",        desc:"Calibrated across all 6 skin tones. No more advice optimised only for lighter complexions.",            tag:"Inclusive"},
  { icon:<IconStar />,   title:"Personalised Roadmap",        desc:"Week-by-week morning & night routine with layering instructions and re-introduction timelines.",         tag:"Routine"  },
];

// Tag color: "AI" tags route through muted-teal (the AI/analysis accent per
// the palette's role mapping); every other category stays in the primary
// burnt-peach family. Style-only lookup, mirrors existing badge-color maps
// elsewhere in the app (e.g. severity/brand badges) — no new logic.
const TAG_COLOR: Record<string, string> = { AI: "text-teal-500" };

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-gradient-to-b from-skin-50 to-white">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">Features</span>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-gray-900 mt-3 mb-4">
              Everything your skin needs.
            </h2>
            <p className="text-xl text-gray-500 max-w-xl mx-auto">SkinAI combines AI, medical expertise, and Indian skincare intelligence.</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
            {FEATURES.map(({ icon, title, desc, tag, img }) => (
              <motion.div key={title} variants={fadeUp}
                className="group p-6 rounded-2xl bg-white border border-skin-100 hover:border-skin-300 hover:shadow-lg transition-all duration-300">
                {img ? (
                  <div className="w-12 h-12 rounded-xl overflow-hidden relative mb-4">
                    <Image src={PX(img, 96, 96)} alt="" fill className="object-cover" sizes="48px" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-skin-100 text-skin-600 flex items-center justify-center mb-4 group-hover:bg-skin-500 group-hover:text-white transition-colors">
                    {icon}
                  </div>
                )}
                <span className={`text-xs font-bold tracking-widest uppercase mb-2 block ${TAG_COLOR[tag] ?? "text-skin-500"}`}>{tag}</span>
                <h3 className="font-heading text-sm font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── For Everyone ─────────────────────────────────────────────────────────────

function ForEveryoneSection() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}
          className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">Who It's For</span>
            <h2 className="font-heading text-4xl md:text-5xl font-medium text-gray-900 mt-3">Built for everyone</h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Users */}
            <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden border border-skin-200 shadow-sm">
              <div className="relative h-56 overflow-hidden">
                <Image src={PX(6977996, 700, 500)} alt="Woman following personalised skincare routine" fill className="object-cover object-top" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-skin-900/80 to-transparent" />
                <div className="absolute bottom-4 left-5">
                  <span className="text-white font-heading text-2xl font-bold">For Individuals</span>
                </div>
              </div>
              <div className="p-7 bg-gradient-to-b from-skin-50 to-white">
                <p className="text-gray-600 mb-5 leading-relaxed text-sm">Tired of buying products that don't work? Get a personalised, evidence-based routine in minutes.</p>
                <ul className="space-y-2.5 mb-6">
                  {["Free AI skin analysis","Routine built for your skin type & tone","Indian products you can actually buy","Weekly progress tracking & rescans","Dermatologist review included"].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="text-skin-500 flex-shrink-0"><IconCheck /></span>{item}
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-skin-500 hover:bg-skin-600 text-white" asChild>
                  <Link href="/register">Create Free Account</Link>
                </Button>
              </div>
            </motion.div>

            {/* Dermatologists */}
            <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden border border-skin-200 shadow-sm">
              <div className="relative h-56 overflow-hidden">
                <Image src={PX(8783902, 700, 500)} alt="Dermatologist reviewing patient skin analysis" fill className="object-cover object-center" sizes="(max-width: 768px) 100vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-skin-900/80 to-transparent" />
                <div className="absolute bottom-4 left-5">
                  <span className="text-white font-heading text-2xl font-bold">For Dermatologists</span>
                </div>
              </div>
              <div className="p-7 bg-gradient-to-b from-skin-50 to-white">
                <p className="text-gray-600 mb-5 leading-relaxed text-sm">Scale your practice and serve more patients with AI-assisted pre-analysis. Focus your expertise where it matters.</p>
                <ul className="space-y-2.5 mb-6">
                  {["Review AI-analysed cases asynchronously","Approve, refine, or flag AI recommendations","Full patient history & progress timeline","Expand reach without extra clinic hours","Contribute to better AI with your expertise"].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="text-skin-500 flex-shrink-0"><IconCheck /></span>{item}
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-skin-700 hover:bg-skin-800 text-white" asChild>
                  <Link href="/register/dermatologist">Apply as Dermatologist</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

// TODO: replace with real customer photography — these are stock photos
// (same free Pexels source used throughout this page), and the names below
// are illustrative first-name-only placeholders, not real verified users.
const TESTIMONIALS = [
  {
    imgId: 3762765,
    name: "Priya S.",
    skin: "Combination · Fitzpatrick III",
    quote: "I've spent ₹15,000+ on products that did nothing. SkinAI identified my dehydration barrier issue in one scan. The Minimalist routine it gave me cleared my texture in 3 weeks.",
  },
  {
    imgId: 32707142,
    name: "Ananya R.",
    skin: "Oily · Fitzpatrick IV",
    quote: "Finally an app that doesn't recommend SPF 30 for 'all skin types'. The Fitzpatrick-aware analysis gave me recommendations that actually account for my melanin levels. Game changer.",
  },
  {
    imgId: 7622743,
    name: "Meera T.",
    skin: "Dry · Fitzpatrick II",
    quote: "The dermatologist caught that my AI analysis flagged something that turned out to be early-stage seborrheic dermatitis. The AI literally helped catch a condition I'd ignored for years.",
  },
  {
    imgId: 6977996,
    name: "Kavya N.",
    skin: "Normal · Fitzpatrick V",
    quote: "Finally, skincare advice that gets my skin tone right instead of defaulting to lighter-skin defaults.",
  },
  {
    imgId: 8783902,
    name: "Rhea D.",
    skin: "Sensitive · Fitzpatrick II",
    quote: "The weekly rescans actually show me progress instead of just guessing if a product is working.",
  },
  {
    imgId: 5253959,
    name: "Ishaan M.",
    skin: "Oily · Fitzpatrick IV",
    quote: "Having a dermatologist review the AI's findings before I saw them made me trust the routine a lot more.",
  },
];

function TestimonialsSection() {
  return (
    <section className="py-24 bg-skin-50">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}>
          <motion.div variants={fadeUp} className="text-center mb-14">
            <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">Real Results</span>
            <h2 className="font-heading text-4xl font-medium text-gray-900 mt-3 mb-3">Trusted by thousands</h2>
            <p className="text-gray-500 max-w-md mx-auto">Real people. Real Indian skin. Real results.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map(({ imgId, name, skin, quote }) => (
              <motion.div key={name} variants={fadeUp}
                className="bg-white rounded-2xl p-6 border border-skin-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => <StarFill key={i} />)}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">"{quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border-2 border-skin-100">
                    <Image src={PX(imgId, 120, 120)} alt={name} fill className="object-cover" sizes="44px" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{name}</p>
                    <p className="text-xs text-gray-400">{skin}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Privacy ──────────────────────────────────────────────────────────────────

function PrivacySection() {
  return (
    // Twilight-indigo dark band — privacy/security is exactly the "weightier,
    // premium, trustworthy" moment the palette reserves for this treatment.
    // Teal (clinical/tech/trustworthy) accents the encryption/tech details.
    <section className="py-20 bg-gradient-to-br from-gray-800 to-gray-900">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}
          className="max-w-4xl mx-auto text-center">
          <motion.div variants={fadeUp}>
            <div className="w-14 h-14 rounded-2xl bg-teal-700 text-teal-100 flex items-center justify-center mx-auto mb-6"><IconShield /></div>
            <span className="text-teal-300 font-semibold text-sm tracking-widest uppercase">Privacy First</span>
            <h2 className="font-heading text-4xl font-medium text-eggshell mt-3 mb-5">Your face is never stored. Ever.</h2>
            <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
              Skin analysis is deeply personal. Your photos are processed ephemerally and permanently deleted after analysis.
            </p>
          </motion.div>
          <motion.div variants={stagger} className="grid sm:grid-cols-3 gap-6">
            {[
              { icon:"🔒", title:"Ephemeral Processing", desc:"Photos analysed in memory, never written to disk or cloud. No image database, ever." },
              { icon:"🛡️", title:"End-to-End Encrypted",  desc:"TLS 1.3 in transit. AES-256 at rest. We can't read your data without your keys." },
              { icon:"🗑️", title:"Right to be Forgotten", desc:"Delete your account anytime. All data permanently erased within 24 hours." },
            ].map(({ icon, title, desc }) => (
              <motion.div key={title} variants={fadeUp} className="p-6 rounded-xl bg-gray-700/40 border border-teal-700/40 text-left">
                <span className="text-3xl mb-4 block">{icon}</span>
                <h4 className="font-semibold text-eggshell mb-2">{title}</h4>
                <p className="text-sm text-gray-300 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
          <motion.p variants={fadeUp} className="mt-10 text-sm text-gray-300">
            Compliant with India's <strong className="text-teal-200">DPDPA 2023</strong> and GDPR.{" "}
            <Link href="/privacy" className="text-teal-200 hover:underline">Read our Privacy Policy →</Link>
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  { q:"Is SkinAI free to use?",           a:"Yes — creating an account and running a full AI skin analysis is completely free. You get your personalised routine, dermatologist review, and progress tracking at no cost." },
  { q:"How accurate is the AI analysis?", a:"Our models achieve 95%+ accuracy on controlled test sets across 15 skin conditions. Every AI report is also reviewed by a certified dermatologist before delivery, adding clinical validation." },
  { q:"Does my photo get stored?",         a:"No. Your scan photo is processed ephemerally — analysed in server memory, then immediately discarded. Only the structured analysis results are stored with your account." },
  { q:"What skin conditions can SkinAI detect?", a:"Acne (all grades), hyperpigmentation, melasma, rosacea, seborrheic dermatitis, dry skin, oily skin, open pores, fine lines, wrinkles, dark circles, puffiness — 15+ conditions with severity scoring." },
  { q:"Are products available in India?",  a:"Yes. All recommendations are sourced from brands available in India — Nykaa, Minimalist, Dermaco, Dot & Key, The Ordinary, Cetaphil, La Roche-Posay, and more." },
  { q:"How are dermatologists involved?", a:"Every completed scan creates a case in our dermatologist review queue. A certified dermatologist reviews within 24–48 hours and can approve, add notes, flag concerns, or escalate for in-person consultation." },
];

function FAQSection() {
  const [open, setOpen] = useState<number|null>(null);
  return (
    <section id="faq" className="py-24 bg-skin-50">
      <div className="container mx-auto px-6">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}
          className="max-w-3xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <span className="text-skin-500 font-semibold text-sm tracking-widest uppercase">FAQ</span>
            <h2 className="font-heading text-4xl font-medium text-gray-900 mt-3">Common Questions</h2>
          </motion.div>
          <div className="space-y-3">
            {FAQS.map(({ q, a }, i) => (
              <motion.div key={q} variants={fadeUp}>
                <button className="w-full flex items-start justify-between gap-4 p-6 rounded-xl bg-white border border-skin-100 text-left hover:border-skin-400 hover:shadow-sm transition-all"
                  onClick={() => setOpen(open === i ? null : i)}>
                  <span className="font-semibold text-gray-900 text-sm leading-relaxed">{q}</span>
                  <span className="text-skin-500 flex-shrink-0"><IconChevron open={open === i} /></span>
                </button>
                <AnimatePresence>
                  {open === i && (
                    <motion.div initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }} exit={{ height:0, opacity:0 }}
                      transition={{ duration:0.25 }} className="overflow-hidden">
                      <div className="px-6 pb-6 pt-2 bg-white rounded-b-xl border-x border-b border-skin-100 -mt-2 text-sm text-gray-500 leading-relaxed">{a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="relative py-28 overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <Image src={PX(3762405, 1400, 700)} alt="Background — glowing skin" fill className="object-cover object-center" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-skin-600/95 to-skin-800/90" />
      </div>

      <div className="container relative z-10 mx-auto px-6 text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once:true, margin:"-80px" }} variants={stagger}>
          <motion.h2 variants={fadeUp} className="font-heading text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Your skin deserves<br />better than guesswork.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-xl text-skin-100 mb-10 max-w-xl mx-auto">
            Join thousands who have discovered their personalised skincare routine with SkinAI. Free. Private. Science-backed.
          </motion.p>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="bg-white text-skin-700 hover:bg-skin-50 text-base px-10 h-12 font-semibold shadow-xl" asChild>
              <Link href="/register">Create Free Account →</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10 text-base px-10 h-12" asChild>
              <Link href="/login">Already have an account</Link>
            </Button>
          </motion.div>
          <motion.p variants={fadeUp} className="text-skin-200 text-sm">No credit card · No ads · No selling your data</motion.p>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    // Twilight-indigo dark band, per the palette's role mapping — footer is
    // the one section the spec names explicitly as requiring this treatment.
    <footer className="bg-gray-900 text-gray-300 py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-skin-400 to-skin-500 flex items-center justify-center">
                <span className="text-eggshell text-sm font-bold">S</span>
              </div>
              <span className="font-heading font-bold text-xl text-eggshell">SkinAI</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs mb-4 text-gray-300">AI-powered skin analysis for India. Personalised routines reviewed by real dermatologists — free, private, built for Indian skin.</p>
            <p className="text-xs text-gray-500">Made with care in India 🇮🇳</p>
          </div>
          <div>
            <h5 className="text-eggshell font-semibold text-sm mb-4">Platform</h5>
            <ul className="space-y-3 text-sm">
              {[["#about","About SkinAI"],["#how-it-works","How It Works"],["#features","Features"],["#faq","FAQ"]].map(([h,l]) => (
                <li key={h}><a href={h} className="hover:text-eggshell transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h5 className="text-eggshell font-semibold text-sm mb-4">Account</h5>
            <ul className="space-y-3 text-sm">
              {[["/register","Create Account"],["/login","Sign In"],["/register/dermatologist","Join as Dermatologist"],["/privacy","Privacy Policy"]].map(([h,l]) => (
                <li key={h}><Link href={h} className="hover:text-eggshell transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} SkinAI. All rights reserved.</p>
          <p className="text-xs text-gray-500">Not a substitute for professional medical advice. Always consult a qualified dermatologist for serious conditions.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <StatsSection />
        <ConditionsSection />
        <AboutSection />
        <WhyWeBuiltSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ForEveryoneSection />
        <TestimonialsSection />
        <PrivacySection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
