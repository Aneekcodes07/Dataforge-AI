import { create } from 'zustand';
import { api } from '@/lib/api';

export interface Project {
  id: string;
  name: string;
  sourceType: 'url' | 'pdf' | 'csv' | 'api' | 'excel' | 'image' | 'json';
  status: 'completed' | 'in_progress' | 'failed' | 'queued';
  rowCount: number;
  columnCount: number;
  lastModified: string;
  qualityScore: number;
}

interface ValidationError {
  field: string;
  message: string;
  type: string;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  validationErrors: ValidationError[];

  fetchProjects: () => Promise<void>;
  createProject: (
    name: string,
    sourceType: Project['sourceType'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: Record<string, any>
  ) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  clearErrors: () => void;
  setValidationErrors: (errors: ValidationError[]) => void;
}

// Validation function for project creation
export function validateProject(
  name: string,
  sourceType: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate name
  if (!name || name.trim().length === 0) {
    errors.push({
      field: 'name',
      message: 'Project name is required',
      type: 'value_error',
    });
  } else if (name.length > 255) {
    errors.push({
      field: 'name',
      message: 'Project name must be less than 255 characters',
      type: 'value_error',
    });
  }

  // Validate sourceType
  const validSourceTypes = ['url', 'pdf', 'csv', 'api', 'excel', 'image', 'json'];
  if (!sourceType || !validSourceTypes.includes(sourceType)) {
    errors.push({
      field: 'sourceType',
      message: `Invalid source type. Must be one of: ${validSourceTypes.join(', ')}`,
      type: 'value_error',
    });
  }

  return errors;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  validationErrors: [],

  fetchProjects: async () => {
    set({ isLoading: true, error: null, validationErrors: [] });
    try {
      const data = await api.get<Project[]>('/projects');
      set({ projects: data, isLoading: false });
    } catch (err: unknown) {
      const errorMsg =
        (err as Error).message || 'Failed to fetch projects';
      set({ error: errorMsg, isLoading: false });
    }
  },

  createProject: async (name, sourceType, config) => {
    set({ isLoading: true, error: null, validationErrors: [] });

    // Frontend validation
    const validationErrors = validateProject(name, sourceType);
    if (validationErrors.length > 0) {
      set({ validationErrors, isLoading: false });
      return null;
    }

    try {
      // Send with snake_case field names (backend expects them)
      const newProject = await api.post<Project>('/projects', {
        name: name.trim(),
        source_type: sourceType,
        config,
      });

      set((state) => ({
        projects: [newProject, ...state.projects],
        currentProject: newProject,
        isLoading: false,
      }));
      return newProject;
    } catch (err: unknown) {
      let errorMsg = 'Failed to create project';
      let errors: ValidationError[] = [];

      const apiErr = err as {
        status?: number;
        message?: string;
        validationErrors?: ValidationError[];
        details?: { message?: string; errors?: ValidationError[] };
      };

      if (apiErr.status === 422) {
        errors =
          apiErr.validationErrors ??
          apiErr.details?.errors ??
          [];
        errorMsg = apiErr.details?.message || apiErr.message || errorMsg;
      } else {
        errorMsg = apiErr.message || errorMsg;
      }

      set({
        error: errorMsg,
        validationErrors: errors,
        isLoading: false,
      });
      return null;
    }
  },

  deleteProject: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/projects/${id}`);
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProject:
          state.currentProject?.id === id ? null : state.currentProject,
        isLoading: false,
      }));
    } catch (err: unknown) {
      set({ error: (err as Error).message || 'Failed to delete project', isLoading: false });
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project });
  },

  clearErrors: () => {
    set({ error: null, validationErrors: [] });
  },

  setValidationErrors: (errors) => {
    set({ validationErrors: errors, error: null });
  },
}));
