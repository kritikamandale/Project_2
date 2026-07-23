import Link from "next/link";

export const metadata = { title: "Terms of Service — Skinest" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-skin-50 via-white to-skin-100/40">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-base leading-none">S</span>
          </div>
          <span className="font-bold text-lg text-skin-800">Skinest</span>
        </Link>

        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-zinc-400 mb-10">Effective date: June 2025 · Last updated: June 2025</p>

        <div className="prose prose-zinc max-w-none space-y-8 text-zinc-700 text-sm leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">1. Acceptance of Terms</h2>
            <p>By creating an account or using Skinest (&ldquo;the Service&rdquo;), you agree to these Terms of Service and our <Link href="/privacy" className="text-skin-600 hover:underline">Privacy Policy</Link>. If you do not agree, do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">2. Nature of the Service</h2>
            <p>Skinest provides AI-powered skin analysis and personalised skincare recommendations for informational purposes only. The Service is <strong>not a substitute for professional medical advice, diagnosis, or treatment</strong>. Always consult a qualified dermatologist or physician for any medical concerns.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">3. Eligibility</h2>
            <p>You must be at least 13 years old to use Skinest. If you are under 18, you represent that your parent or legal guardian has reviewed and agreed to these Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">4. Account Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree to provide accurate and complete information during registration.</li>
              <li>You must notify us immediately of any unauthorised use of your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">5. Privacy &amp; Biometric Data</h2>
            <p>Skinest processes your facial images locally on your device. Only anonymised skin characteristics (not raw images) are transmitted to our servers. Your data is handled in accordance with our <Link href="/privacy" className="text-skin-600 hover:underline">Privacy Policy</Link> and India&apos;s Digital Personal Data Protection (DPDP) Act, 2023.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Service for any unlawful purpose.</li>
              <li>Attempt to reverse-engineer, scrape, or misuse the AI models.</li>
              <li>Upload content that is fraudulent, harmful, or violates third-party rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">7. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, Skinest and its operators are not liable for any indirect, incidental, or consequential damages arising from your use of the Service or reliance on any recommendations provided.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">8. Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify registered users of material changes via email. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">9. Governing Law</h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of India.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">10. Contact</h2>
            <p>For questions about these Terms, email us at <a href="mailto:legal@skinest.in" className="text-skin-600 hover:underline">legal@skinest.in</a>.</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-zinc-100 flex gap-4 text-xs text-zinc-400">
          <Link href="/privacy" className="hover:text-skin-600 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-skin-600 transition-colors">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
