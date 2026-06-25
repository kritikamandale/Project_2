import { NextRequest, NextResponse } from "next/server";
import {
  getQuestionnaire,
  setQuestionnaire,
  getScan,
  setScan,
  getRecommendation,
  setRecommendation,
  type StoredScan,
  type StoredQuestionnaire,
} from "@/lib/mockStore";
import { computeRecommendation } from "@/lib/ai/localRecommendations";

// ---------------------------------------------------------------------------
// Hackathon demo: all API calls are handled locally — no FastAPI backend needed.
// ---------------------------------------------------------------------------

function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function notFound(msg = "Not found") {
  return NextResponse.json({ detail: msg }, { status: 404 });
}

// Mock climate data for Indian cities
const CITY_CLIMATE: Record<string, { city: string; state: string; avg_temperature_c: number; avg_humidity_pct: number; uv_index: number; water_hardness: string; climate_zone: string }> = {
  Mumbai:      { city: "Mumbai",      state: "Maharashtra",   avg_temperature_c: 30, avg_humidity_pct: 78, uv_index: 7.5, water_hardness: "hard",     climate_zone: "coastal"   },
  Delhi:       { city: "Delhi",       state: "Delhi",         avg_temperature_c: 28, avg_humidity_pct: 55, uv_index: 6.5, water_hardness: "hard",     climate_zone: "semi_arid" },
  Bangalore:   { city: "Bangalore",   state: "Karnataka",     avg_temperature_c: 24, avg_humidity_pct: 62, uv_index: 6.0, water_hardness: "moderate", climate_zone: "temperate" },
  Chennai:     { city: "Chennai",     state: "Tamil Nadu",    avg_temperature_c: 32, avg_humidity_pct: 75, uv_index: 8.0, water_hardness: "moderate", climate_zone: "tropical"  },
  Hyderabad:   { city: "Hyderabad",   state: "Telangana",     avg_temperature_c: 29, avg_humidity_pct: 58, uv_index: 7.0, water_hardness: "moderate", climate_zone: "semi_arid" },
  Kolkata:     { city: "Kolkata",     state: "West Bengal",   avg_temperature_c: 30, avg_humidity_pct: 72, uv_index: 6.5, water_hardness: "soft",     climate_zone: "tropical"  },
  Pune:        { city: "Pune",        state: "Maharashtra",   avg_temperature_c: 26, avg_humidity_pct: 60, uv_index: 6.5, water_hardness: "moderate", climate_zone: "semi_arid" },
  Ahmedabad:   { city: "Ahmedabad",   state: "Gujarat",       avg_temperature_c: 32, avg_humidity_pct: 48, uv_index: 7.5, water_hardness: "very_hard",climate_zone: "arid"      },
  Jaipur:      { city: "Jaipur",      state: "Rajasthan",     avg_temperature_c: 31, avg_humidity_pct: 42, uv_index: 7.0, water_hardness: "very_hard",climate_zone: "arid"      },
  Surat:       { city: "Surat",       state: "Gujarat",       avg_temperature_c: 31, avg_humidity_pct: 68, uv_index: 7.0, water_hardness: "hard",     climate_zone: "coastal"   },
  Lucknow:     { city: "Lucknow",     state: "Uttar Pradesh", avg_temperature_c: 27, avg_humidity_pct: 60, uv_index: 6.0, water_hardness: "hard",     climate_zone: "temperate" },
  Kochi:       { city: "Kochi",       state: "Kerala",        avg_temperature_c: 29, avg_humidity_pct: 80, uv_index: 8.0, water_hardness: "soft",     climate_zone: "tropical"  },
  Chandigarh:  { city: "Chandigarh",  state: "Punjab",        avg_temperature_c: 24, avg_humidity_pct: 55, uv_index: 5.5, water_hardness: "moderate", climate_zone: "temperate" },
  Indore:      { city: "Indore",      state: "Madhya Pradesh",avg_temperature_c: 28, avg_humidity_pct: 52, uv_index: 6.5, water_hardness: "moderate", climate_zone: "semi_arid" },
  Bhopal:      { city: "Bhopal",      state: "Madhya Pradesh",avg_temperature_c: 28, avg_humidity_pct: 54, uv_index: 6.5, water_hardness: "moderate", climate_zone: "semi_arid" },
  Patna:       { city: "Patna",       state: "Bihar",         avg_temperature_c: 28, avg_humidity_pct: 65, uv_index: 6.0, water_hardness: "moderate", climate_zone: "temperate" },
  Nagpur:      { city: "Nagpur",      state: "Maharashtra",   avg_temperature_c: 31, avg_humidity_pct: 55, uv_index: 7.0, water_hardness: "moderate", climate_zone: "semi_arid" },
  Visakhapatnam:{ city: "Visakhapatnam", state: "Andhra Pradesh", avg_temperature_c: 30, avg_humidity_pct: 72, uv_index: 7.5, water_hardness: "moderate", climate_zone: "coastal" },
};

