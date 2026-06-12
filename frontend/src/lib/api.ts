import { useAuthStore } from '@/stores/authStore';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ValidationErrorDetail {
  field: string;
  message: string;
  type: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: Record<string, unknown>;
  validationErrors?: ValidationErrorDetail[];
}

interface FastApiValidationItem {
  type: string;
  loc: (string | number)[];
  msg: string;
}

/** Normalize FastAPI 422 payloads into a consistent validation error list. */
export function parseValidationErrors(body: Record<string, unknown>): ValidationErrorDetail[] {
  const detail = body.detail;

  if (Array.isArray(detail)) {
    return detail.map((item) => {
      const error = item as FastApiValidationItem;
      const fieldPath = error.loc?.filter((part) => part !== 'body') ?? [];
      const field = fieldPath.length > 0 ? String(fieldPath[fieldPath.length - 1]) : 'unknown';
      return {
        field,
        message: error.msg,
        type: error.type,
      };
    });
  }

  if (detail && typeof detail === 'object' && 'errors' in detail) {
    const nested = (detail as { errors: ValidationErrorDetail[] }).errors;
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return [];
}

function getErrorMessage(
  body: Record<string, unknown>,
  statusText: string
): string {
  const detail = body.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: string }).message);
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const errors = parseValidationErrors(body);
    return errors.map((e) => e.message).join('; ') || 'Validation failed';
  }

  if (typeof body.message === 'string') {
    return body.message;
  }

  return statusText;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = useAuthStore.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = {
        status: response.status,
        message: response.statusText,
      };

      try {
        const body = (await response.json()) as Record<string, unknown>;
        error.message = getErrorMessage(body, response.statusText);
        error.details = body;

        if (response.status === 422) {
          error.validationErrors = parseValidationErrors(body);
        }
      } catch {
        // Response body wasn't JSON
      }

      // Auto-logout on 401
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }

      throw error;
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async upload<T>(path: string, formData: FormData): Promise<T> {
    const headers: HeadersInit = {};
    const token = useAuthStore.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Don't set Content-Type for FormData — browser sets it with boundary

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    return this.handleResponse<T>(response);
  }
}

export const api = new ApiClient(BASE_URL);
