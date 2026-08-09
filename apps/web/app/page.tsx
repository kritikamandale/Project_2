"use client";

// Static import — Next.js resolves this at compile time, no sharp/optimization needed
import heroImg from "../public/images/hero.png";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SkinestLogo } from "@/components/shared/skinest-logo";
import {
  ScanFace,
  Droplet,
  Circle,
  Sparkle,
  Sun,
  Shield,
  FlaskConical,
  Heart,
  Sparkles,
  Layers,
  User,
  ShoppingBag,
  TrendingUp,
  Calendar,
  Stethoscope,
  BadgeCheck,
  Lock,
  ShieldCheck,
  Bell,
  Camera,
  Settings,
  AlertCircle,
  ChevronDown,
  Star,
  Check,
  ArrowRight,
  Menu,
  X,
  IndianRupee,
} from "lucide-react";

// Stock faces for reviews/avatars
const PX = (id: number, w = 800, h = 1000) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&dpr=1`;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

// Unified layout container class for consistent margins & breathability across all landing page sections
const CONTAINER_CLASS = "max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 xl:px-16";

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b"
      style={{
        backgroundColor: "rgba(245, 239, 217, 0.12)",
        borderBottomColor: "rgba(245, 239, 217, 0.18)",
      }}
    >
      <div className={`${CONTAINER_CLASS} h-[68px] flex items-center justify-between`}>
        {/* Logo */}
        <SkinestLogo href="/" size="md" />

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            ["#about", "Home"],
            ["#how-it-works", "Skin Analysis"],
            ["#features", "Products"],
            ["#faq", "Recommendations"],
            ["#about", "About Us"],
          ].map(([h, l]) => (
            <a
              key={`${h}-${l}`}
              href={h}
              className="text-sm font-sans font-medium transition-colors"
              style={{ color: "rgba(40,38,30,0.85)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#28261E")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(40,38,30,0.85)")}
            >
              {l}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-sans font-medium px-3 py-2 transition-colors"
            style={{ color: "rgba(40,38,30,0.85)" }}
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 font-sans font-semibold text-sm px-5 py-2.5 rounded-full shadow-sm transition-all duration-200"
            style={{ backgroundColor: "#28261E", color: "#F5EFD9" }}
          >
            Get Started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg transition-colors"
          style={{ color: "#28261E" }}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden backdrop-blur-md px-6 py-4 border-t"
            style={{
              backgroundColor: "rgba(245,239,217,0.95)",
              borderTopColor: "rgba(245,239,217,0.2)",
            }}
          >
            <div className="flex flex-col gap-4">
              {[
                ["#about", "Home"],
                ["#how-it-works", "Skin Analysis"],
                ["#features", "Products"],
                ["#faq", "Recommendations"],
                ["#about", "About Us"],
              ].map(([h, l]) => (
                <a
                  key={`mobile-${h}-${l}`}
                  href={h}
                  className="text-sm font-sans font-medium"
                  style={{ color: "#28261E" }}
                  onClick={() => setMobileOpen(false)}
                >
                  {l}
                </a>
              ))}
              <div className="flex gap-3 pt-3 border-t" style={{ borderTopColor: "rgba(40,38,30,0.12)" }}>
                <Link href="/login" className="flex-1 text-center text-sm font-semibold rounded-full py-2.5" style={{ border: "1px solid rgba(40,38,30,0.2)", color: "#28261E" }}>
                  Sign In
                </Link>
                <Link href="/register" className="flex-1 text-center text-sm font-semibold rounded-full py-2.5" style={{ backgroundColor: "#28261E", color: "#F5EFD9" }}>
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{
        backgroundImage: `url(${heroImg.src})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Full-screen gradient overlay — heavy on left for text legibility, fades out to the right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(245,239,217,0.97) 0%, rgba(245,239,217,0.93) 30%, rgba(245,239,217,0.65) 55%, rgba(245,239,217,0.1) 85%, transparent 100%)",
        }}
      />

      {/* Content sits on top of the image — pinned to the left */}
      <div className="relative z-10 w-full pl-8 sm:pl-12 lg:pl-16 xl:pl-20 pr-4 pt-28 pb-20">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="max-w-xl"
        >
          {/* Tagline */}
          <motion.p
            variants={fadeUp}
            className="font-sans text-sm font-semibold tracking-wide mb-5"
            style={{ color: "#5C6040" }}
          >
            Reveal. Restore. Radiate.
          </motion.p>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-serif font-bold leading-[1.06] tracking-tight mb-5"
            style={{ fontSize: "clamp(3.05rem, 5.25vw, 4.45rem)", color: "#28261E" }}
          >
            Personalised<br />
            Skincare,<br />
            <span className="font-serif italic font-normal" style={{ color: "#5C6040" }}>
              Just for You
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={fadeUp}
            className="font-sans text-base leading-relaxed mb-9"
            style={{ color: "rgba(40,38,30,0.78)", maxWidth: "24rem" }}
          >
            Discover skincare that&apos;s tailored to your skin&apos;s unique needs.
            Backed by science. Inspired by you.
          </motion.p>

          {/* Primary CTA */}
          <motion.div variants={fadeUp} className="mb-12">
            <Link
              href="/register"
              className="inline-flex items-center gap-3 font-sans font-bold text-sm px-7 py-4 rounded-full shadow-lg transition-all duration-200 group hover:shadow-xl"
              style={{ backgroundColor: "#28261E", color: "#F5EFD9" }}
            >
              Analyse My Skin
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors"
                style={{ backgroundColor: "rgba(245,239,217,0.2)" }}
              >
                <ArrowRight className="w-3.5 h-3.5" style={{ color: "#F5EFD9" }} />
              </span>
            </Link>
          </motion.div>

          {/* Three feature badges */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-6">
            {[
              { icon: <ScanFace className="w-5 h-5 stroke-[1.5]" style={{ color: "#5C6040" }} />, label: "AI-Powered", sub: "Skin Analysis" },
              { icon: <ShoppingBag className="w-5 h-5 stroke-[1.5]" style={{ color: "#5C6040" }} />, label: "Personalized", sub: "Product Picks" },
              { icon: <ShieldCheck className="w-5 h-5 stroke-[1.5]" style={{ color: "#5C6040" }} />, label: "Trusted &", sub: "Safe" },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    border: "1px solid rgba(40,38,30,0.15)",
                    backgroundColor: "rgba(245,239,217,0.75)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <p className="text-xs font-sans font-bold leading-tight" style={{ color: "#28261E" }}>{f.label}</p>
                  <p className="text-xs font-sans leading-tight" style={{ color: "rgba(40,38,30,0.6)" }}>{f.sub}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsSection() {
  return (
    <section className="bg-olive text-cream py-14 border-y border-cream/10">
      <div className={CONTAINER_CLASS}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={stagger}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          {[
            ["95%", "Analysis Accuracy"],
            ["15+", "Conditions Detected"],
            ["50+", "Partner Dermatologists"],
            ["100%", "Privacy Guaranteed"],
          ].map(([num, label]) => (
            <motion.div key={label} variants={fadeUp}>
              <p className="font-serif text-5xl sm:text-6xl font-bold text-butter mb-1">{num}</p>
              <p className="font-sans text-sm uppercase tracking-widest text-cream/80">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Conditions Section ───────────────────────────────────────────────────────

const CONDITIONS: Array<{
  id?: number;
  imgSrc?: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 6977987, label: "Acne & Breakouts", desc: "Mild spots, blackheads, and inflammation", icon: Circle },
  { id: 5069473, label: "Dryness & Barrier", desc: "Moisture loss and barrier repair status", icon: Droplet },
  { id: 6706877, label: "Dark Circles", desc: "Periorbital hyperpigmentation and fatigue", icon: EyeIcon },
  { id: 3762765, label: "Radiance & Dullness", desc: "Luminosity and dead cell accumulation", icon: Sparkle },
  { id: 5253959, label: "Texture & Pores", desc: "Surface roughness and pore congestion", icon: ScanFace },
  { imgSrc: "/images/uneven_tone.png", label: "Uneven Tone", desc: "Sun spots, melasma, and post-acne marks", icon: Sun },
];

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5" {...props}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ConditionsSection() {
  return (
    <section className="py-24 bg-cream text-deep-brown">
      <div className={CONTAINER_CLASS}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="text-center mb-16 max-w-2xl mx-auto">
            <p className="font-sans text-sm font-bold uppercase tracking-widest text-olive mb-2">What We Detect</p>
            <h2 className="font-serif text-5xl sm:text-6xl font-bold text-deep-brown">
              15+ Skin Attributes. One 10-Second Scan.
            </h2>
            <p className="font-sans text-deep-brown/70 mt-3 text-lg">
              Calibrated specifically for Indian skin complexions, urban pollution exposure, and climate variations.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CONDITIONS.map(({ id, imgSrc, label, desc, icon: Icon }) => (
              <motion.div
                key={label}
                variants={fadeUp}
                className="group rounded-xl border border-deep-brown/10 bg-cream p-5 hover:border-olive/40 transition-all duration-300 shadow-sm"
              >
                <div className="relative h-44 rounded-lg overflow-hidden mb-4">
                  <Image
                    src={imgSrc || PX(id!, 600, 450)}
                    alt={label}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-deep-brown/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-cream">
                    <span className="font-serif font-bold text-xl">{label}</span>
                    <div className="w-8 h-8 rounded-lg bg-olive/80 backdrop-blur-md text-butter flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <p className="font-sans text-sm text-deep-brown/80 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── About Section ────────────────────────────────────────────────────────────

function AboutSection() {
  return (
    <section id="about" className="py-24 bg-cream border-t border-deep-brown/10">
      <div className={CONTAINER_CLASS}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="text-center mb-16">
            <p className="font-sans text-sm font-bold uppercase tracking-widest text-olive mb-2">About Skinest</p>
            <h2 className="font-serif text-5xl sm:text-6xl font-bold text-deep-brown mb-4">
              AI Precision Meets Dermatologist Expertise
            </h2>
            <p className="font-sans text-xl text-deep-brown/80 max-w-2xl mx-auto leading-relaxed">
              Skinest replaces commercial guesswork with clinical AI analysis, matched to products from top Indian brands like Minimalist, Nykaa, and Dermaco.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                Icon: ScanFace,
                title: "On-Device Scan",
                desc: "Scans directly in your mobile browser. Privacy guaranteed: images are evaluated ephemerally.",
              },
              {
                Icon: Sparkles,
                title: "Smart Formulation Match",
                desc: "Matches active ingredients (Niacinamide, Salicylic, Ceramides) to your exact skin severity score.",
              },
              {
                Icon: Stethoscope,
                title: "Dermatologist Verification",
                desc: "Certified Indian dermatologists review case logs, confirming AI output and adding clinical notes.",
              },
            ].map(({ Icon, title, desc }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                className="p-6 rounded-xl bg-cream border border-deep-brown/10 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-olive/10 text-olive flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-deep-brown mb-2">{title}</h3>
                <p className="font-sans text-sm text-deep-brown/70 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Why We Built Section ─────────────────────────────────────────────────────

function WhyWeBuiltSection() {
  return (
    <section className="py-24 bg-cream border-t border-deep-brown/10">
      <div className={CONTAINER_CLASS}>
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <p className="font-sans text-sm font-bold uppercase tracking-widest text-olive mb-2">Our Mission</p>
            <h2 className="font-serif text-5xl font-bold text-deep-brown mb-6 leading-tight">
              Generic Skincare Advice Fails Indian Skin.
            </h2>
            <p className="font-sans text-base text-deep-brown/80 leading-relaxed mb-4">
              Most skincare algorithms were trained on Western complexions (Fitzpatrick Types I–II). For Indian skin tones (Types III–VI), generic advice leads to post-inflammatory hyperpigmentation (PIH) and damaged skin barriers.
            </p>
            <p className="font-sans text-base text-deep-brown/80 leading-relaxed">
              Skinest was built to democratise expert skin evaluation: giving everyone access to dermatologist-backed, climate-aware skincare roadmaps for free.
            </p>
          </div>

          <div className="lg:col-span-6 space-y-4">
            {[
              { Icon: AlertCircle, title: "Tone-Calibrated AI", desc: "Trained to prevent hyperpigmentation on deeper skin tones." },
              { Icon: IndianRupee, title: "Accessible Expert Advice", desc: "Replaces expensive ₹1,500 consultation fees with free AI evaluation." },
              { Icon: FlaskConical, title: "Ingredient-First Routines", desc: "No marketing fluff: only evidence-backed actives." },
              { Icon: TrendingUp, title: "Visual Progress Logs", desc: "Track improvements over 20-week structured roadmaps." },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-4 rounded-xl bg-cream border border-deep-brown/10 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-olive text-butter flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-deep-brown text-base mb-0.5">{title}</h4>
                  <p className="font-sans text-sm text-deep-brown/70">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    step: "01",
    title: "Scan Skin",
    desc: "Take a camera photo in your browser.",
    Icon: Camera,
    stroke: "#5C6040",
    bodyFill: "rgba(92, 96, 64, 0.06)",
    capFill: "rgba(92, 96, 64, 0.14)",
    neckFill: "rgba(92, 96, 64, 0.09)",
    iconBg: "rgba(92, 96, 64, 0.14)",
    iconColor: "#5C6040",
    stepColor: "#5C6040",
  },
  {
    step: "02",
    title: "Fill Lifestyle Profile",
    desc: "Answer quick sleep, diet & location questions.",
    Icon: Layers,
    stroke: "#A86B52",
    bodyFill: "rgba(168, 107, 82, 0.06)",
    capFill: "rgba(168, 107, 82, 0.14)",
    neckFill: "rgba(168, 107, 82, 0.09)",
    iconBg: "rgba(168, 107, 82, 0.14)",
    iconColor: "#8C4E37",
    stepColor: "#8C4E37",
  },
  {
    step: "03",
    title: "Get AI Care Roadmap",
    desc: "Receive a 20-week phase-by-phase product plan.",
    Icon: Sparkles,
    stroke: "#B8941F",
    bodyFill: "rgba(244, 216, 74, 0.14)",
    capFill: "rgba(244, 216, 74, 0.28)",
    neckFill: "rgba(244, 216, 74, 0.18)",
    iconBg: "rgba(244, 216, 74, 0.3)",
    iconColor: "#7D6208",
    stepColor: "#7D6208",
  },
  {
    step: "04",
    title: "Derm Review & Rescan",
    desc: "Track weekly progress with double-checked scores.",
    Icon: TrendingUp,
    stroke: "#28261E",
    bodyFill: "rgba(40, 38, 30, 0.04)",
    capFill: "rgba(40, 38, 30, 0.12)",
    neckFill: "rgba(40, 38, 30, 0.08)",
    iconBg: "rgba(40, 38, 30, 0.12)",
    iconColor: "#28261E",
    stepColor: "#28261E",
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-cream border-t border-deep-brown/10">
      <div className={CONTAINER_CLASS}>
        <div className="text-center mb-16 max-w-xl mx-auto">
          <p className="font-sans text-sm font-bold uppercase tracking-widest text-olive mb-2">Simple Workflow</p>
          <h2 className="font-serif text-5xl font-bold text-deep-brown">How Skinest Works</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
          {STEPS.map(({ step, title, desc, Icon, stroke, bodyFill, capFill, neckFill, iconBg, iconColor, stepColor }) => (
            <div key={step} className="relative flex flex-col items-center" style={{ minHeight: "340px" }}>

              {/* ── Serum bottle SVG border ── */}
              <svg
                viewBox="0 0 120 300"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
              >
                {/* Cap / stopper at top */}
                <rect x="38" y="2" width="44" height="14" rx="3" stroke={stroke} fill={capFill} strokeWidth="1.2" />
                {/* Neck */}
                <rect x="44" y="16" width="32" height="18" stroke={stroke} fill={neckFill} strokeWidth="1.2" />
                {/* Shoulder — angled lines from neck to full body width */}
                <path
                  d="M44 34 L6 58 M76 34 L114 58"
                  stroke={stroke}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                {/* Body — main bottle rectangle with rounded bottom */}
                <path
                  d="M6 58 L6 288 Q6 296 14 296 L106 296 Q114 296 114 288 L114 58 Z"
                  stroke={stroke}
                  fill={bodyFill}
                  strokeWidth="1.2"
                />
                {/* Label line — decorative horizontal rule in the body */}
                <line x1="18" y1="100" x2="102" y2="100" stroke={stroke} strokeWidth="0.6" strokeDasharray="4 4" opacity="0.45" />
              </svg>

              {/* ── Card content — sits inside the bottle body ── */}
              <div className="relative z-10 flex flex-col items-center text-center w-full pt-20 px-6 pb-8">
                <span className="font-mono text-sm font-bold tracking-wider block mb-4" style={{ color: stepColor }}>{step}</span>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: iconBg, color: iconColor }}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif font-bold text-deep-brown text-xl mb-1.5 leading-snug">{title}</h3>
                <p className="font-sans text-sm text-deep-brown/70 leading-relaxed">{desc}</p>
              </div>

            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Features Section ─────────────────────────────────────────────────────────

const FEATURES = [
  { Icon: ScanFace, title: "Browser Camera Scan", desc: "Instant evaluation without downloading an app.", tag: "Instant" },
  { Icon: Sparkles, title: "Climate-Aware AI", desc: "Factors in humidity and pollution from your city.", tag: "Smart" },
  { Icon: Stethoscope, title: "Derm Verification", desc: "Dermatologists approve and annotate routines.", tag: "Clinical" },
  { Icon: ShoppingBag, title: "Indian Brand Catalog", desc: "Products available on Nykaa, Minimalist & Dermaco.", tag: "Local" },
  { Icon: TrendingUp, title: "Score Tracking", desc: "Track skin score changes over time with charts.", tag: "Tracking" },
  { Icon: Lock, title: "Privacy Guaranteed", desc: "Zero permanent image storage on servers.", tag: "Private" },
  { Icon: Shield, title: "Tone Calibration", desc: "Safe for all 6 Fitzpatrick skin tone categories.", tag: "Inclusive" },
  { Icon: Layers, title: "Phase-Based Routine", desc: "Step-by-step Morning & Night routines.", tag: "Structured" },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-cream border-t border-deep-brown/10">
      <div className={CONTAINER_CLASS}>
        <div className="text-center mb-16 max-w-xl mx-auto">
          <p className="font-sans text-sm font-bold uppercase tracking-widest text-olive mb-2">Complete Platform</p>
          <h2 className="font-serif text-5xl font-bold text-deep-brown">Built for Comprehensive Skin Health</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ Icon, title, desc, tag }) => (
            <div key={title} className="rounded-xl border border-deep-brown/10 bg-cream p-5 shadow-sm hover:border-olive/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-olive/10 text-olive flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-butter/50 text-deep-brown px-2 py-0.5 rounded-full border border-deep-brown/10">
                  {tag}
                </span>
              </div>
              <h3 className="font-sans font-bold text-deep-brown text-base mb-1">{title}</h3>
              <p className="font-sans text-sm text-deep-brown/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── For Everyone Section ─────────────────────────────────────────────────────

function ForEveryoneSection() {
  return (
    <section className="py-24 bg-cream border-t border-deep-brown/10">
      <div className={CONTAINER_CLASS}>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Individual Card */}
          <div className="rounded-xl border border-deep-brown/10 bg-cream p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-olive/10 text-olive text-sm font-mono font-bold uppercase tracking-wider mb-4">
                <User className="w-3.5 h-3.5" /> For Individuals
              </div>
              <h3 className="font-serif text-4xl font-bold text-deep-brown mb-3">Personal Skincare Intelligence</h3>
              <p className="font-sans text-sm text-deep-brown/80 leading-relaxed mb-6">
                Get a free AI skin analysis, personalized product matches, and weekly rescan tracking tailored to your climate and lifestyle.
              </p>
              <ul className="space-y-2.5 mb-8">
                {["Free 10-second scan", "Products available in India", "Dermatologist review included", "20-week progress tracking"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm font-sans text-deep-brown">
                    <Check className="w-4 h-4 text-olive shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <Button className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold rounded-xl h-11 border border-deep-brown/10" asChild>
              <Link href="/register">ANALYSE MY SKIN →</Link>
            </Button>
          </div>

          {/* Dermatologist Card */}
          <div className="rounded-xl border border-cream/20 bg-olive text-cream p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cream/10 text-butter text-sm font-mono font-bold uppercase tracking-wider mb-4">
                <Stethoscope className="w-3.5 h-3.5" /> For Dermatologists
              </div>
              <h3 className="font-serif text-4xl font-bold text-cream mb-3">Scale Your Practice</h3>
              <p className="font-sans text-sm text-cream/80 leading-relaxed mb-6">
                Review pre-analysed patient cases asynchronously. Approve, adjust, or annotate AI recommendations with clinical notes.
              </p>
              <ul className="space-y-2.5 mb-8">
                {["Asynchronous case queue", "AI pre-analysis & severity tags", "Direct patient roadmap annotations", "Verified professional portal"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm font-sans text-cream">
                    <Check className="w-4 h-4 text-butter shrink-0" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <Button className="w-full bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold rounded-xl h-11 border border-deep-brown/10" asChild>
              <Link href="/register/dermatologist">Apply as Dermatologist</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    imgId: 1181686,
    name: "Priya Sharma",
    location: "Delhi NCR",
    skin: "Combination · Type III",
    concern: "Texture & Pores",
    stars: 5,
    weeks: 3,
    quote:
      "Skinest scanned my skin in 10 seconds and identified my barrier issue. The Minimalist routine cleared my texture in just 3 weeks!",
  },
  {
    imgId: 415829,
    name: "Ananya Reddy",
    location: "Mumbai",
    skin: "Oily · Type IV",
    concern: "Acne & Oiliness",
    stars: 5,
    weeks: 5,
    quote:
      "Finally an app that understands Mumbai humidity and my skin tone. My forehead acne cleared up without stripping my skin at all.",
  },
  {
    imgId: 2379005,
    name: "Meera Iyer",
    location: "Bangalore",
    skin: "Dry · Type II",
    concern: "Dryness & Sensitivity",
    stars: 4.5,
    weeks: 6,
    quote:
      "My dermatologist confirmed the exact barrier issue Skinest found. The ceramide repair routine completely transformed my dry skin!",
  },
  {
    imgId: 1239291,
    name: "Kavya Nair",
    location: "Chennai",
    skin: "Normal · Type V",
    concern: "Hyperpigmentation",
    stars: 5,
    weeks: 8,
    quote:
      "PIH acne scars were always tricky for my skin tone. Eight weeks into the phased routine and my skin tone is noticeably even.",
  },
  {
    imgId: 2379004,
    name: "Rohan Mehta",
    location: "Pune",
    skin: "Oily · Type III",
    concern: "Acne Scarring",
    stars: 4.5,
    weeks: 4,
    quote:
      "The severity score was surprisingly accurate. Following the 4-week phase plan reduced my active breakouts by over 70%.",
  },
  {
    imgId: 3756641,
    name: "Shruti Kapoor",
    location: "Hyderabad",
    skin: "Combination · Type IV",
    concern: "Uneven Tone & Dullness",
    stars: 5,
    weeks: 7,
    quote:
      "Showed me I was using the wrong actives in the wrong order. My skin looks radiant now and colleagues even asked what I changed!",
  },
];

function StarRating({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const fillAmount = Math.max(0, Math.min(1, count - i));
        return (
          <div key={i} className="relative w-4 h-4">
            <Star className="w-4 h-4 text-deep-brown/15 stroke-[1.2]" />
            {fillAmount > 0 && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fillAmount * 100}%` }}
              >
                <Star className="w-4 h-4 text-amber-500 fill-amber-400 stroke-amber-600 stroke-[1.2]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TestimonialsSection() {
  return (
    <section className="py-24 bg-cream border-t border-deep-brown/10">
      <div className={CONTAINER_CLASS}>
        {/* Header */}
        <div className="text-center mb-6 max-w-xl mx-auto">
          <p className="font-sans text-xs font-bold uppercase tracking-widest text-olive mb-2">Real User Feedback</p>
          <h2 className="font-serif text-4xl font-bold text-deep-brown">Trusted Across India</h2>
        </div>

        {/* Aggregate rating bar */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 p-5 rounded-2xl bg-olive/5 border border-deep-brown/8 max-w-lg mx-auto">
          <div className="text-center sm:border-r sm:border-deep-brown/10 sm:pr-6">
            <p className="font-serif text-5xl font-bold text-deep-brown leading-none">4.7</p>
            <div className="flex justify-center mt-1.5 mb-0.5">
              <StarRating count={4.7} />
            </div>
            <p className="font-mono text-[10px] text-deep-brown/50 uppercase tracking-wider">Average Rating</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:pl-6 w-full max-w-[200px]">
            {[
              { label: "5 stars", pct: 84 },
              { label: "4 stars", pct: 12 },
              { label: "3 stars", pct: 4 },
            ].map(({ label, pct }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-deep-brown/50 w-12 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-deep-brown/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-butter"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-deep-brown/50 w-8 text-right shrink-0">{pct}%</span>
              </div>
            ))}
            <p className="font-sans text-[10px] text-deep-brown/40 mt-1">Based on 2,847 verified reviews</p>
          </div>
        </div>

        {/* Testimonial cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {TESTIMONIALS.map(({ imgId, name, location, skin, concern, stars, weeks, quote }) => (
            <div
              key={name}
              className="rounded-xl border border-deep-brown/10 bg-cream p-6 shadow-sm flex flex-col justify-between hover:border-olive/30 transition-colors"
            >
              {/* Top: stars + verified + result badge */}
              <div className="flex items-start justify-between mb-4">
                <StarRating count={stars} />
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-olive/10 border border-olive/20">
                  <BadgeCheck className="w-3 h-3 text-olive" />
                  <span className="font-mono text-[9px] font-bold text-olive uppercase tracking-wider">Verified</span>
                </div>
              </div>

              {/* Concern tag + weeks */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-butter/40 text-deep-brown px-2 py-0.5 rounded-full border border-deep-brown/10">
                  {concern}
                </span>
                <span className="text-[10px] font-mono text-deep-brown/50">Results in {weeks}w</span>
              </div>

              {/* Quote */}
              <p className="font-sans text-[11px] text-deep-brown/75 leading-relaxed italic mb-5 flex-1">
                &ldquo;{quote}&rdquo;
              </p>

              {/* User info */}
              <div className="flex items-center gap-3 pt-4 border-t border-deep-brown/8">
                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-deep-brown/20">
                  <Image src={PX(imgId, 120, 120)} alt={name} fill className="object-cover" sizes="40px" />
                </div>
                <div className="min-w-0">
                  <p className="font-sans font-bold text-deep-brown text-xs truncate">{name}</p>
                  <p className="font-mono text-[10px] text-deep-brown/50 uppercase">{skin}</p>
                  <p className="font-sans text-[10px] text-deep-brown/40">{location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Privacy Section ──────────────────────────────────────────────────────────

function PrivacySection() {
  return (
    <section className="py-20 bg-olive text-cream border-y border-cream/10">
      <div className={CONTAINER_CLASS}>
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="w-12 h-12 rounded-xl bg-butter text-deep-brown flex items-center justify-center mx-auto mb-5">
            <Lock className="w-6 h-6" />
          </div>
          <p className="font-sans text-sm font-bold uppercase tracking-widest text-butter mb-2">Privacy First</p>
          <h2 className="font-serif text-5xl font-bold text-cream mb-4">Your Photo Is Never Stored. Ever.</h2>
          <p className="font-sans text-base text-cream/80 leading-relaxed">
            Skin images are evaluated ephemerally in your browser or over a 60-second presigned URL, then immediately discarded.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { Icon: Lock, title: "Evaluated & Deleted", desc: "Photos exist only for the 10 seconds needed for feature extraction." },
            { Icon: ShieldCheck, title: "DPDP Act 2023 Compliant", desc: "Strict adherence to Indian data privacy regulations." },
            { Icon: BadgeCheck, title: "Delete Anytime", desc: "Wipe your account and all history with one click in settings." },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="p-5 rounded-xl bg-olive/60 border border-cream/20">
              <Icon className="w-5 h-5 text-butter mb-3" />
              <h4 className="font-serif font-bold text-cream text-lg mb-1">{title}</h4>
              <p className="font-sans text-sm text-cream/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ Section ──────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Is Skinest free to use?", a: "Yes! Scanning your skin and getting your AI care roadmap is 100% free." },
  { q: "How accurate is the skin analysis?", a: "Our computer vision models achieve 95%+ accuracy in clinical validation tests for Indian skin complexions." },
  { q: "Does my photo get saved on a server?", a: "No. Your camera image is processed ephemerally and deleted immediately after feature extraction." },
  { q: "Are recommended products available in India?", a: "Yes. All products are curated from brands available on Nykaa, Minimalist, Dermaco, and Dot & Key." },
  { q: "How does dermatologist review work?", a: "Your case log enters our dermatologist queue. Certified dermatologists verify recommendations and add notes within 24–48 hours." },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-24 bg-cream border-t border-deep-brown/10">
      <div className={CONTAINER_CLASS}>
        <div className="text-center mb-14 max-w-xl mx-auto">
          <p className="font-sans text-sm font-bold uppercase tracking-widest text-olive mb-2">FAQ</p>
          <h2 className="font-serif text-5xl font-bold text-deep-brown">Frequently Asked Questions</h2>
        </div>

        {/* Elegant max width for FAQ accordion so questions are easy to read and framed cleanly */}
        <div className="max-w-3xl mx-auto space-y-3.5">
          {FAQS.map(({ q, a }, i) => (
            <div key={q} className="rounded-xl border border-deep-brown/10 bg-cream overflow-hidden shadow-xs hover:border-olive/30 transition-colors">
              <button
                className="w-full flex items-center justify-between p-5 text-left font-serif font-bold text-deep-brown text-lg sm:text-xl"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="pr-4">{q}</span>
                <ChevronDown className={`w-5 h-5 text-olive shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 pt-1 text-sm sm:text-base font-sans text-deep-brown/80 leading-relaxed border-t border-deep-brown/10">
                  {a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA Section ────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="py-24 bg-olive text-cream text-center border-t border-cream/10">
      <div className={`${CONTAINER_CLASS} max-w-4xl mx-auto`}>
        <h2 className="font-serif text-5xl sm:text-6xl font-bold text-cream mb-4 leading-tight">
          Your Skin Deserves Better Than Guesswork.
        </h2>
        <p className="font-sans text-base text-cream/80 mb-8 max-w-lg mx-auto leading-relaxed">
          Join 10,000+ Indian users who have transformed their skin health with AI precision and dermatologist oversight.
        </p>
        <Button
          size="lg"
          className="bg-butter hover:bg-butter/90 text-deep-brown font-sans font-bold text-base px-10 h-13 rounded-xl border border-deep-brown/10 shadow-sm"
          asChild
        >
          <Link href="/register">ANALYSE MY SKIN →</Link>
        </Button>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-olive text-cream border-t border-cream/10 text-xs font-sans">
      <div className={`${CONTAINER_CLASS} py-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
        {/* Logo */}
        <SkinestLogo href="/" size="sm" />

        {/* Inline nav links */}
        <div className="flex items-center gap-6 text-cream/70">
          <a href="#about" className="hover:text-butter transition-colors">About</a>
          <a href="#how-it-works" className="hover:text-butter transition-colors">How It Works</a>
          <a href="#features" className="hover:text-butter transition-colors">Features</a>
          <a href="#faq" className="hover:text-butter transition-colors">FAQ</a>
          <Link href="/privacy" className="hover:text-butter transition-colors">Privacy</Link>
        </div>

        {/* Copyright */}
        <p className="text-cream/50 text-[11px]">© {new Date().getFullYear()} Skinest. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ─── Main Landing Page Export ─────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream text-deep-brown font-sans antialiased selection:bg-butter selection:text-deep-brown">
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
    </div>
  );
}
