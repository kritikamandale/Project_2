"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  fetchClimatePreview,
  submitQuestionnaire,
  type AlcoholConsumption,
  type Bedtime,
  type ClimateProfile,
  type DairyConsumption,
  type DiagnosedCondition,
  type DietType,
  type ExerciseFrequency,
  type FruitsVeggies,
  type JunkFoodFrequency,
  type PollutionExposure,
  type QuestionnaireSubmitRequest,
  type RoutineStep,
  type SleepEnvironment,
  type SmokingStatus,
  type SpicyFoodFrequency,
  type StressSource,
  type SugarConsumption,
  type SunExposure,
  type SunscreenUse,
  type CleanserFrequency,
  type WaterHardness,
  type WorkEnvironment,
} from "@/lib/api/questionnaire";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "skin_analysis_questionnaire_draft";

const SECTIONS = [
  { id: 1, title: "Sleep & Recovery",      icon: "😴", shortTitle: "Sleep"     },
  { id: 2, title: "Hydration & Diet",      icon: "💧", shortTitle: "Diet"      },
  { id: 3, title: "Stress & Wellbeing",    icon: "🧘", shortTitle: "Stress"    },
  { id: 4, title: "Screen & Environment",  icon: "📱", shortTitle: "Screen"    },
  { id: 5, title: "Your Location",         icon: "🌍", shortTitle: "Location"  },
  { id: 6, title: "Skincare Routine",      icon: "✨", shortTitle: "Routine"   },
  { id: 7, title: "Health & Medical",      icon: "🏥", shortTitle: "Health"    },
  { id: 8, title: "Lifestyle & Habits",    icon: "🍽️", shortTitle: "Lifestyle" },
] as const;

const SECTION_WHY: Record<number, string> = {
  1: "Poor sleep increases cortisol, which triggers acne and dullness.",
  2: "Dairy and high sugar intake are the #1 dietary triggers for adult acne.",
  3: "Stress raises cortisol, directly worsening oily skin, acne, and eczema.",
  4: "Blue light and pollution accelerate skin aging and hyperpigmentation.",
  5: "UV levels and humidity in your city directly determine your skin's moisture and sun damage risk.",
  6: "Your current routine reveals gaps — we suggest what to add, not replace everything.",
  7: "Medical context helps us avoid recommendations that conflict with your treatment.",
  8: "Spicy food, alcohol, and late-night habits are among the top hidden drivers of skin inflammation.",
};

