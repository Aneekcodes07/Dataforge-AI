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

export interface UploadedSourceFile {
  id: string;
  datasetId: string;
  originalFilename: string;
  contentType: string | null;
  sizeBytes: number;
  status: string;
}

export interface PreviewSchemaField {
  name: string;
  dtype: string;
  description: string;
  required: boolean;
}

export interface PreviewColumn {
  name: string;
  dtype: string;
  nullRate: number;
  uniqueCount: number;
  sampleValues: unknown[];
  status: string;
}

export interface ExtractionPreview {
  schema: PreviewSchemaField[];
  columns: PreviewColumn[];
  sampleRows: Record<string, unknown>[];
  qualityScore: number;
  recordCount: number;
  issues: string[];
}

export interface RecordsPage {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  offset: number;
  limit: number;
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

  /** Upload a source file for a dataset (multipart). */
  async uploadDatasetFile(datasetId: string, file: File): Promise<UploadedSourceFile> {
    const formData = new FormData();
    formData.append('file', file);
    return this.upload<UploadedSourceFile>(`/datasets/${datasetId}/files`, formData);
  }

  /** Synchronously preview a dataset's source (schema + sample + quality). */
  async previewExtraction(datasetId: string): Promise<ExtractionPreview> {
    return this.post<ExtractionPreview>(`/extraction/${datasetId}/preview`);
  }

  /** Fetch a page of a dataset's extracted records. */
  async getDatasetRecords(
    datasetId: string,
    offset = 0,
    limit = 50
  ): Promise<RecordsPage> {
    return this.get<RecordsPage>(`/datasets/${datasetId}/records`, {
      offset: String(offset),
      limit: String(limit),
    });
  }

  /** Fetch a dataset's per-column profile. */
  async getDatasetColumns(datasetId: string): Promise<PreviewColumn[]> {
    return this.get<PreviewColumn[]>(`/datasets/${datasetId}/columns`);
  }

  /** Download a dataset's extracted data (authenticated blob download). */
  async downloadDataset(
    datasetId: string,
    format: 'csv' | 'json' | 'parquet'
  ): Promise<void> {
    const token = useAuthStore.getState().token;
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(
      `${this.baseUrl}/datasets/${datasetId}/download?format=${format}`,
      { headers }
    );
    if (!response.ok) {
      throw { status: response.status, message: 'Download failed' } as ApiError;
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `dataset.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

export const api = new ApiClient(BASE_URL);
