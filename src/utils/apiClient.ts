/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JalMitra Backend API Client
 * Centralised fetch wrapper for all backend endpoints.
 */

import type { Language, CropType, IrrigationMethod, NotificationChannel } from './waterEngine';

// ---------------------------------------------------------------------------
// Base URL — configurable via Vite env var, falls back to localhost dev server
// ---------------------------------------------------------------------------
const BASE_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
    ...options,
  });

  // Attempt to parse body for both success and error paths
  let body: unknown;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const msg =
      typeof body === 'object' && body !== null && 'error' in (body as Record<string, unknown>)
        ? String((body as Record<string, unknown>).error)
        : `API request failed (${res.status})`;
    throw new ApiError(msg, res.status, body);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface GenerateAdvisoryParams {
  talukaId: string;
  crop: CropType;
  acres: number;
  currentMethod: IrrigationMethod;
  language: Language;
  diagnosticNote?: string;
}

export interface AdvisoryResponse {
  advisoryText: string;
  kvkReference: string;
  actionItems: string[];
  waterSavingEstimate?: string;
  generatedAt: string;
  [key: string]: unknown;
}

export interface AnalyzeCropImageParams {
  imageBase64: string;
  mimeType: string;
  crop: CropType;
  talukaId: string;
  soilMoisturePct: number;
  language: Language;
}

export interface DiagnosticResponse {
  diagnosis: string;
  confidence: number;
  irrigationAdjustment: string;
  kvkRemedy: string;
  [key: string]: unknown;
}

export interface DispatchNotificationParams {
  channel: NotificationChannel;
  talukaId: string;
  recipientMode: 'cohort' | 'single';
  farmerName?: string;
  farmerPhone?: string;
  smsText: string;
  whatsappText: string;
  language: Language;
}

export interface DispatchResponse {
  success: boolean;
  messageId?: string;
  [key: string]: unknown;
}

export interface NotificationLogEntry {
  id: string;
  timestamp: string;
  channel: string;
  recipient: string;
  status: string;
  [key: string]: unknown;
}

export interface TalukaInfo {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface WeatherData {
  talukaId: string;
  forecast: unknown;
  [key: string]: unknown;
}

export interface SubmitResolutionParams {
  talukaId: string;
  villageName: string;
  resolutionType: string;
  targetAcreage: number;
  language: Language;
}

export interface ResolutionResponse {
  success: boolean;
  resolution?: unknown;
  [key: string]: unknown;
}

export interface ResolutionRecord {
  id: string;
  villageName: string;
  resolutionType: string;
  targetAcreage: number;
  createdAt: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Generate a Gemini AI-powered irrigation advisory for a taluka+crop. */
export async function generateAdvisory(
  params: GenerateAdvisoryParams,
): Promise<AdvisoryResponse> {
  return request<AdvisoryResponse>('/api/advisory/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Analyse a crop field image for water-stress vs disease diagnosis. */
export async function analyzeCropImage(
  params: AnalyzeCropImageParams,
): Promise<DiagnosticResponse> {
  return request<DiagnosticResponse>('/api/diagnostic/analyze', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Dispatch an SMS / WhatsApp notification to farmers. */
export async function dispatchNotification(
  params: DispatchNotificationParams,
): Promise<DispatchResponse> {
  return request<DispatchResponse>('/api/notification/dispatch', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Fetch the notification delivery log for a taluka. */
export async function getNotificationLog(
  talukaId: string,
): Promise<NotificationLogEntry[]> {
  return request<NotificationLogEntry[]>(`/api/notification/log/${encodeURIComponent(talukaId)}`);
}

/** List all available talukas from the backend telemetry service. */
export async function getTalukas(): Promise<TalukaInfo[]> {
  return request<TalukaInfo[]>('/api/telemetry/talukas');
}

/** Fetch live weather / forecast data for a taluka. */
export async function getWeather(talukaId: string): Promise<WeatherData> {
  return request<WeatherData>(`/api/telemetry/weather/${encodeURIComponent(talukaId)}`);
}

/** Submit a Gram Panchayat committee resolution. */
export async function submitResolution(
  params: SubmitResolutionParams,
): Promise<ResolutionResponse> {
  return request<ResolutionResponse>('/api/committee/resolution', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Fetch all committee resolutions for a taluka. */
export async function getResolutions(
  talukaId: string,
): Promise<ResolutionRecord[]> {
  return request<ResolutionRecord[]>(
    `/api/committee/resolutions/${encodeURIComponent(talukaId)}`,
  );
}