const INDIAN_CITIES = [
  "Agra","Ahmedabad","Allahabad","Amritsar","Aurangabad","Bangalore",
  "Bhopal","Chandigarh","Chennai","Coimbatore","Delhi","Dhanbad",
  "Faridabad","Ghaziabad","Guwahati","Gwalior","Howrah","Hubli-Dharwad",
  "Hyderabad","Indore","Jabalpur","Jaipur","Jodhpur","Kanpur",
  "Kochi","Kolkata","Kota","Lucknow","Ludhiana","Madurai",
  "Meerut","Mumbai","Mysore","Nagpur","Nashik","Navi Mumbai",
  "Patna","Prayagraj","Pune","Raipur","Rajkot","Ranchi",
  "Solapur","Srinagar","Surat","Thane","Thiruvananthapuram",
  "Vadodara","Varanasi","Vijayawada","Visakhapatnam",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Answers {
  sleepHours: number;
  sleepQuality: number;
  sleepConsistency: boolean | null;
  waterIntake: number;
  dietType: DietType | null;
  sugarConsumption: SugarConsumption | null;
  dairyConsumption: DairyConsumption | null;
  stressLevel: number;
  stressSource: StressSource[];
  exerciseFrequency: ExerciseFrequency | null;
  screenTime: number;
  workEnvironment: WorkEnvironment | null;
  pollutionExposure: PollutionExposure | null;
  city: string;
  waterHardness: WaterHardness | null;
  climateProfile: ClimateProfile | null;
  routineSteps: RoutineStep[];
  cleanserFrequency: CleanserFrequency | null;
  sunscreenUse: SunscreenUse | null;
  knownAllergens: string;
  currentProducts: string;
  diagnosedConditions: DiagnosedCondition[];
  medicationAffectsSkin: boolean | null;
  medicationName: string;
  // Section 8
  spicyFood: SpicyFoodFrequency | null;
  junkFood: JunkFoodFrequency | null;
  fruitsVeggies: FruitsVeggies | null;
  bedtime: Bedtime | null;
  phoneBeforeBed: boolean | null;
  sleepEnvironment: SleepEnvironment | null;
  sunExposure: SunExposure | null;
  smokingStatus: SmokingStatus | null;
  alcoholConsumption: AlcoholConsumption | null;
}

const DEFAULT_ANSWERS: Answers = {
  sleepHours: 7,
  sleepQuality: 3,
  sleepConsistency: null,
  waterIntake: 2,
  dietType: null,
  sugarConsumption: null,
  dairyConsumption: null,
  stressLevel: 3,
  stressSource: [],
  exerciseFrequency: null,
  screenTime: 6,
  workEnvironment: null,
  pollutionExposure: null,
  city: "",
  waterHardness: null,
  climateProfile: null,
  routineSteps: [],
  cleanserFrequency: null,
  sunscreenUse: null,
  knownAllergens: "",
  currentProducts: "",
  diagnosedConditions: [],
  medicationAffectsSkin: null,
  medicationName: "",
  // Section 8
  spicyFood: null,
  junkFood: null,
  fruitsVeggies: null,
  bedtime: null,
  phoneBeforeBed: null,
  sleepEnvironment: null,
  sunExposure: null,
  smokingStatus: null,
  alcoholConsumption: null,
};

type Phase = "resume-prompt" | "intro" | "section" | "submitting" | "done";

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

function ProgressBar({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 shadow-sm">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {SECTIONS.map((s, i) => {
            const isDone = completed.includes(s.id);
            const isCurrent = s.id === current;
            return (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    isCurrent
                      ? "bg-skin-600 text-white shadow-md scale-105"
                      : isDone
                      ? "bg-teal-100 text-teal-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <span className="text-sm leading-none">{isDone ? "✓" : s.icon}</span>
                  <span className="hidden sm:inline">{s.shortTitle}</span>
                </div>
                {i < SECTIONS.length - 1 && (
                  <div
                    className={`h-px w-3 rounded-full transition-colors ${
                      isDone ? "bg-teal-300" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-skin-500 rounded-full"
            animate={{ width: `${((current - 1) / 8) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}

function TimeEstimate({ section }: { section: number }) {
  const label =
    section <= 3 ? "About 5 minutes" : section <= 6 ? "About 2 minutes remaining" : "Almost done!";
  return <span className="text-xs text-gray-400 font-medium">⏱ {label}</span>;
}

// ---------------------------------------------------------------------------
// SectionIntroCard
// ---------------------------------------------------------------------------

function SectionIntroCard({
  section,
  onContinue,
}: {
  section: (typeof SECTIONS)[number];
  onContinue: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onContinue, 2200);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center min-h-[280px] text-center px-6 py-10"
    >
      <div className="text-6xl mb-4">{section.icon}</div>
      <h2 className="font-heading text-2xl font-bold text-gray-900 mb-2">{section.title}</h2>
      <p className="text-gray-500 max-w-sm text-sm leading-relaxed mb-6">
        {SECTION_WHY[section.id]}
      </p>
      <button
        onClick={onContinue}
        className="text-skin-600 text-sm font-medium underline underline-offset-2"
      >
        Skip intro →
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ClimateCard
// ---------------------------------------------------------------------------

function ClimateCard({ profile }: { profile: ClimateProfile }) {
  const zoneLabel: Record<string, string> = {
    tropical: "🌴 Tropical",
    arid: "🏜️ Arid",
    semi_arid: "🌾 Semi-Arid",
    temperate: "🌤️ Temperate",
    coastal: "🌊 Coastal",
  };
  const hardnessLabel: Record<string, string> = {
    soft: "Soft water",
    moderate: "Moderately hard",
    hard: "Hard water",
    very_hard: "Very hard water",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="mt-6 rounded-2xl bg-gradient-to-br from-teal-50 via-skin-50 to-cream-50 border border-skin-100 p-5 shadow-sm"
    >
      <p className="text-xs text-skin-500 font-semibold uppercase tracking-wider mb-2">
        Your Climate Profile
      </p>
      <p className="text-xl font-bold text-gray-900 mb-1">
        📍 {profile.city}, {profile.state}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {[
          { emoji: "🌡️", text: `${profile.avg_temperature_c}°C` },
          { emoji: "💧", text: `${profile.avg_humidity_pct}% humidity` },
          { emoji: "☀️", text: `UV ${profile.uv_index}` },
          ...(profile.water_hardness
            ? [{ emoji: "🪣", text: hardnessLabel[profile.water_hardness] }]
            : []),
        ].map(({ emoji, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-white/80 text-gray-700 border border-gray-200"
          >
            {emoji} {text}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-skin-100 text-skin-700">
          {zoneLabel[profile.climate_zone] ?? profile.climate_zone}
        </span>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

function RangeSlider({
  value,
  onChange,
  min,
  max,
  step,
  formatLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  formatLabel: (v: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-center text-3xl font-bold text-skin-600">{formatLabel(value)}</div>
      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-10"
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      >
        <SliderPrimitive.Track className="bg-gray-200 relative grow rounded-full h-2">
          <SliderPrimitive.Range className="absolute bg-skin-500 rounded-full h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block w-6 h-6 bg-white border-2 border-skin-500 rounded-full shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-skin-400 transition-shadow"
          aria-label="value"
        />
      </SliderPrimitive.Root>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card select primitives
// ---------------------------------------------------------------------------

function CardOption({
  emoji,
  label,
  sub,
  selected,
  onClick,
}: {
  emoji: string;
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 p-4 text-center transition-all active:scale-95 ${
        selected
          ? "border-skin-500 bg-skin-50 shadow-md"
          : "border-gray-200 bg-white hover:border-skin-200"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <span className={`text-sm font-semibold ${selected ? "text-skin-700" : "text-gray-800"}`}>
        {label}
      </span>
      {sub && <span className="text-xs text-gray-400 leading-tight">{sub}</span>}
    </button>
  );
}

function SingleSelect<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: { value: T; emoji: string; label: string; sub?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  cols?: number;
}) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <CardOption
          key={o.value}
          emoji={o.emoji}
          label={o.label}
          sub={o.sub}
          selected={value === o.value}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}

function MultiSelect<T extends string>({
  options,
  value,
  onChange,
  exclusive = [],
  cols = 2,
}: {
  options: { value: T; emoji: string; label: string; sub?: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  exclusive?: T[];
  cols?: number;
}) {
  const toggle = (v: T) => {
    if (exclusive.includes(v)) {
      onChange([v]);
      return;
    }
    const withoutExclusive = value.filter((x) => !exclusive.includes(x));
    const next = withoutExclusive.includes(v)
      ? withoutExclusive.filter((x) => x !== v)
      : [...withoutExclusive, v];
    onChange(next);
  };

  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <CardOption
          key={o.value}
          emoji={o.emoji}
          label={o.label}
          sub={o.sub}
          selected={value.includes(o.value)}
          onClick={() => toggle(o.value)}
        />
      ))}
    </div>
  );
}

function YesNoSelect({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => onChange(true)}
        className={`rounded-2xl border-2 p-4 font-semibold text-sm transition-all active:scale-95 ${
          value === true
            ? "border-teal-500 bg-teal-50 text-teal-700 shadow-md"
            : "border-gray-200 text-gray-700 hover:border-teal-200"
        }`}
      >
        ✅ {yesLabel}
      </button>
      <button
        onClick={() => onChange(false)}
        className={`rounded-2xl border-2 p-4 font-semibold text-sm transition-all active:scale-95 ${
          value === false
            ? "border-rose-400 bg-rose-50 text-rose-700 shadow-md"
            : "border-gray-200 text-gray-700 hover:border-rose-200"
        }`}
      >
        ❌ {noLabel}
      </button>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["", "😫 Very Poor", "😔 Poor", "😐 Okay", "😊 Good", "🌟 Excellent"];
  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className={`text-3xl transition-transform hover:scale-110 active:scale-95 ${
              star <= value ? "opacity-100" : "opacity-30"
            }`}
          >
            ⭐
          </button>
        ))}
      </div>
      {value > 0 && <p className="text-center text-sm text-gray-500">{labels[value]}</p>}
    </div>
  );
}

function QuestionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="font-semibold text-gray-800 text-sm leading-snug">{label}</p>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// City autocomplete
// ---------------------------------------------------------------------------

function CityAutocomplete({ value, onChange }: { value: string; onChange: (city: string) => void }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const filtered = INDIAN_CITIES.filter((c) =>
    c.toLowerCase().startsWith(query.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Start typing your city…"
        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-skin-400 focus:outline-none transition-colors"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {filtered.map((city) => (
            <li
              key={city}
              onMouseDown={() => {
                setQuery(city);
                onChange(city);
                setOpen(false);
              }}
              className="px-4 py-2.5 text-sm text-gray-700 hover:bg-skin-50 cursor-pointer"
            >
              📍 {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function Section1Sleep({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  return (
    <div className="space-y-8">
      <QuestionBlock label="How many hours of sleep do you get on average per night?">
        <RangeSlider value={answers.sleepHours} onChange={(v) => update("sleepHours", v)} min={3} max={10} step={0.5} formatLabel={(v) => `${v}h`} />
      </QuestionBlock>
      <QuestionBlock label="How would you rate your sleep quality?">
        <StarRating value={answers.sleepQuality} onChange={(v) => update("sleepQuality", v)} />
      </QuestionBlock>
      <QuestionBlock label="Do you wake up at roughly the same time every day?">
        <YesNoSelect value={answers.sleepConsistency} onChange={(v) => update("sleepConsistency", v)} yesLabel="Yes, consistent" noLabel="No, it varies" />
      </QuestionBlock>
    </div>
  );
}

function Section2Diet({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  return (
    <div className="space-y-8">
      <QuestionBlock label="How much water do you drink daily?">
        <RangeSlider value={answers.waterIntake} onChange={(v) => update("waterIntake", v)} min={0.5} max={4} step={0.5} formatLabel={(v) => `${v}L`} />
      </QuestionBlock>
      <QuestionBlock label="What best describes your diet?">
        <SingleSelect<DietType>
          value={answers.dietType}
          onChange={(v) => update("dietType", v)}
          cols={2}
          options={[
            { value: "veg",     emoji: "🥦", label: "Vegetarian"     },
            { value: "non_veg", emoji: "🍖", label: "Non-Vegetarian" },
            { value: "vegan",   emoji: "🌱", label: "Vegan"          },
            { value: "mixed",   emoji: "🍽️", label: "Mixed"          },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How much sugar do you consume?">
        <SingleSelect<SugarConsumption>
          value={answers.sugarConsumption}
          onChange={(v) => update("sugarConsumption", v)}
          cols={3}
          options={[
            { value: "low",      emoji: "🟢", label: "Low",      sub: "Rarely sweets" },
            { value: "moderate", emoji: "🟡", label: "Moderate", sub: "Some daily"    },
            { value: "high",     emoji: "🔴", label: "High",     sub: "Regular habit" },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How often do you consume dairy (milk, cheese, curd)?">
        <SingleSelect<DairyConsumption>
          value={answers.dairyConsumption}
          onChange={(v) => update("dairyConsumption", v)}
          cols={3}
          options={[
            { value: "never",     emoji: "✋", label: "Never"     },
            { value: "sometimes", emoji: "🥛", label: "Sometimes" },
            { value: "daily",     emoji: "🧀", label: "Daily"     },
          ]}
        />
      </QuestionBlock>
    </div>
  );
}

function Section3Stress({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  const stressLabels: Record<number, string> = {
    1: "😌 Very Calm",
    2: "🙂 Mostly Calm",
    3: "😐 Moderate",
    4: "😟 Often Stressed",
    5: "😰 Very Stressed",
  };
  return (
    <div className="space-y-8">
      <QuestionBlock label="What is your current stress level?">
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              onClick={() => update("stressLevel", level)}
              className={`rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${
                answers.stressLevel === level
                  ? "bg-skin-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-600 hover:bg-skin-50"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-gray-500 mt-1">{stressLabels[answers.stressLevel]}</p>
      </QuestionBlock>
      <QuestionBlock label="What are your main sources of stress? (select all that apply)">
        <MultiSelect<StressSource>
          value={answers.stressSource}
          onChange={(v) => update("stressSource", v)}
          cols={3}
          options={[
            { value: "work",      emoji: "💼", label: "Work"      },
            { value: "studies",   emoji: "📚", label: "Studies"   },
            { value: "family",    emoji: "🏠", label: "Family"    },
            { value: "financial", emoji: "💰", label: "Financial" },
            { value: "other",     emoji: "🔮", label: "Other"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How often do you exercise?">
        <SingleSelect<ExerciseFrequency>
          value={answers.exerciseFrequency}
          onChange={(v) => update("exerciseFrequency", v)}
          cols={2}
          options={[
            { value: "none",     emoji: "🛋️", label: "None"          },
            { value: "light",    emoji: "🚶", label: "1–2x per week" },
            { value: "moderate", emoji: "🏋️", label: "3–4x per week" },
            { value: "active",   emoji: "💪", label: "Daily"         },
          ]}
        />
      </QuestionBlock>
    </div>
  );
}

function Section4Screen({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  return (
    <div className="space-y-8">
      <QuestionBlock label="How many hours a day do you spend in front of screens?">
        <RangeSlider value={answers.screenTime} onChange={(v) => update("screenTime", v)} min={0} max={16} step={0.5} formatLabel={(v) => `${v}h`} />
      </QuestionBlock>
      <QuestionBlock label="Where do you spend most of your working day?">
        <SingleSelect<WorkEnvironment>
          value={answers.workEnvironment}
          onChange={(v) => update("workEnvironment", v)}
          cols={2}
          options={[
            { value: "indoor_ac",     emoji: "❄️", label: "Indoor (AC)",    sub: "Air-conditioned" },
            { value: "indoor_non_ac", emoji: "🏠", label: "Indoor (No AC)", sub: "Open windows"    },
            { value: "outdoor",       emoji: "🌳", label: "Outdoor",        sub: "Mostly outside"  },
            { value: "mixed",         emoji: "🔄", label: "Mixed",          sub: "Varies daily"    },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="What is the pollution level in your area?">
        <SingleSelect<PollutionExposure>
          value={answers.pollutionExposure}
          onChange={(v) => update("pollutionExposure", v)}
          cols={3}
          options={[
            { value: "low_city",   emoji: "🌿", label: "Low",        sub: "Small city/town"  },
            { value: "metro",      emoji: "🏙️", label: "Metro city", sub: "Delhi, Mumbai…"  },
            { value: "industrial", emoji: "🏭", label: "Industrial", sub: "Near factories"   },
          ]}
        />
      </QuestionBlock>
    </div>
  );
}

function Section5Location({
  answers,
  update,
  climateLoading,
}: {
  answers: Answers;
  update: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  climateLoading: boolean;
}) {
  return (
    <div className="space-y-8">
      <QuestionBlock label="Which city do you live in?">
        <CityAutocomplete value={answers.city} onChange={(city) => update("city", city)} />
      </QuestionBlock>
      <QuestionBlock label="How would you describe your tap water?">
        <SingleSelect<WaterHardness>
          value={answers.waterHardness}
          onChange={(v) => update("waterHardness", v)}
          cols={2}
          options={[
            { value: "soft",      emoji: "💧", label: "Soft",      sub: "Clear, smooth feel"    },
            { value: "moderate",  emoji: "🌊", label: "Moderate",  sub: "Slightly stiff"        },
            { value: "hard",      emoji: "🪨", label: "Hard",      sub: "Slight white residue"  },
            { value: "very_hard", emoji: "🏔️", label: "Very Hard", sub: "White deposits on taps" },
          ]}
        />
      </QuestionBlock>
      {climateLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-skin-500 py-3"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block"
          >
            ⟳
          </motion.span>
          Fetching your climate data…
        </motion.div>
      )}
      {answers.climateProfile && !climateLoading && (
        <ClimateCard profile={answers.climateProfile} />
      )}
    </div>
  );
}

function Section6Routine({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  const hasNothing = answers.routineSteps.includes("nothing");
  return (
    <div className="space-y-8">
      <QuestionBlock label="Which steps are part of your current routine? (select all)">
        <MultiSelect<RoutineStep>
          value={answers.routineSteps}
          onChange={(v) => update("routineSteps", v)}
          cols={2}
          exclusive={["nothing"]}
          options={[
            { value: "cleanser",    emoji: "🧴", label: "Cleanser"    },
            { value: "toner",       emoji: "💧", label: "Toner"       },
            { value: "moisturiser", emoji: "💦", label: "Moisturiser" },
            { value: "sunscreen",   emoji: "☀️", label: "Sunscreen"   },
            { value: "serum",       emoji: "✨", label: "Serum"       },
            { value: "exfoliant",   emoji: "🔬", label: "Exfoliant"   },
            { value: "face_mask",   emoji: "🎭", label: "Face Mask"   },
            { value: "nothing",     emoji: "❌", label: "Nothing"     },
          ]}
        />
      </QuestionBlock>

      <AnimatePresence>
        {!hasNothing && answers.routineSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-8 overflow-hidden"
          >
            <QuestionBlock label="How often do you cleanse your face?">
              <SingleSelect<CleanserFrequency>
                value={answers.cleanserFrequency}
                onChange={(v) => update("cleanserFrequency", v)}
                cols={2}
                options={[
                  { value: "morning_only",  emoji: "🌅", label: "Morning only"    },
                  { value: "morning_night", emoji: "🔄", label: "Morning + Night" },
                  { value: "night_only",    emoji: "🌙", label: "Night only"      },
                  { value: "rarely",        emoji: "🙈", label: "Rarely"          },
                ]}
              />
            </QuestionBlock>
            <QuestionBlock label="Do you use sunscreen daily?">
              <SingleSelect<SunscreenUse>
                value={answers.sunscreenUse}
                onChange={(v) => update("sunscreenUse", v)}
                cols={2}
                options={[
                  { value: "yes_always", emoji: "🏆", label: "Yes, always" },
                  { value: "sometimes",  emoji: "🤷", label: "Sometimes"   },
                  { value: "rarely",     emoji: "😬", label: "Rarely"      },
                  { value: "never",      emoji: "❌", label: "Never"       },
                ]}
              />
            </QuestionBlock>
          </motion.div>
        )}
      </AnimatePresence>

      <QuestionBlock label="Known skin allergies or sensitivities? (optional)">
        <textarea
          value={answers.knownAllergens}
          onChange={(e) => update("knownAllergens", e.target.value)}
          placeholder="e.g. fragrance, retinol, niacinamide…"
          rows={2}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-skin-400 focus:outline-none resize-none transition-colors"
        />
      </QuestionBlock>
      <QuestionBlock label="Products you currently use (optional)">
        <textarea
          value={answers.currentProducts}
          onChange={(e) => update("currentProducts", e.target.value)}
          placeholder="e.g. CeraVe Cleanser, Minimalist Niacinamide 10%…"
          rows={2}
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-skin-400 focus:outline-none resize-none transition-colors"
        />
      </QuestionBlock>
    </div>
  );
}

function Section7Health({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-gray-50 border border-gray-200 px-4 py-3 flex gap-2 items-start">
        <span className="text-lg mt-0.5">🔒</span>
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>This is private and never shared.</strong> Health data is encrypted and used solely
          to improve the accuracy of your personalised skin analysis.
        </p>
      </div>
      <QuestionBlock label="Do you have any diagnosed skin conditions? (select all that apply)">
        <MultiSelect<DiagnosedCondition>
          value={answers.diagnosedConditions}
          onChange={(v) => update("diagnosedConditions", v)}
          cols={2}
          exclusive={["none", "prefer_not_to_say"]}
          options={[
            { value: "acne",              emoji: "🔴", label: "Acne",              sub: "Pimples, blackheads or whiteheads" },
            { value: "rosacea",           emoji: "🌹", label: "Rosacea",           sub: "Facial redness & visible blood vessels" },
            { value: "eczema",            emoji: "🌊", label: "Eczema",            sub: "Dry, itchy, inflamed patches of skin" },
            { value: "psoriasis",         emoji: "🔵", label: "Psoriasis",         sub: "Thick, scaly red patches" },
            { value: "melasma",           emoji: "🟤", label: "Melasma",           sub: "Brown/grey patches, often on cheeks" },
            { value: "none",              emoji: "✅", label: "None",              sub: "No diagnosed skin conditions" },
            { value: "prefer_not_to_say", emoji: "🔒", label: "Prefer not to say" },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="Are you on any medications that affect your skin?">
        <YesNoSelect
          value={answers.medicationAffectsSkin}
          onChange={(v) => update("medicationAffectsSkin", v)}
        />
      </QuestionBlock>
      <AnimatePresence>
        {answers.medicationAffectsSkin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <QuestionBlock label="Which medication(s)? (optional, kept private)">
              <textarea
                value={answers.medicationName}
                onChange={(e) => update("medicationName", e.target.value)}
                placeholder="e.g. isotretinoin, doxycycline, topical steroids…"
                rows={2}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-skin-400 focus:outline-none resize-none transition-colors"
              />
            </QuestionBlock>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section8Lifestyle({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  return (
    <div className="space-y-8">
      <QuestionBlock label="How often do you eat spicy food?">
        <SingleSelect<SpicyFoodFrequency>
          value={answers.spicyFood}
          onChange={(v) => update("spicyFood", v)}
          cols={2}
          options={[
            { value: "never",     emoji: "🌿", label: "Never"     },
            { value: "sometimes", emoji: "🌶️", label: "Sometimes", sub: "A few times/week" },
            { value: "often",     emoji: "🔥", label: "Often",     sub: "Most days" },
            { value: "daily",     emoji: "🌋", label: "Daily"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How often do you eat junk, fried, or processed food?">
        <SingleSelect<JunkFoodFrequency>
          value={answers.junkFood}
          onChange={(v) => update("junkFood", v)}
          cols={2}
          options={[
            { value: "never",     emoji: "✅", label: "Rarely"    },
            { value: "sometimes", emoji: "🍟", label: "Sometimes", sub: "1–2x per week" },
            { value: "often",     emoji: "🍕", label: "Often",     sub: "3–5x per week" },
            { value: "daily",     emoji: "⚠️", label: "Daily"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How many servings of fruits & vegetables do you eat daily?">
        <SingleSelect<FruitsVeggies>
          value={answers.fruitsVeggies}
          onChange={(v) => update("fruitsVeggies", v)}
          cols={2}
          options={[
            { value: "less_than_1", emoji: "😕", label: "< 1 serving"  },
            { value: "1_to_2",      emoji: "🥦", label: "1–2 servings" },
            { value: "3_to_5",      emoji: "🥗", label: "3–5 servings" },
            { value: "more_than_5", emoji: "🌿", label: "5+ servings"  },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="What time do you usually go to bed?">
        <SingleSelect<Bedtime>
          value={answers.bedtime}
          onChange={(v) => update("bedtime", v)}
          cols={3}
          options={[
            { value: "before_10pm",      emoji: "🌅", label: "Before 10 pm"   },
            { value: "10pm_to_midnight", emoji: "🌙", label: "10 pm–midnight"  },
            { value: "after_midnight",   emoji: "🌃", label: "After midnight"  },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="Do you use your phone/screen in the 30 min before sleeping?">
        <YesNoSelect value={answers.phoneBeforeBed} onChange={(v) => update("phoneBeforeBed", v)} yesLabel="Yes, usually" noLabel="No, I avoid it" />
      </QuestionBlock>
      <QuestionBlock label="What's your sleeping environment?">
        <SingleSelect<SleepEnvironment>
          value={answers.sleepEnvironment}
          onChange={(v) => update("sleepEnvironment", v)}
          cols={3}
          options={[
            { value: "ac",          emoji: "❄️", label: "AC",          sub: "Air-conditioned" },
            { value: "fan",         emoji: "💨", label: "Fan",          sub: "Fan on"          },
            { value: "natural_air", emoji: "🌿", label: "Natural air",  sub: "Open windows"    },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How much direct sun exposure do you get daily (without sunscreen)?">
        <SingleSelect<SunExposure>
          value={answers.sunExposure}
          onChange={(v) => update("sunExposure", v)}
          cols={2}
          options={[
            { value: "minimal",   emoji: "🏠", label: "< 15 min",  sub: "Mostly indoors"     },
            { value: "moderate",  emoji: "🚶", label: "15–30 min", sub: "Brief outdoors"      },
            { value: "high",      emoji: "☀️", label: "30–60 min", sub: "Regular outdoors"    },
            { value: "very_high", emoji: "🌞", label: "> 1 hour",  sub: "Often in direct sun" },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="Smoking status">
        <SingleSelect<SmokingStatus>
          value={answers.smokingStatus}
          onChange={(v) => update("smokingStatus", v)}
          cols={2}
          options={[
            { value: "never",        emoji: "✅", label: "Never smoked"  },
            { value: "ex_smoker",    emoji: "🚭", label: "Ex-smoker"     },
            { value: "occasionally", emoji: "💭", label: "Occasionally"  },
            { value: "regularly",    emoji: "🚬", label: "Regularly"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="Alcohol consumption">
        <SingleSelect<AlcoholConsumption>
          value={answers.alcoholConsumption}
          onChange={(v) => update("alcoholConsumption", v)}
          cols={3}
          options={[
            { value: "never",        emoji: "✅", label: "Never"        },
            { value: "occasionally", emoji: "🍷", label: "Occasionally", sub: "Weekends/events" },
            { value: "regularly",    emoji: "🍺", label: "Regularly"    },
          ]}
        />
      </QuestionBlock>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section completeness check
// ---------------------------------------------------------------------------

function isSectionComplete(section: number, a: Answers): boolean {
  switch (section) {
    case 1: return a.sleepConsistency !== null;
    case 2: return !!(a.dietType && a.sugarConsumption && a.dairyConsumption);
    case 3: return !!(a.exerciseFrequency);
    case 4: return !!(a.workEnvironment && a.pollutionExposure);
    case 5: return !!(a.city && a.waterHardness);
    case 6: return a.routineSteps.length > 0;
    case 7: return a.diagnosedConditions.length > 0 && a.medicationAffectsSkin !== null;
    case 8: return true; // Section 8 is optional — user can submit without answering
    default: return false;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QuestionnaireForm({
  onComplete,
}: {
  onComplete?: (questionnaireId: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [currentSection, setCurrentSection] = useState(1);
  const [showIntro, setShowIntro] = useState(true);
  const [completed, setCompleted] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [error, setError] = useState<string | null>(null);
  const [climateLoading, setClimateLoading] = useState(false);
  const climateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.section > 1) {
          setPhase("resume-prompt");
          return;
        }
      }
    } catch { /* ignore */ }
    setPhase("intro");
  }, []);

  // Persist draft
  useEffect(() => {
    if (phase === "done" || phase === "resume-prompt" || phase === "intro") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, section: currentSection, completed }));
    } catch { /* storage full */ }
  }, [answers, currentSection, completed, phase]);

  // Climate auto-fetch
  useEffect(() => {
    if (!answers.city || !answers.waterHardness || currentSection !== 5) return;
    if (climateDebounceRef.current) clearTimeout(climateDebounceRef.current);
    climateDebounceRef.current = setTimeout(async () => {
      setClimateLoading(true);
      try {
        const profile = await fetchClimatePreview(answers.city);
        setAnswers((prev) => ({
          ...prev,
          climateProfile: { ...profile, water_hardness: answers.waterHardness },
        }));
      } catch { /* silent */ } finally {
        setClimateLoading(false);
      }
    }, 600);
    return () => { if (climateDebounceRef.current) clearTimeout(climateDebounceRef.current); };
  }, [answers.city, answers.waterHardness, currentSection]);

  const update = useCallback(<K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResume = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAnswers(parsed.answers ?? DEFAULT_ANSWERS);
        setCurrentSection(parsed.section ?? 1);
        setCompleted(parsed.completed ?? []);
        setShowIntro(false);
        setPhase("section");
        return;
      }
    } catch { /* ignore */ }
    setPhase("intro");
  };

  const handleStartFresh = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAnswers(DEFAULT_ANSWERS);
    setCurrentSection(1);
    setCompleted([]);
    setPhase("intro");
  };

  const handleNext = () => {
    setCompleted((prev) => (prev.includes(currentSection) ? prev : [...prev, currentSection]));
    if (currentSection < 8) {
      setCurrentSection((s) => s + 1);
      setShowIntro(false);
      window.scrollTo({ top: 0, behavior: "auto" });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentSection > 1) {
      setCurrentSection((s) => s - 1);
      setShowIntro(false);
    }
  };

  const handleSubmit = async () => {
    setPhase("submitting");
    setError(null);
    const body: QuestionnaireSubmitRequest = {
      sleep_hours_avg: answers.sleepHours,
      sleep_quality: answers.sleepQuality,
      sleep_consistency: answers.sleepConsistency ?? false,
      water_intake_liters: answers.waterIntake,
      diet_type: answers.dietType ?? "mixed",
      sugar_consumption: answers.sugarConsumption ?? "moderate",
      dairy_consumption: answers.dairyConsumption ?? "sometimes",
      stress_level: answers.stressLevel,
      stress_source: answers.stressSource,
      exercise_frequency: answers.exerciseFrequency ?? "none",
      screen_time_hours: answers.screenTime,
      work_environment: answers.workEnvironment ?? "mixed",
      pollution_exposure: answers.pollutionExposure ?? "metro",
      city: answers.city,
      water_hardness: answers.waterHardness ?? "moderate",
      routine_steps: answers.routineSteps,
      cleanser_frequency: answers.cleanserFrequency ?? undefined,
      sunscreen_use: answers.sunscreenUse ?? undefined,
      known_allergens_text: answers.knownAllergens || undefined,
      products_currently_using: answers.currentProducts || undefined,
      diagnosed_conditions: answers.diagnosedConditions,
      medication_affects_skin: answers.medicationAffectsSkin ?? false,
      medication_name_text: answers.medicationName || undefined,
      // Section 8 — optional lifestyle details
      spicy_food_frequency:  answers.spicyFood        ?? undefined,
      junk_food_frequency:   answers.junkFood         ?? undefined,
      fruits_veggies_per_day: answers.fruitsVeggies   ?? undefined,
      bedtime:               answers.bedtime          ?? undefined,
      phone_before_bed:      answers.phoneBeforeBed   ?? undefined,
      sleep_environment:     answers.sleepEnvironment ?? undefined,
      daily_sun_exposure:    answers.sunExposure      ?? undefined,
      smoking_status:        answers.smokingStatus    ?? undefined,
      alcohol_consumption:   answers.alcoholConsumption ?? undefined,
    };
    try {
      const result = await submitQuestionnaire(body);
      localStorage.removeItem(STORAGE_KEY);
      setPhase("done");
      onComplete?.(result.questionnaire_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setPhase("section");
    }
  };

  const sectionConfig = SECTIONS.find((s) => s.id === currentSection)!;
  const isComplete = isSectionComplete(currentSection, answers);

  // ---- Render ----

  if (phase === "resume-prompt") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="text-5xl">👋</div>
        <h2 className="text-2xl font-bold text-gray-900">Welcome back!</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          You have an unfinished questionnaire. Continue where you left off?
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <button
            onClick={handleResume}
            className="w-full bg-skin-600 text-white font-semibold py-3 rounded-xl hover:bg-skin-700 transition-colors"
          >
            Resume where I left off
          </button>
          <button
            onClick={handleStartFresh}
            className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-6 text-center">
        <div className="text-5xl">🌿</div>
        <div>
          <h2 className="font-heading text-2xl font-bold text-gray-900 mb-2">Lifestyle Questionnaire</h2>
          <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
            7 quick sections about your daily habits. Takes about 4 minutes. Your answers directly
            improve the accuracy of your personalised skin analysis.
          </p>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-3 text-xs text-gray-400">
          <span>⏱ ~4 minutes</span>
          <span>•</span>
          <span>🔒 Private</span>
          <span>•</span>
          <span>💾 Auto-saves</span>
        </div>
        <button
          onClick={() => { setPhase("section"); setShowIntro(true); }}
          className="bg-skin-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-skin-700 active:scale-95 transition-all shadow-md shadow-skin-200"
        >
          Begin →
        </button>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-4xl inline-block"
        >
          ⟳
        </motion.span>
        <p className="text-gray-600 font-medium">Saving your profile…</p>
        <p className="text-gray-400 text-sm">Fetching live climate data for your city</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6"
      >
        <div className="text-6xl">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900">All done!</h2>
        <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
          Your lifestyle profile is saved. We're generating your personalised skin recommendations.
        </p>
        <div className="w-full max-w-xs h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full bg-teal-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-eggshell">
      <ProgressBar current={currentSection} completed={completed} />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-medium">Section {currentSection} of 8</span>
          <TimeEstimate section={currentSection} />
        </div>

        <AnimatePresence mode="wait">
          {showIntro ? (
            <SectionIntroCard
              key={`intro-${currentSection}`}
              section={sectionConfig}
              onContinue={() => setShowIntro(false)}
            />
          ) : (
            <motion.div
              key={`section-${currentSection}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <span>{sectionConfig.icon}</span>
                {sectionConfig.title}
              </h2>
              <p className="text-xs text-skin-500 mb-6 leading-relaxed">
                {SECTION_WHY[currentSection]}
              </p>

              {currentSection === 1 && <Section1Sleep answers={answers} update={update} />}
              {currentSection === 2 && <Section2Diet answers={answers} update={update} />}
              {currentSection === 3 && <Section3Stress answers={answers} update={update} />}
              {currentSection === 4 && <Section4Screen answers={answers} update={update} />}
              {currentSection === 5 && (
                <Section5Location answers={answers} update={update} climateLoading={climateLoading} />
              )}
              {currentSection === 6 && <Section6Routine answers={answers} update={update} />}
              {currentSection === 7 && <Section7Health answers={answers} update={update} />}
              {currentSection === 8 && <Section8Lifestyle answers={answers} update={update} />}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600"
          >
            ⚠️ {error}
          </motion.div>
        )}
      </div>

      {/* Sticky bottom nav */}
      {!showIntro && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {currentSection > 1 && (
              <button
                onClick={handleBack}
                className="flex-shrink-0 text-gray-500 text-sm font-medium py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!isComplete}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                isComplete
                  ? "bg-skin-600 text-white hover:bg-skin-700 active:scale-95 shadow-md shadow-skin-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {currentSection === 8
                ? "Submit & Get My Analysis →"
                : `Continue to ${SECTIONS[currentSection]?.shortTitle ?? "next"} →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
