// src/types/index.ts
// ============================================================
// Shared types — API envelope + DTOs that mirror model fields
// These are the shapes returned by API routes to the client.
// ============================================================

// ─── API ENVELOPE ────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    message: string;
    code: string | null;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

// ─── MODEL ENUMS (mirror models) ─────────────
export type FrequencyOption =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'every_other_day'
  | 'weekly'
  | 'as_needed';

export type MedicineStatus = 'active' | 'completed' | 'paused' | 'discontinued';

export type RouteOfAdmin =
  | 'oral'
  | 'topical'
  | 'inhalation'
  | 'injection'
  | 'sublingual'
  | 'rectal'
  | 'ophthalmic'
  | 'otic'
  | 'nasal'
  | 'other';

export type LogStatus = 'pending' | 'taken' | 'missed' | 'skipped' | 'late';

export type MetricType =
  | 'weight'
  | 'bloodPressure'
  | 'bloodSugar'
  | 'heartRate'
  | 'temperature'
  | 'oxygenSaturation'
  | 'cholesterol'
  | 'bmi';

export type MetricStatus = 'normal' | 'low' | 'high' | 'unknown';

export type NotificationType =
  | 'reminder'
  | 'missed_dose'
  | 'refill_alert'
  | 'health_alert'
  | 'system'
  | 'adherence_report';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

// ─── AUTH DTOs ───────────────────────────────
export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  lastLogin: string | null;
  createdAt: string | null;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
}

// ─── PROFILE DTO ─────────────────────────────
export interface ProfileDTO {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  age: number | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string | null;
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  dateOfBirth?: string;
}

// ─── MEDICINE DTO ────────────────────────────
export interface MedicineDTO {
  id: string;
  name: string;
  genericName: string | null;
  dosage: string;
  frequency: FrequencyOption;
  timesPerDay: number;
  scheduledTimes: string[];
  startDate: string;
  endDate: string | null;
  routeOfAdministration: RouteOfAdmin;
  purpose: string | null;
  prescribedBy: string | null;
  pharmacy: string | null;
  refillDate: string | null;
  pillsRemaining: number | null;
  totalPills: number | null;
  notes: string | null;
  status: MedicineStatus;
  isActive: boolean;
  isValidated: boolean;
  nextDose: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateMedicinePayload {
  name: string;
  genericName?: string;
  dosage: string;
  frequency: FrequencyOption;
  timesPerDay: number;
  scheduledTimes: string[];
  startDate: string;
  endDate?: string;
  routeOfAdministration?: RouteOfAdmin;
  purpose?: string;
  prescribedBy?: string;
  pharmacy?: string;
  refillDate?: string;
  pillsRemaining?: number;
  totalPills?: number;
  notes?: string;
  status?: MedicineStatus;
}

export type UpdateMedicinePayload = Partial<CreateMedicinePayload>;

// ─── MEDICATION LOG DTO ──────────────────────
export interface MedicationLogDTO {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string;
  dueDate: string;
  takenAt: string | null;
  status: LogStatus;
  minutesLate: number | null;
  notes: string | null;
  skippedReason: string | null;
  isOverdue: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type LogAction = 'taken' | 'missed' | 'skipped';

export interface UpdateLogPayload {
  action: LogAction;
  takenAt?: string;
  reason?: string;
}

// ─── HEALTH METRIC DTO ───────────────────────
export interface HealthMetricDTO {
  id: string;
  metricType: MetricType;
  value: number;
  systolic: number | null;
  diastolic: number | null;
  unit: string;
  recordedAt: string;
  notes: string | null;
  source: string | null;
  deviceId: string | null;
  status: MetricStatus;
  displayValue: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateHealthMetricPayload {
  metricType: MetricType;
  value?: number;
  systolic?: number;
  diastolic?: number;
  unit: string;
  recordedAt?: string;
  notes?: string;
  source?: string;
  deviceId?: string;
}

export type UpdateHealthMetricPayload = Partial<CreateHealthMetricPayload>;

// ─── NOTIFICATION DTO ────────────────────────
export interface NotificationDTO {
  id: string;
  medicineId: string | null;
  medicationLogId: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  timeAgo: string;
  createdAt: string | null;
}

// ─── DASHBOARD DTO ───────────────────────────
export interface DashboardDTO {
  user: {
    fullName: string;
    email: string;
  };
  activeMedicinesCount: number;
  dueTodayCount: number;
  takenTodayCount: number;
  adherenceRate: number;
  dueToday: MedicationLogDTO[];
  upcomingMedicines: Array<{
    id: string;
    name: string;
    dosage: string;
    nextDose: string | null;
  }>;
  recentHealthMetrics: HealthMetricDTO[];
  notifications: NotificationDTO[];
  unreadNotificationsCount: number;
}