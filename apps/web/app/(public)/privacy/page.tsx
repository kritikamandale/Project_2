import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Database, Eye, Trash2, Download, Mail, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Skinest",
  description:
    "How Skinest collects, uses, and protects your personal and biometric data under the DPDP Act 2023.",
};

const LAST_UPDATED = "10 June 2026";
const CONTACT_EMAIL = "privacy@yourdomain.com";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-teal-100 dark:bg-teal-900/30 p-2">
              <ShieldCheck className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          </div>
          <p className="text-muted-foreground">
            Last updated: {LAST_UPDATED} · Governed by the{" "}
            <strong>Digital Personal Data Protection (DPDP) Act 2023</strong> (India)
            and GDPR Article 9 (biometric data).
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          {/* 1 — Who we are */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-primary">1.</span> Who We Are
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Skinest is an AI-powered skin analysis and personalised skincare recommendation
              platform designed for Indian users. We are the <strong>Data Fiduciary</strong>{" "}
              under the DPDP Act 2023 and the <strong>Data Controller</strong> under GDPR.
              Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>
            </p>
          </section>

          {/* 2 — What we collect */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <span><span className="text-primary">2.</span> What We Collect</span>
            </h2>
            <div className="space-y-4">
              <DataTable rows={[
                ["Email address", "Account creation, verification OTPs, notifications", "2 years after last login"],
                ["Full name", "Personalised recommendations", "2 years after last login"],
                ["City / state", "Climate-aware skincare recommendations", "2 years after last login"],
                ["Date of birth", "Age-appropriate recommendations", "2 years after last login"],
                ["Skin tone classification", "Bias-adjusted AI analysis", "2 years after last login"],
                ["512-dimension skin feature vector", "AI skin analysis (no image stored)", "1 year"],
                ["Lifestyle questionnaire answers", "Personalised recommendations", "2 years after last login"],
                ["IP address", "Security — rate limiting, audit logs", "90 days"],
                ["Device / browser (User-Agent)", "Security audit logs", "90 days"],
              ]} />
              <div className="rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 p-4">
                <p className="text-sm text-teal-800 dark:text-teal-300 font-medium flex items-start gap-2">
                  <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Raw face images are <strong>never stored</strong>. Your camera captures a
                  frame, our on-device model extracts a 512-number mathematical vector, and
                  the image is discarded immediately. The vector cannot be reverse-engineered
                  into a face image.</span>
                </p>
              </div>
            </div>
          </section>

          {/* 3 — How we use it */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <span><span className="text-primary">3.</span> How We Use Your Data</span>
            </h2>
            <ul className="space-y-2 text-muted-foreground">
              {[
                ["Provide AI skin analysis and product recommendations", "Contract performance"],
                ["Send email verification OTPs and security alerts", "Legitimate interest (security)"],
                ["Improve recommendation accuracy (aggregated, anonymised)", "Legitimate interest"],
                ["Fraud prevention and abuse detection", "Legitimate interest (security)"],
                ["Analytics on platform usage (PostHog — opt-in only)", "Consent"],
                ["Dermatologist review of high-risk cases", "Explicit consent at registration"],
              ].map(([purpose, basis], i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-teal-500 mt-0.5">✓</span>
                  <span><strong>{purpose}</strong> — Legal basis: {basis}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 4 — Your rights */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-primary">4.</span> Your Rights (DPDP Act 2023 &amp; GDPR)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <RightCard
                icon={<Eye className="h-4 w-4" />}
                title="Right to Access"
                desc="View all data held about you from Settings → Privacy."
              />
              <RightCard
                icon={<Download className="h-4 w-4" />}
                title="Right to Portability"
                desc="Download a ZIP of all your data in JSON format. Available in Settings → Privacy."
                href="/settings"
              />
              <RightCard
                icon={<Trash2 className="h-4 w-4" />}
                title="Right to Erasure"
                desc="Permanently delete your account and all associated data. Settings → Delete Account."
                href="/settings"
              />
              <RightCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Right to Correction"
                desc="Update your profile at any time in Settings → Profile."
                href="/settings"
              />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              To exercise any right, use the Settings page or email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>.
              We will respond within <strong>72 hours</strong> as required by the DPDP Act.
            </p>
          </section>

          {/* 5 — Data sharing */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              <span className="text-primary">5.</span> Who We Share Data With
            </h2>
            <DataTable rows={[
              ["Groq API", "AI recommendation generation", "No personal data sent — only anonymised skin profile"],
              ["Pinecone", "Product similarity search", "Only product embeddings — no user data"],
              ["AWS S3 (Mumbai region)", "Temporary document storage", "DPA in place; data never leaves ap-south-1"],
              ["SendGrid", "Transactional emails", "Email address only; DPA in place"],
              ["Sentry", "Error monitoring", "Stack traces only; PII scrubbing enabled"],
            ]} />
            <p className="mt-3 text-sm text-muted-foreground">
              We <strong>never sell, rent, or share</strong> your personal data with advertisers
              or data brokers.
            </p>
          </section>

          {/* 6 — Security */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              <span className="text-primary">6.</span> Security Measures
            </h2>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "Passwords hashed with bcrypt (cost 12) — plaintext never stored",
                "JWTs signed with RS256 — private key never leaves the server",
                "All data in transit encrypted with TLS 1.3",
                "PostgreSQL data encrypted at rest (AES-256)",
                "Admin access requires two-factor authentication (TOTP)",
                "IP allowlist on admin routes",
                "Audit log on every data-modifying action",
                "Annual penetration testing",
              ].map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 7 — Cookies */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              <span className="text-primary">7.</span> Cookies
            </h2>
            <DataTable rows={[
              ["next-auth.session-token", "Essential", "Authentication session — httpOnly, Secure, SameSite=Lax", "7 days"],
              ["__csrf", "Essential", "CSRF protection — double-submit pattern", "1 hour"],
              ["ph_*", "Analytics (opt-in)", "PostHog product analytics", "1 year"],
              ["skinest_cookie_consent", "Essential", "Stores your cookie preference", "1 year"],
            ]} headers={["Cookie", "Type", "Purpose", "Expiry"]} />
            <p className="mt-3 text-sm text-muted-foreground">
              You can change your cookie preference at any time via the consent banner
              or Settings → Privacy.
            </p>
          </section>

          {/* 8 — Changes */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              <span className="text-primary">8.</span> Changes to This Policy
            </h2>
            <p className="text-sm text-muted-foreground">
              We will notify you by email at least 30 days before any material change. The
              &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent revision.
              Continued use after changes constitutes acceptance.
            </p>
          </section>

          {/* Contact */}
          <section className="rounded-xl bg-muted/50 border border-border p-5">
            <h2 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Contact Our Privacy Team
            </h2>
            <p className="text-sm text-muted-foreground">
              For privacy requests, data subject access requests, or concerns:<br />
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline font-medium">
                {CONTACT_EMAIL}
              </a>
              <br />
              We respond within <strong>72 hours</strong>.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">← Back to Skinest</Link>
          <Link href="/settings" className="hover:text-foreground transition-colors">Manage Your Data</Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DataTable({
  rows,
  headers = ["Data", "Purpose", "Retention"],
}: {
  rows: string[][];
  headers?: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-medium text-foreground text-xs">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-muted/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RightCard({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href?: string;
}) {
  const content = (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-colors h-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <span className="font-medium text-sm text-foreground">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
