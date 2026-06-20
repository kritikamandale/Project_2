/**
 * Auth API client — thin wrappers around the FastAPI auth endpoints.
 * Used from server actions and client components (never stores tokens).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface ApiError {
  detail: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Unable to reach the server. Please check your connection and try again.");
  }

  const data = await res.json().catch(() => ({ detail: "Unknown error" }));
  if (!res.ok) {
    throw new Error((data as ApiError).detail ?? "Request failed");
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

export async function registerUser(payload: {
  email: string;
  password: string;
  full_name: string;
}) {
  return post<{ message: string }>("/register/user", payload);
}

export async function registerDermatologist(payload: {
  email: string;
  password: string;
  full_name: string;
  medical_license_number: string;
  hospital_name: string;
  specialization?: string;
  years_of_experience?: number;
  verification_document_s3_key?: string;
}) {
  return post<{ message: string }>("/register/dermatologist", payload);
}

export async function verifyEmail(payload: { email: string; otp: string }) {
  return post<{ message: string }>("/verify-email", payload);
}

export async function resendOtp(payload: { email: string }) {
  return post<{ message: string }>("/resend-otp", payload);
}

export async function forgotPassword(payload: { email: string }) {
  return post<{ message: string }>("/forgot-password", payload);
}

export async function resetPassword(payload: {
  email: string;
  otp: string;        // carries the reset token in this API
  new_password: string;
}) {
  return post<{ message: string }>("/reset-password", payload);
}
