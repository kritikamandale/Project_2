"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  fetchClimatePreview,
  getLatestQuestionnaire,
  submitQuestionnaire,
  type QuestionnaireDetailResponse,
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

import {
  Moon,
  Droplet,
  Heart,
  Monitor,
  MapPin,
  Sparkles,
  Stethoscope,
  Activity,
  Check,
  X,
  Star,
  Sun,
  Shield,
  Circle,
  Thermometer,
  User,
  CheckCircle2,
  Lock,
  Utensils,
  Smile,
  Frown,
  Meh,
  AlertCircle,
  Edit3
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "skin_analysis_questionnaire_draft";

const SECTIONS = [
  { id: 1, title: "Sleep & Recovery",      icon: Moon,        shortTitle: "Sleep"     },
  { id: 2, title: "Hydration & Diet",      icon: Droplet,     shortTitle: "Diet"      },
  { id: 3, title: "Stress & Wellbeing",    icon: Heart,       shortTitle: "Stress"    },
  { id: 4, title: "Screen & Environment",  icon: Monitor,     shortTitle: "Screen"    },
  { id: 5, title: "Your Location",         icon: MapPin,      shortTitle: "Location"  },
  { id: 6, title: "Skincare Routine",      icon: Sparkles,    shortTitle: "Routine"   },
  { id: 7, title: "Health & Medical",      icon: Stethoscope, shortTitle: "Health"    },
  { id: 8, title: "Lifestyle & Habits",    icon: Activity,    shortTitle: "Lifestyle" },
] as const;

const SECTION_WHY: Record<number, string> = {
  1: "Poor sleep increases cortisol, which triggers acne and dullness.",
  2: "Dairy and high sugar intake are the #1 dietary triggers for adult acne.",
  3: "Stress raises cortisol, directly worsening oily skin, acne, and eczema.",
  4: "Blue light and pollution accelerate skin aging and hyperpigmentation.",
  5: "UV levels and humidity in your city directly determine your skin's moisture and sun damage risk.",
  6: "Your current routine reveals gaps: we suggest what to add, not replace everything.",
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

type Phase = "view-summary" | "resume-prompt" | "intro" | "section" | "submitting" | "done";

function mapDetailToAnswers(detail: QuestionnaireDetailResponse): Answers {
  const routine = detail.routine;
  const routineSteps: RoutineStep[] = [];
  if (routine?.uses_cleanser) routineSteps.push("cleanser");
  if (routine?.uses_toner) routineSteps.push("toner");
  if (routine?.uses_moisturiser) routineSteps.push("moisturiser");
  if (routine?.uses_sunscreen) routineSteps.push("sunscreen");
  if (routine?.uses_serum) routineSteps.push("serum");
  if (routine?.uses_exfoliant) routineSteps.push("exfoliant");
  if (routine?.uses_face_mask) routineSteps.push("face_mask");
  if (routine?.uses_nothing) routineSteps.push("nothing");

  return {
    sleepHours: detail.sleep_hours_avg ?? 7,
    sleepQuality: detail.sleep_quality ?? 3,
    sleepConsistency: detail.sleep_consistency ?? null,
    waterIntake: detail.water_intake_liters ?? 2,
    dietType: detail.diet_type ?? null,
    sugarConsumption: detail.sugar_consumption ?? null,
    dairyConsumption: detail.dairy_consumption ?? null,
    stressLevel: detail.stress_level ?? 3,
    stressSource: detail.stress_source ?? [],
    exerciseFrequency: detail.exercise_frequency ?? null,
    screenTime: detail.screen_time_hours ?? 6,
    workEnvironment: detail.work_environment ?? null,
    pollutionExposure: detail.pollution_exposure ?? null,
    city: detail.climate_profile?.city ?? "",
    waterHardness: detail.climate_profile?.water_hardness ?? null,
    climateProfile: detail.climate_profile ?? null,
    routineSteps,
    cleanserFrequency: detail.cleanser_frequency ?? null,
    sunscreenUse: detail.sunscreen_use ?? null,
    knownAllergens: routine?.known_allergens_text ?? "",
    currentProducts: routine?.products_currently_using ? Object.values(routine.products_currently_using).join(", ") : "",
    diagnosedConditions: detail.diagnosed_conditions ?? [],
    medicationAffectsSkin: detail.medication_affects_skin ?? null,
    medicationName: "",
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
}

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------

function ProgressBar({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-deep-brown/10 px-4 py-3 shadow-sm">
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-0.5 flex-nowrap">
          {SECTIONS.map((s, i) => {
            const isDone = completed.includes(s.id);
            const isCurrent = s.id === current;
            const IconComp = s.icon;
            return (
              <div key={s.id} className="flex items-center gap-0.5 min-w-0 flex-1">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                    isCurrent
                      ? "bg-olive text-cream shadow-md scale-105"
                      : isDone
                      ? "bg-butter/20 text-deep-brown"
                      : "bg-deep-brown/5 text-deep-brown/40"
                  }`}
                >
                  {isDone ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <IconComp className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden xs:inline sm:inline">{s.shortTitle}</span>
                </div>
                {i < SECTIONS.length - 1 && (
                  <div
                    className={`h-px flex-1 min-w-[4px] rounded-full transition-colors mx-0.5 ${
                      isDone ? "bg-butter" : "bg-deep-brown/10"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 h-1 bg-deep-brown/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-butter rounded-full"
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
  return <span className="text-xs text-deep-brown/50 font-medium">{label}</span>;
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
    onContinue();
  }, [onContinue]);

  const IconComp = section.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center min-h-[280px] text-center px-6 py-10"
    >
      <div className="w-16 h-16 rounded-2xl bg-butter/20 border border-olive/20 flex items-center justify-center mb-4 text-olive">
        <IconComp className="w-8 h-8" />
      </div>
      <h2 className="font-heading text-2xl font-bold text-deep-brown mb-2">{section.title}</h2>
      <p className="text-deep-brown/60 max-w-sm text-sm leading-relaxed mb-6">
        {SECTION_WHY[section.id]}
      </p>
      <button
        onClick={onContinue}
        className="text-olive text-sm font-medium underline underline-offset-2"
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
    tropical: "Tropical",
    arid: "Arid",
    semi_arid: "Semi-Arid",
    temperate: "Temperate",
    coastal: "Coastal",
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
      className="mt-6 rounded-xl bg-cream border border-deep-brown/10 p-5 shadow-sm"
    >
      <p className="text-[11px] font-sans font-medium uppercase tracking-[0.18em] text-olive mb-2">
        Your Climate Profile
      </p>
      <p className="text-xl font-bold text-deep-brown mb-1 flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-olive" /> {profile.city}, {profile.state}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        {[
          { icon: Thermometer, text: `${profile.avg_temperature_c}°C` },
          { icon: Droplet, text: `${profile.avg_humidity_pct}% humidity` },
          { icon: Sun, text: `UV ${profile.uv_index}` },
          ...(profile.water_hardness
            ? [{ icon: Shield, text: hardnessLabel[profile.water_hardness] }]
            : []),
        ].map(({ icon: IconComp, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-cream/80 text-deep-brown border border-deep-brown/10"
          >
            <IconComp className="w-3.5 h-3.5 text-olive" /> {text}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-olive/10 text-olive">
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
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  formatLabel: (v: number) => string;
  ariaLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-center font-serif text-3xl font-bold text-olive">{formatLabel(value)}</div>
      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-10"
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      >
        <SliderPrimitive.Track className="bg-deep-brown/10 relative grow rounded-full h-2">
          <SliderPrimitive.Range className="absolute bg-butter rounded-full h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block w-6 h-6 bg-cream border-2 border-olive rounded-full shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-olive transition-shadow"
          aria-label={ariaLabel}
        />
      </SliderPrimitive.Root>
      <div className="flex justify-between text-xs text-deep-brown/40">
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
  image,
  label,
  sub,
  selected,
  onClick,
}: {
  emoji?: string;
  image?: string;
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all active:scale-95 overflow-hidden ${
        selected
          ? "border-olive bg-butter/20 shadow-sm"
          : "border-deep-brown/10 bg-cream/50 hover:border-deep-brown/30"
      }`}
    >
      {image && (
        <div className="relative w-full h-28 rounded-lg overflow-hidden bg-cream mb-1 border border-deep-brown/10 group">
          <img
            src={image}
            alt={label}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <span className={`text-sm font-medium ${selected ? "text-deep-brown font-semibold" : "text-deep-brown/80"}`}>
        {label}
      </span>
      {sub && <span className="text-xs text-deep-brown/50 leading-tight">{sub}</span>}
    </button>
  );
}

function SingleSelect<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: { value: T; emoji?: string; image?: string; label: string; sub?: string }[];
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
          image={o.image}
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
  options: { value: T; emoji?: string; image?: string; label: string; sub?: string }[];
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
          image={o.image}
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
        className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-medium text-sm transition-all active:scale-95 ${
          value === true
            ? "border-olive bg-butter/30 text-deep-brown font-semibold shadow-sm"
            : "border-deep-brown/10 text-deep-brown/70 hover:border-deep-brown/20 bg-cream/50"
        }`}
      >
        <Check className="w-4 h-4 text-olive" /> {yesLabel}
      </button>
      <button
        onClick={() => onChange(false)}
        className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-medium text-sm transition-all active:scale-95 ${
          value === false
            ? "border-deep-brown/30 bg-deep-brown/10 text-deep-brown font-semibold shadow-sm"
            : "border-deep-brown/10 text-deep-brown/70 hover:border-deep-brown/20 bg-cream/50"
        }`}
      >
        <X className="w-4 h-4 text-deep-brown/60" /> {noLabel}
      </button>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["", "Very Poor", "Poor", "Okay", "Good", "Excellent"];
  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className="p-1 transition-transform hover:scale-110 active:scale-95"
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                star <= value ? "fill-butter text-olive" : "text-deep-brown/20"
              }`}
            />
          </button>
        ))}
      </div>
      {value > 0 && <p className="text-center text-sm text-deep-brown/60 font-medium">{labels[value]}</p>}
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const filtered = INDIAN_CITIES.filter((c) =>
    c.toLowerCase().startsWith(query.toLowerCase())
  ).slice(0, 8);

  function selectCity(city: string) {
    setQuery(city);
    onChange(city);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        selectCity(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Start typing your city…"
        className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:border-skin-400 focus:outline-none transition-colors"
      />
      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden"
        >
          {filtered.map((city, i) => (
            <li
              key={city}
              id={`${listboxId}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => selectCity(city)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-4 py-2.5 text-sm text-deep-brown cursor-pointer flex items-center gap-1.5 ${
                i === activeIndex ? "bg-cream" : "hover:bg-cream"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-olive" /> {city}
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
        <RangeSlider value={answers.sleepHours} onChange={(v) => update("sleepHours", v)} min={3} max={10} step={0.5} formatLabel={(v) => `${v}h`} ariaLabel="Hours of sleep per night" />
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
        <RangeSlider value={answers.waterIntake} onChange={(v) => update("waterIntake", v)} min={0.5} max={4} step={0.5} formatLabel={(v) => `${v}L`} ariaLabel="Litres of water consumed daily" />
      </QuestionBlock>
      <QuestionBlock label="What best describes your diet?">
        <SingleSelect<DietType>
          value={answers.dietType}
          onChange={(v) => update("dietType", v)}
          cols={2}
          options={[
            { value: "veg",     label: "Vegetarian"     },
            { value: "non_veg", label: "Non-Vegetarian" },
            { value: "vegan",   label: "Vegan"          },
            { value: "mixed",   label: "Mixed"          },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How much sugar do you consume?">
        <SingleSelect<SugarConsumption>
          value={answers.sugarConsumption}
          onChange={(v) => update("sugarConsumption", v)}
          cols={3}
          options={[
            { value: "low",      label: "Low",      sub: "Rarely sweets" },
            { value: "moderate", label: "Moderate", sub: "Some daily"    },
            { value: "high",     label: "High",     sub: "Regular habit" },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How often do you consume dairy (milk, cheese, curd)?">
        <SingleSelect<DairyConsumption>
          value={answers.dairyConsumption}
          onChange={(v) => update("dairyConsumption", v)}
          cols={3}
          options={[
            { value: "never",     label: "Never"     },
            { value: "sometimes", label: "Sometimes" },
            { value: "daily",     label: "Daily"     },
          ]}
        />
      </QuestionBlock>
    </div>
  );
}

function Section3Stress({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  const stressLabels: Record<number, string> = {
    1: "Very Calm",
    2: "Mostly Calm",
    3: "Moderate",
    4: "Often Stressed",
    5: "Very Stressed",
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
                  ? "bg-olive text-cream shadow-sm"
                  : "bg-cream text-deep-brown hover:bg-cream/80 border border-deep-brown/10"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-deep-brown/60 mt-1">{stressLabels[answers.stressLevel]}</p>
      </QuestionBlock>
      <QuestionBlock label="What are your main sources of stress? (select all that apply)">
        <MultiSelect<StressSource>
          value={answers.stressSource}
          onChange={(v) => update("stressSource", v)}
          cols={3}
          options={[
            { value: "work",      label: "Work"      },
            { value: "studies",   label: "Studies"   },
            { value: "family",    label: "Family"    },
            { value: "financial", label: "Financial" },
            { value: "other",     label: "Other"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How often do you exercise?">
        <SingleSelect<ExerciseFrequency>
          value={answers.exerciseFrequency}
          onChange={(v) => update("exerciseFrequency", v)}
          cols={2}
          options={[
            { value: "none",     label: "None"          },
            { value: "light",    label: "1–2x per week" },
            { value: "moderate", label: "3–4x per week" },
            { value: "active",   label: "Daily"         },
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
        <RangeSlider value={answers.screenTime} onChange={(v) => update("screenTime", v)} min={0} max={16} step={0.5} formatLabel={(v) => `${v}h`} ariaLabel="Hours of screen time per day" />
      </QuestionBlock>
      <QuestionBlock label="Where do you spend most of your working day?">
        <SingleSelect<WorkEnvironment>
          value={answers.workEnvironment}
          onChange={(v) => update("workEnvironment", v)}
          cols={2}
          options={[
            { value: "indoor_ac",     label: "Indoor (AC)",    sub: "Air-conditioned" },
            { value: "indoor_non_ac", label: "Indoor (No AC)", sub: "Open windows"    },
            { value: "outdoor",       label: "Outdoor",        sub: "Mostly outside"  },
            { value: "mixed",         label: "Mixed",          sub: "Varies daily"    },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="What is the pollution level in your area?">
        <SingleSelect<PollutionExposure>
          value={answers.pollutionExposure}
          onChange={(v) => update("pollutionExposure", v)}
          cols={3}
          options={[
            { value: "low_city",   label: "Low",        sub: "Small city/town"  },
            { value: "metro",      label: "Metro city", sub: "Delhi, Mumbai…"  },
            { value: "industrial", label: "Industrial", sub: "Near factories"   },
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
            { value: "soft",      label: "Soft",      sub: "Clear, smooth feel"    },
            { value: "moderate",  label: "Moderate",  sub: "Slightly stiff"        },
            { value: "hard",      label: "Hard",      sub: "Slight white residue"  },
            { value: "very_hard", label: "Very Hard", sub: "White deposits on taps" },
          ]}
        />
      </QuestionBlock>
      {climateLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-sm text-olive py-3"
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
            { value: "cleanser",    label: "Cleanser"    },
            { value: "toner",       label: "Toner"       },
            { value: "moisturiser", label: "Moisturiser" },
            { value: "sunscreen",   label: "Sunscreen"   },
            { value: "serum",       label: "Serum"       },
            { value: "exfoliant",   label: "Exfoliant"   },
            { value: "face_mask",   label: "Face Mask"   },
            { value: "nothing",     label: "Nothing"     },
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
                  { value: "morning_only",  label: "Morning only"    },
                  { value: "morning_night", label: "Morning + Night" },
                  { value: "night_only",    label: "Night only"      },
                  { value: "rarely",        label: "Rarely"          },
                ]}
              />
            </QuestionBlock>
            <QuestionBlock label="Do you use sunscreen daily?">
              <SingleSelect<SunscreenUse>
                value={answers.sunscreenUse}
                onChange={(v) => update("sunscreenUse", v)}
                cols={2}
                options={[
                  { value: "yes_always", label: "Yes, always" },
                  { value: "sometimes",  label: "Sometimes"   },
                  { value: "rarely",     label: "Rarely"      },
                  { value: "never",      label: "Never"       },
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
          className="w-full rounded-xl border border-deep-brown/15 bg-cream/50 px-4 py-3 text-sm text-deep-brown focus:border-olive focus:outline-none resize-none transition-colors"
        />
      </QuestionBlock>
      <QuestionBlock label="Products you currently use (optional)">
        <textarea
          value={answers.currentProducts}
          onChange={(e) => update("currentProducts", e.target.value)}
          placeholder="e.g. CeraVe Cleanser, Minimalist Niacinamide 10%…"
          rows={2}
          className="w-full rounded-xl border border-deep-brown/15 bg-cream/50 px-4 py-3 text-sm text-deep-brown focus:border-olive focus:outline-none resize-none transition-colors"
        />
      </QuestionBlock>
    </div>
  );
}

function Section7Health({ answers, update }: { answers: Answers; update: <K extends keyof Answers>(k: K, v: Answers[K]) => void }) {
  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-cream border border-deep-brown/10 px-4 py-3 flex gap-2 items-start">
        <Lock className="w-4 h-4 text-olive shrink-0 mt-0.5" />
        <p className="text-xs text-deep-brown/70 leading-relaxed">
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
            { value: "acne",              image: "/images/conditions/acne.png",     label: "Acne",              sub: "Pimples, blackheads or whiteheads" },
            { value: "rosacea",           image: "/images/conditions/rosacea.png",  label: "Rosacea",           sub: "Facial redness & visible blood vessels" },
            { value: "eczema",            image: "/images/conditions/eczema.png",   label: "Eczema",            sub: "Dry, itchy, inflamed patches of skin" },
            { value: "psoriasis",         image: "/images/conditions/psoriasis.png", label: "Psoriasis",         sub: "Thick, scaly red patches" },
            { value: "melasma",           image: "/images/conditions/melasma.png",  label: "Melasma",           sub: "Dark hyperpigmented patches on face" },
            { value: "none",              image: "/images/conditions/none.png",     label: "None",              sub: "No diagnosed skin conditions" },
            { value: "prefer_not_to_say", label: "Prefer not to say", sub: "Skip this question" },
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
                className="w-full rounded-xl border border-deep-brown/15 bg-cream/50 px-4 py-3 text-sm text-deep-brown focus:border-olive focus:outline-none resize-none transition-colors"
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
            { value: "never",     label: "Never"     },
            { value: "sometimes", label: "Sometimes", sub: "A few times/week" },
            { value: "often",     label: "Often",     sub: "Most days" },
            { value: "daily",     label: "Daily"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How often do you eat junk, fried, or processed food?">
        <SingleSelect<JunkFoodFrequency>
          value={answers.junkFood}
          onChange={(v) => update("junkFood", v)}
          cols={2}
          options={[
            { value: "never",     label: "Rarely"    },
            { value: "sometimes", label: "Sometimes", sub: "1–2x per week" },
            { value: "often",     label: "Often",     sub: "3–5x per week" },
            { value: "daily",     label: "Daily"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How many servings of fruits & vegetables do you eat daily?">
        <SingleSelect<FruitsVeggies>
          value={answers.fruitsVeggies}
          onChange={(v) => update("fruitsVeggies", v)}
          cols={2}
          options={[
            { value: "less_than_1", label: "< 1 serving"  },
            { value: "1_to_2",      label: "1–2 servings" },
            { value: "3_to_5",      label: "3–5 servings" },
            { value: "more_than_5", label: "5+ servings"  },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="What time do you usually go to bed?">
        <SingleSelect<Bedtime>
          value={answers.bedtime}
          onChange={(v) => update("bedtime", v)}
          cols={3}
          options={[
            { value: "before_10pm",      label: "Before 10 pm"   },
            { value: "10pm_to_midnight", label: "10 pm–midnight"  },
            { value: "after_midnight",   label: "After midnight"  },
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
            { value: "ac",          label: "AC",          sub: "Air-conditioned" },
            { value: "fan",         label: "Fan",          sub: "Fan on"          },
            { value: "natural_air", label: "Natural air",  sub: "Open windows"    },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="How much direct sun exposure do you get daily (without sunscreen)?">
        <SingleSelect<SunExposure>
          value={answers.sunExposure}
          onChange={(v) => update("sunExposure", v)}
          cols={2}
          options={[
            { value: "minimal",   label: "< 15 min",  sub: "Mostly indoors"     },
            { value: "moderate",  label: "15–30 min", sub: "Brief outdoors"      },
            { value: "high",      label: "30–60 min", sub: "Regular outdoors"    },
            { value: "very_high", label: "> 1 hour",  sub: "Often in direct sun" },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="Smoking status">
        <SingleSelect<SmokingStatus>
          value={answers.smokingStatus}
          onChange={(v) => update("smokingStatus", v)}
          cols={2}
          options={[
            { value: "never",        label: "Never smoked"  },
            { value: "ex_smoker",    label: "Ex-smoker"     },
            { value: "occasionally", label: "Occasionally"  },
            { value: "regularly",    label: "Regularly"     },
          ]}
        />
      </QuestionBlock>
      <QuestionBlock label="Alcohol consumption">
        <SingleSelect<AlcoholConsumption>
          value={answers.alcoholConsumption}
          onChange={(v) => update("alcoholConsumption", v)}
          cols={3}
          options={[
            { value: "never",        label: "Never"        },
            { value: "occasionally", label: "Occasionally", sub: "Weekends/events" },
            { value: "regularly",    label: "Regularly"    },
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

  const [savedQuestionnaire, setSavedQuestionnaire] = useState<QuestionnaireDetailResponse | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Restore existing submission from API or draft from localStorage
  useEffect(() => {
    let mounted = true;
    async function loadInitial() {
      try {
        const latest = await getLatestQuestionnaire();
        if (mounted && latest && latest.id) {
          setSavedQuestionnaire(latest);
          setAnswers(mapDetailToAnswers(latest));
          setPhase("view-summary");
          setLoadingInitial(false);
          return;
        }
      } catch {
        /* User has not submitted a questionnaire yet */
      }

      if (!mounted) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.section > 1) {
            setPhase("resume-prompt");
            setLoadingInitial(false);
            return;
          }
        }
      } catch { /* ignore */ }

      setPhase("intro");
      setLoadingInitial(false);
    }
    loadInitial();
    return () => { mounted = false; };
  }, []);

  const handleStartUpdate = () => {
    setCompleted([1, 2, 3, 4, 5, 6, 7, 8]);
    setCurrentSection(1);
    setShowIntro(false);
    setPhase("section");
  };

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
  const CurrentSectionIcon = sectionConfig.icon;

  // ---- Render ----

  if (loadingInitial) {
    return (
      <div className="h-[calc(100vh-5rem)] flex flex-col items-center justify-center gap-3 text-deep-brown overflow-hidden">
        <Sparkles className="w-8 h-8 text-olive animate-spin" />
        <p className="text-sm font-medium text-deep-brown/70">Loading your profile…</p>
      </div>
    );
  }

  if (phase === "view-summary" && savedQuestionnaire) {
    return (
      <div className="h-full w-full flex flex-col justify-center px-4 sm:px-8 py-4 bg-cream text-deep-brown overflow-hidden">
        <div className="max-w-7xl w-full mx-auto bg-cream border border-deep-brown/15 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          
          {/* Header */}
          <div className="border-b border-deep-brown/10 pb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-olive/10 text-olive text-[11px] font-bold uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Recorded Answers Profile
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-deep-brown">Your Lifestyle & Skincare Profile</h2>
            <p className="text-xs text-deep-brown/60">
              Last updated: {new Date(savedQuestionnaire.submitted_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Answers Summary Grid — 4 Columns on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs sm:text-sm">
            {/* Sleep */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5" /> Sleep & Recovery
              </p>
              <p className="font-semibold text-deep-brown">{answers.sleepHours} hrs/night • Quality: {answers.sleepQuality}/5</p>
              <p className="text-xs text-deep-brown/70">{answers.sleepConsistency ? "Consistent sleep schedule" : "Varying sleep schedule"}</p>
            </div>

            {/* Hydration & Diet */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5" /> Hydration & Diet
              </p>
              <p className="font-semibold text-deep-brown">{answers.waterIntake}L water daily • {answers.dietType ? answers.dietType.replace("_", " ") : "Mixed"}</p>
              <p className="text-xs text-deep-brown/70">Sugar: {answers.sugarConsumption ?? "Moderate"} • Dairy: {answers.dairyConsumption ?? "Sometimes"}</p>
            </div>

            {/* Stress */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5" /> Stress & Exercise
              </p>
              <p className="font-semibold text-deep-brown">Stress level: {answers.stressLevel}/5</p>
              <p className="text-xs text-deep-brown/70">Exercise: {answers.exerciseFrequency ? answers.exerciseFrequency.replace("_", " ") : "None"}</p>
            </div>

            {/* Environment & Screen */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" /> Screen & Environment
              </p>
              <p className="font-semibold text-deep-brown">{answers.screenTime} hrs screen time</p>
              <p className="text-xs text-deep-brown/70">Work: {answers.workEnvironment ? answers.workEnvironment.replace("_", " ") : "Mixed"} • Pollution: {answers.pollutionExposure ?? "Metro"}</p>
            </div>

            {/* Location & Climate */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Location & Climate
              </p>
              <p className="font-semibold text-deep-brown">{answers.city || "Not specified"}</p>
              <p className="text-xs text-deep-brown/70">Water: {answers.waterHardness ? answers.waterHardness.replace("_", " ") : "Moderate"}</p>
            </div>

            {/* Skincare Routine */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Current Routine
              </p>
              <p className="font-semibold text-deep-brown capitalize truncate">
                {answers.routineSteps.length > 0 ? answers.routineSteps.join(", ") : "No steps selected"}
              </p>
              <p className="text-xs text-deep-brown/70">Sunscreen: {answers.sunscreenUse ? answers.sunscreenUse.replace("_", " ") : "Not specified"}</p>
            </div>

            {/* Health & Medical */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5" /> Health & Medical
              </p>
              <p className="font-semibold text-deep-brown capitalize">
                {answers.diagnosedConditions.length > 0 ? answers.diagnosedConditions.join(", ") : "None reported"}
              </p>
              <p className="text-xs text-deep-brown/70">Allergens: {answers.knownAllergens || "None"} • Medication: {answers.medicationAffectsSkin ? "Yes" : "No"}</p>
            </div>

            {/* Lifestyle & Habits */}
            <div className="rounded-xl border border-deep-brown/10 bg-cream/60 p-3.5 space-y-1">
              <p className="text-[11px] font-bold text-olive uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Lifestyle & Habits
              </p>
              <p className="font-semibold text-deep-brown capitalize">
                Sun: {answers.sunExposure ? answers.sunExposure.replace("_", " ") : "Moderate"} • Smoking: {answers.smokingStatus ?? "Never"}
              </p>
              <p className="text-xs text-deep-brown/70">Spicy Food: {answers.spicyFood ?? "Sometimes"} • Junk Food: {answers.junkFood ?? "Sometimes"}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-deep-brown/10">
            <button
              onClick={handleStartFresh}
              className="text-deep-brown/60 hover:text-deep-brown font-medium py-2.5 px-4 rounded-xl border border-deep-brown/15 hover:bg-cream transition-colors text-xs"
            >
              Start Over Fresh
            </button>
            <button
              onClick={handleStartUpdate}
              className="bg-butter hover:bg-butter/90 text-deep-brown font-bold py-2.5 px-6 rounded-xl border border-deep-brown/10 shadow-sm transition-all active:scale-95 text-xs sm:text-sm flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4 text-olive" /> Update Answers
            </button>
          </div>

        </div>
      </div>
    );
  }

  if (phase === "resume-prompt") {
    return (
      <div className="h-[calc(100vh-5rem)] flex flex-col items-center justify-center gap-4 px-6 text-center overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-butter/20 flex items-center justify-center text-olive mb-2">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-deep-brown">Welcome back!</h2>
        <p className="text-deep-brown/60 text-sm max-w-xs">
          You have an unfinished questionnaire. Continue where you left off?
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
          <button
            onClick={handleResume}
            className="w-full bg-butter text-deep-brown font-semibold py-3 rounded-xl hover:bg-butter/90 transition-colors"
          >
            Resume where I left off
          </button>
          <button
            onClick={handleStartFresh}
            className="w-full text-deep-brown/40 text-sm py-2 hover:text-deep-brown/70 transition-colors"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <div className="h-[calc(100vh-5rem)] flex flex-col items-center justify-center gap-6 px-6 text-center overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-butter/20 flex items-center justify-center text-olive mb-2">
          <Sparkles className="w-8 h-8" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold text-deep-brown mb-2">Lifestyle Questionnaire</h2>
          <p className="text-deep-brown/60 text-sm max-w-sm leading-relaxed">
            7 quick sections about your daily habits. Takes about 4 minutes. Your answers directly
            improve the accuracy of your personalised skin analysis.
          </p>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-3 text-xs text-deep-brown/50">
          <span>~4 minutes</span>
          <span>•</span>
          <span>Private</span>
          <span>•</span>
          <span>Auto-saves</span>
        </div>
        <button
          onClick={() => { setPhase("section"); setShowIntro(false); }}
          className="bg-butter text-deep-brown font-semibold px-8 py-3 rounded-xl hover:bg-butter/90 active:scale-95 transition-all shadow-sm"
        >
          Begin →
        </button>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="h-[calc(100vh-5rem)] flex flex-col items-center justify-center gap-4 text-center overflow-hidden">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="text-olive inline-block"
        >
          <Sparkles className="w-8 h-8" />
        </motion.span>
        <p className="text-deep-brown font-medium">Saving your profile…</p>
        <p className="text-deep-brown/50 text-sm">Fetching live climate data for your city</p>
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
        <div className="w-16 h-16 rounded-full bg-butter/30 flex items-center justify-center text-olive mb-2">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-deep-brown">All done!</h2>
        <p className="text-deep-brown/60 text-sm max-w-sm leading-relaxed">
          Your lifestyle profile is saved. Next up: let&apos;s scan your face!
        </p>
        <div className="w-full max-w-xs h-2 bg-deep-brown/10 rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full bg-butter rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <ProgressBar current={currentSection} completed={completed} />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-deep-brown/50 font-medium">Section {currentSection} of 8</span>
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
              <h2 className="text-xl font-bold text-deep-brown mb-1 flex items-center gap-2">
                <CurrentSectionIcon className="w-5 h-5 text-olive" />
                {sectionConfig.title}
              </h2>
              <p className="text-xs text-olive mb-6 leading-relaxed">
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
            className="mt-4 rounded-xl bg-deep-brown/10 border border-deep-brown/20 px-4 py-3 text-sm text-deep-brown flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-olive" /> {error}
          </motion.div>
        )}
      </div>

      {/* Sticky bottom nav */}
      {!showIntro && (
        <div className="fixed bottom-0 inset-x-0 bg-cream/95 backdrop-blur border-t border-deep-brown/10 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {currentSection > 1 && (
              <button
                onClick={handleBack}
                className="flex-shrink-0 text-deep-brown/70 text-sm font-medium py-3 px-4 rounded-xl hover:bg-deep-brown/5 transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!isComplete}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                isComplete
                  ? "bg-butter text-deep-brown hover:bg-butter/90 active:scale-95 shadow-sm"
                  : "bg-deep-brown/10 text-deep-brown/30 cursor-not-allowed"
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
