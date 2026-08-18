"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { Sparkles, User as UserIcon, ArrowLeft, LogOut, ShieldCheck, MapPin, Calendar, Heart } from "lucide-react";

import { userApi } from "@/lib/api/user";
import type { UserWithProfile, UserProfileUpdatePayload } from "@/lib/api/user";
import { getLatestRecommendation, type RecommendationDetail } from "@/lib/api/recommendations";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskEmail } from "@/lib/utils";

const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"] as const;

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-cream/80 animate-pulse border border-deep-brown/10" />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [latestRec, setLatestRec] = useState<RecommendationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<UserProfileUpdatePayload>({});

  useEffect(() => {
    Promise.all([
      userApi.getMe(),
      getLatestRecommendation().catch(() => null),
    ])
      .then(([userData, recData]) => {
        setUser(userData);
        setLatestRec(recData);
        setForm({
          date_of_birth: userData.profile?.date_of_birth ?? null,
          gender: userData.profile?.gender ?? null,
          city: userData.profile?.city ?? null,
          state: userData.profile?.state ?? null,
          country: userData.profile?.country ?? "India",
        });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await userApi.updateMe(form);
      setUser(updated);
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton />;

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center font-sans">
        <p className="text-deep-brown/70">Could not load your profile.</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-sm text-olive underline font-bold">
          Try again
        </button>
      </div>
    );
  }

  const initial = user.full_name?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="min-h-screen bg-cream text-deep-brown font-sans pb-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-deep-brown/15 pb-6">
          <div className="flex items-center gap-4">
            {/* Prominent, high-contrast User Avatar Logo */}
            <div className="w-14 h-14 rounded-2xl bg-deep-brown text-butter font-serif font-extrabold text-2xl flex items-center justify-center shadow-md border border-deep-brown/20 shrink-0">
              {initial}
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-deep-brown">{user.full_name}</h1>
              <p className="text-xs font-sans font-semibold text-deep-brown/60">{maskEmail(user.email)}</p>
            </div>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-xs font-bold text-olive hover:text-olive/80 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>

        {/* Auto-Detected Skin Profile Card (No manual dropdown needed) */}
        <div className="bg-white rounded-3xl p-6 border border-deep-brown/15 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-olive flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-olive" /> Auto-Detected Skin Profile
            </p>
            <span className="text-[11px] font-mono font-semibold bg-butter/60 text-deep-brown px-2.5 py-0.5 rounded-full border border-deep-brown/15">
              AI Analysis Active
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="bg-cream px-4 py-2.5 rounded-2xl border border-deep-brown/10 flex items-center gap-2">
              <span className="text-xs text-deep-brown/60 font-medium">Skin Tone:</span>
              <span className="font-serif font-bold text-deep-brown text-sm">
                {latestRec?.fitzpatrick_tone ? `Skin Tone · ${latestRec.fitzpatrick_tone}` : user.profile?.skin_tone_category ? `Type ${user.profile.skin_tone_category}` : "Auto-detected via Face Scan"}
              </span>
            </div>

            {latestRec?.skin_type && (
              <div className="bg-cream px-4 py-2.5 rounded-2xl border border-deep-brown/10 flex items-center gap-2">
                <span className="text-xs text-deep-brown/60 font-medium">Skin Type:</span>
                <span className="font-serif font-bold text-deep-brown text-sm capitalize">
                  {latestRec.skin_type} Skin
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-deep-brown/70 leading-relaxed pt-1">
            Your skin type and Fitzpatrick tone scale are collected automatically when you complete a face scan or questionnaire — no manual selection required.
          </p>
        </div>

        {/* Personal Details Form */}
        <div className="bg-white rounded-3xl p-6 border border-deep-brown/15 shadow-xs space-y-5">
          <h2 className="font-serif text-xl font-bold text-deep-brown">Personal Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="profile-dob" className="text-xs font-bold text-deep-brown mb-1 block">Date of Birth</Label>
              <Input
                id="profile-dob"
                type="date"
                value={form.date_of_birth ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value || null }))}
                className="bg-cream border-deep-brown/20 text-deep-brown text-sm rounded-xl focus:ring-olive"
              />
            </div>

            <div>
              <Label htmlFor="profile-gender" className="text-xs font-bold text-deep-brown mb-1 block">Gender</Label>
              <select
                id="profile-gender"
                value={form.gender ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value || null }))}
                className="flex h-10 w-full rounded-xl border border-deep-brown/20 bg-cream px-3 py-2 text-sm text-deep-brown focus:outline-none focus:ring-2 focus:ring-olive"
              >
                <option value="">Prefer not to say</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="profile-city" className="text-xs font-bold text-deep-brown mb-1 block">City</Label>
              <Input
                id="profile-city"
                value={form.city ?? ""}
                placeholder="e.g. Mumbai"
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value || null }))}
                className="bg-cream border-deep-brown/20 text-deep-brown text-sm rounded-xl focus:ring-olive"
              />
            </div>

            <div>
              <Label htmlFor="profile-state" className="text-xs font-bold text-deep-brown mb-1 block">State</Label>
              <Input
                id="profile-state"
                value={form.state ?? ""}
                placeholder="e.g. Maharashtra"
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value || null }))}
                className="bg-cream border-deep-brown/20 text-deep-brown text-sm rounded-xl focus:ring-olive"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="profile-country" className="text-xs font-bold text-deep-brown mb-1 block">Country</Label>
              <Input
                id="profile-country"
                value={form.country ?? "India"}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                className="bg-cream border-deep-brown/20 text-deep-brown text-sm rounded-xl focus:ring-olive"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-butter text-deep-brown px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider border border-deep-brown/15 shadow-xs hover:bg-butter/80 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Account settings */}
        <div className="bg-white rounded-3xl p-6 border border-deep-brown/15 shadow-xs space-y-3">
          <h2 className="font-serif text-lg font-bold text-deep-brown">Account Management</h2>
          <p className="text-xs text-deep-brown/70">
            Signed in as <span className="font-bold text-deep-brown">{session?.user?.email ? maskEmail(session.user.email) : ""}</span>
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-deep-brown/10">
            <Link href="/privacy" className="text-xs text-olive hover:underline font-bold">
              Privacy Policy →
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-bold"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
