"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";

import { userApi } from "@/lib/api/user";
import type { UserWithProfile, UserProfileUpdatePayload } from "@/lib/api/user";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const GENDERS = ["female", "male", "non_binary", "prefer_not_to_say"] as const;
const SKIN_TONES = ["I", "II", "III", "IV", "V", "VI"] as const;

function Skeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-gradient-to-r from-zinc-100 via-zinc-50 to-zinc-100 animate-pulse" />
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [user, setUser] = useState<UserWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<UserProfileUpdatePayload>({});

  useEffect(() => {
    userApi
      .getMe()
      .then((data) => {
        setUser(data);
        setForm({
          date_of_birth: data.profile?.date_of_birth ?? null,
          gender: data.profile?.gender ?? null,
          city: data.profile?.city ?? null,
          state: data.profile?.state ?? null,
          country: data.profile?.country ?? "India",
          skin_tone_category: data.profile?.skin_tone_category ?? null,
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
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton />;

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-zinc-500">Could not load your profile.</p>
        <button onClick={() => window.location.reload()} className="mt-2 text-sm text-skin-600 underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-skin-50/80 via-white to-teal-50/40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-skin-400 to-skin-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {user.full_name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold text-zinc-900">{user.full_name}</h1>
              <p className="text-sm text-zinc-400">{user.email}</p>
            </div>
          </div>
          <Link href="/dashboard" className="text-sm text-skin-600 hover:text-skin-700 font-medium">
            ← Dashboard
          </Link>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-5">
          <h2 className="font-heading text-lg font-bold text-zinc-800">Personal details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="profile-dob">Date of birth</Label>
              <Input
                id="profile-dob"
                type="date"
                value={form.date_of_birth ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value || null }))}
              />
            </div>

            <div>
              <Label htmlFor="profile-gender">Gender</Label>
              <select
                id="profile-gender"
                value={form.gender ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value || null }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
              <Label htmlFor="profile-city">City</Label>
              <Input
                id="profile-city"
                value={form.city ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value || null }))}
              />
            </div>

            <div>
              <Label htmlFor="profile-state">State</Label>
              <Input
                id="profile-state"
                value={form.state ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value || null }))}
              />
            </div>

            <div>
              <Label htmlFor="profile-country">Country</Label>
              <Input
                id="profile-country"
                value={form.country ?? "India"}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="profile-skin-tone">Skin tone (Fitzpatrick scale)</Label>
              <select
                id="profile-skin-tone"
                value={form.skin_tone_category ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    skin_tone_category: (e.target.value || null) as UserProfileUpdatePayload["skin_tone_category"],
                  }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">Not set</option>
                {SKIN_TONES.map((t) => (
                  <option key={t} value={t}>
                    Type {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 mt-6 space-y-3">
          <h2 className="font-heading text-lg font-bold text-zinc-800">Account</h2>
          <p className="text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-700">{session?.user?.email}</span>
          </p>
          <Link href="/privacy" className="text-sm text-skin-600 hover:text-skin-700 font-medium block">
            Privacy policy →
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