// ---------------------------------------------------------------------------
// Mock handler — intercepts before any auth check
// ---------------------------------------------------------------------------

async function handleMockEndpoint(
  req: NextRequest,
  pathSegments: string[],
): Promise<NextResponse | null> {
  const path = pathSegments.join("/");
  const method = req.method.toUpperCase();

  // ── Questionnaire ──────────────────────────────────────────────────────────

  if (path === "questionnaire/latest" && method === "GET") {
    const q = getQuestionnaire();
    if (!q) return notFound("No questionnaire found");
    return ok(q);
  }

  if (path === "questionnaire/submit" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body */ }

    const id = `q-${Date.now()}`;
    const q: StoredQuestionnaire = {
      questionnaire_id: id,
      submitted_at: new Date().toISOString(),
      sleep_hours_avg:    (body.sleep_hours_avg as number) ?? 7,
      sleep_quality:      (body.sleep_quality   as number) ?? 3,
      sleep_consistency:  (body.sleep_consistency as boolean) ?? true,
      water_intake_liters:(body.water_intake_liters as number) ?? 2,
      diet_type:          (body.diet_type as string) ?? "mixed",
      sugar_consumption:  (body.sugar_consumption as string) ?? "moderate",
      dairy_consumption:  (body.dairy_consumption as string) ?? "sometimes",
      stress_level:       (body.stress_level as number) ?? 3,
      stress_source:      (body.stress_source as string[]) ?? [],
      exercise_frequency: (body.exercise_frequency as string) ?? "light",
      screen_time_hours:  (body.screen_time_hours as number) ?? 6,
      work_environment:   (body.work_environment as string) ?? "indoor_ac",
      pollution_exposure: (body.pollution_exposure as string) ?? "metro",
      city:               (body.city as string) ?? "",
      water_hardness:     (body.water_hardness as string) ?? "moderate",
      routine_steps:      (body.routine_steps as string[]) ?? [],
      sunscreen_use:      (body.sunscreen_use as string) ?? null,
      known_allergens_text: (body.known_allergens_text as string) ?? null,
      diagnosed_conditions: (body.diagnosed_conditions as string[]) ?? [],
      medication_affects_skin: (body.medication_affects_skin as boolean) ?? false,
      spicy_food_frequency:  (body.spicy_food_frequency as string) ?? null,
      junk_food_frequency:   (body.junk_food_frequency as string) ?? null,
      fruits_veggies_per_day:(body.fruits_veggies_per_day as string) ?? null,
      sleep_environment:     (body.sleep_environment as string) ?? null,
      daily_sun_exposure:    (body.daily_sun_exposure as string) ?? null,
      smoking_status:        (body.smoking_status as string) ?? null,
      alcohol_consumption:   (body.alcohol_consumption as string) ?? null,
    };
    setQuestionnaire(q);

    const city = q.city;
    const climate = CITY_CLIMATE[city] ?? null;
    const climateProfile = climate ? { ...climate, water_hardness: q.water_hardness } : null;

    return ok({ questionnaire_id: id, message: "Questionnaire saved.", climate_profile: climateProfile });
  }

  if (path === "questionnaire/climate-enrich" && method === "POST") {
    let body: { city?: string } = {};
    try { body = await req.json(); } catch { /* empty */ }
    const city = body.city ?? "";
    const climate = CITY_CLIMATE[city];
    if (!climate) {
      return ok({
        city,
        state: "India",
        avg_temperature_c: 28,
        avg_humidity_pct: 60,
        uv_index: 6.5,
        water_hardness: "moderate",
        climate_zone: "semi_arid",
      });
    }
    return ok({ ...climate, water_hardness: "moderate" });
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  if (path === "scan/submit" && method === "POST") {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty */ }

    const scanId = `scan-${Date.now()}`;
    const conditions = (body.conditions as StoredScan["conditions"]) ?? [];
    const scan: StoredScan = {
      scan_id: scanId,
      skin_type:             (body.skin_type as string) ?? "normal",
      fitzpatrick_tone:      (body.fitzpatrick_tone as string) ?? "III",
      skin_type_confidence:  (body.skin_type_confidence as number) ?? 0.72,
      conditions,
      lighting_quality_score:(body.lighting_quality_score as number) ?? 1.0,
      model_version:         (body.model_version as string) ?? "pixel-analysis-v1",
      analysis_timestamp:    (body.analysis_timestamp as string) ?? new Date().toISOString(),
    };
    setScan(scan);

    const biasFlag = ["IV", "V", "VI"].includes(scan.fitzpatrick_tone) && scan.skin_type_confidence < 0.70;

    return ok({
      scan_id: scanId,
      message: "Scan submitted successfully.",
      skin_type: scan.skin_type,
      fitzpatrick_tone: scan.fitzpatrick_tone,
      confidence: scan.skin_type_confidence,
      conditions_detected: conditions.length,
      bias_flag: biasFlag,
      bias_message: biasFlag ? "Lower confidence for your skin tone — manual override available." : null,
    });
  }

  if ((path === "scan/history" || path === "scan") && method === "GET") {
    const scan = getScan();
    if (!scan) {
      return ok({ items: [], total: 0, page: 1, per_page: 10, has_more: false });
    }
    return ok({
      items: [{
        id: scan.scan_id,
        scan_timestamp: scan.analysis_timestamp,
        skin_type: scan.skin_type,
        analysis_confidence_score: scan.skin_type_confidence,
        created_at: scan.analysis_timestamp,
      }],
      total: 1, page: 1, per_page: 10, has_more: false,
    });
  }

  if (pathSegments[0] === "scan" && pathSegments[1] && method === "GET") {
    const scan = getScan();
    if (!scan) return notFound("Scan not found");
    return ok({
      id: scan.scan_id,
      user_id: "demo-user-001",
      scan_timestamp: scan.analysis_timestamp,
      skin_type: scan.skin_type,
      analysis_confidence_score: scan.skin_type_confidence,
      lighting_quality_score: scan.lighting_quality_score,
      fitzpatrick_tone: scan.fitzpatrick_tone,
      image_permanently_deleted: true,
      image_was_processed_locally: true,
      conditions: scan.conditions.map((c, i) => ({
        id: `cond-${i}`,
        condition_name: c.name,
        severity: c.severity,
        affected_zone: c.zone,
        confidence_score: c.confidence,
      })),
      created_at: scan.analysis_timestamp,
    });
  }

  // ── Recommendations ───────────────────────────────────────────────────────

  if (path === "recommendations/generate" && method === "POST") {
    const scan = getScan();
    const q = getQuestionnaire();
    if (!scan) return notFound("No scan found. Please complete a scan first.");

    const recId = `rec-${Date.now()}`;
    const recData = computeRecommendation(scan, q, recId);
    setRecommendation({ recommendation_id: recId, generated_at: new Date().toISOString(), data: recData });

    return ok({
      recommendation_id: recId,
      message: "Recommendation generated successfully.",
      skin_score: recData.skin_score as number,
      products_count: (recData.products as unknown[]).length,
      requires_derm_review: recData.requires_derm_review,
      estimated_monthly_cost_inr: recData.estimated_monthly_cost_inr,
    });
  }

  if (path === "recommendations/latest" && method === "GET") {
    // Compute fresh if we have scan data
    const scan = getScan();
    const q = getQuestionnaire();
    const cached = getRecommendation();

    if (cached) return ok(cached.data);

    if (scan) {
      const recId = `rec-${Date.now()}`;
      const recData = computeRecommendation(scan, q, recId);
      setRecommendation({ recommendation_id: recId, generated_at: new Date().toISOString(), data: recData });
      return ok(recData);
    }

    return notFound("No recommendation found. Complete a scan first.");
  }

  if (pathSegments[0] === "recommendations" && pathSegments[1] && pathSegments[2] === "roadmap" && method === "GET") {
    const cached = getRecommendation();
    if (cached) {
      const rec = cached.data as Record<string, unknown>;
      return ok(rec.roadmap ?? {});
    }
    const scan = getScan();
    if (!scan) return notFound("No recommendation found");
    const q = getQuestionnaire();
    const recData = computeRecommendation(scan, q) as Record<string, unknown>;
    return ok(recData.roadmap ?? {});
  }

  if (pathSegments[0] === "recommendations" && pathSegments[1] && pathSegments[2] === "products" && method === "GET") {
    const cached = getRecommendation();
    if (cached) {
      const rec = cached.data as Record<string, unknown>;
      return ok(rec.products ?? []);
    }
    return ok([]);
  }

  if (pathSegments[0] === "recommendations" && pathSegments[1] && pathSegments[2] === "feedback" && method === "POST") {
    return new NextResponse(null, { status: 204 });
  }

  if (pathSegments[0] === "recommendations" && pathSegments[1] && method === "GET") {
    const cached = getRecommendation();
    if (cached) return ok(cached.data);

    const scan = getScan();
    if (!scan) return notFound("No recommendation found");
    const q = getQuestionnaire();
    const recId = pathSegments[1];
    const recData = computeRecommendation(scan, q, recId);
    setRecommendation({ recommendation_id: recId, generated_at: new Date().toISOString(), data: recData });
    return ok(recData);
  }

  // ── Progress ──────────────────────────────────────────────────────────────

  if (path === "progress/summary" && method === "GET") {
    const scan = getScan();
    const cached = getRecommendation();
    const rec = cached?.data as Record<string, unknown> | undefined;
    const skinScore = rec ? (rec.skin_score as number) : null;

    const conditions: { condition: string; status: string; improvement_pct: number | null }[] = [];
    if (scan) {
      for (const c of scan.conditions.slice(0, 3)) {
        conditions.push({ condition: c.name, status: "stable", improvement_pct: null });
      }
    }

    return ok({
      latest_score: skinScore,
      total_improvement: null,
      current_streak: 0,
      days_until_rescan: 30,
      is_rescan_overdue: false,
      conditions,
      unread_notification_count: 0,
      alerts: [],
    });
  }

  // ── Auth / User ───────────────────────────────────────────────────────────

  if (path === "auth/me" && method === "GET") {
    return ok({ id: "demo-user-001", email: "demo@skinai.in", name: "Demo User", role: "user" });
  }

  if (path === "auth/refresh" && method === "POST") {
    return ok({ access_token: "demo-token", token_type: "bearer" });
  }

  // ── Progress detail routes ─────────────────────────────────────────────────

  if (path.startsWith("progress/") && method === "GET") {
    return ok([]);
  }

  return null; // Not a mock route — fall through (won't reach FastAPI but returns 502 gracefully)
}

// ---------------------------------------------------------------------------
// Route handler — mock-first, no auth required
// ---------------------------------------------------------------------------

async function handler(req: NextRequest, context: { params: { path: string[] } }) {
  const pathSegments: string[] = context.params?.path ?? [];

  const mockResponse = await handleMockEndpoint(req, pathSegments);
  if (mockResponse) return mockResponse;

  // Fallback: return a friendly error (FastAPI is not running in demo mode)
  return NextResponse.json(
    { detail: "This endpoint is not mocked yet in demo mode." },
    { status: 501 },
  );
}

export const GET    = handler;
export const POST   = handler;
export const PUT    = handler;
export const PATCH  = handler;
export const DELETE = handler;
