import { useState, useRef } from 'react';
import { Globe, Plug, Upload, Plus, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (config: Record<string, any>) => void;
  isLoading: boolean;
}

// Validate URL format
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

// 1. Web Scraper Form
export function UrlForm({ onSubmit, isLoading }: FormProps) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [jsRendering, setJsRendering] = useState(false);
  const [tableOnly, setTableOnly] = useState(false);

  const validateUrl = (urlValue: string): boolean => {
    if (!urlValue.trim()) {
      setUrlError('URL is required');
      return false;
    }
    if (!isValidUrl(urlValue)) {
      setUrlError('Please enter a valid URL (e.g., https://example.com)');
      return false;
    }
    setUrlError('');
    return true;
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    if (value) {
      validateUrl(value);
    } else {
      setUrlError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(url)) return;
    onSubmit({ url, jsRendering, tableOnly });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <label htmlFor="url-input" className="block text-sm font-medium text-text-secondary">Website URL</label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" aria-hidden="true" />
          <input
            type="url"
            value={url}
            onChange={handleUrlChange}
            placeholder="https://example.com/data"
            className={cn(
              'input-base pl-10',
              urlError && 'border-danger/50 bg-danger/5'
            )}
            id="url-input"
          />
        </div>
        {urlError && (
          <div className="flex items-center gap-2 text-danger text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            {urlError}
          </div>
        )}
        {!urlError && (
          <p className="text-xs text-text-tertiary">Enter the URL of the webpage or directory you want to extract.</p>
        )}
      </div>

      <div className="space-y-4 pt-2">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={jsRendering}
            onChange={(e) => setJsRendering(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent focus:ring-accent/30"
          />
          <div className="text-left">
            <p className="text-sm font-medium text-text-primary">Enable JavaScript Rendering</p>
            <p className="text-xs text-text-secondary mt-0.5">Use headless browser for dynamic or SPA sites (slower).</p>
          </div>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={tableOnly}
            onChange={(e) => setTableOnly(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-accent focus:ring-accent/30"
          />
          <div className="text-left">
            <p className="text-sm font-medium text-text-primary">Extract Tables Only</p>
            <p className="text-xs text-text-secondary mt-0.5">Focus AI extraction only on tabular HTML elements.</p>
          </div>
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading || !!urlError}
        className="btn-primary w-full py-3 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
        id="url-submit"
      >
        {isLoading ? 'Processing...' : 'Configure & Run Extraction'}
      </button>
    </form>
  );
}

// 2. File Upload Form (PDF, CSV, Excel, Image)
export function FileForm({ onSubmit, isLoading, acceptLabel, acceptedTypes }: FormProps & { acceptLabel: string; acceptedTypes: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 500MB max file size
  const MAX_FILE_SIZE = 500 * 1024 * 1024;

  const validateFile = (fileToValidate: File): boolean => {
    if (fileToValidate.size > MAX_FILE_SIZE) {
      setFileError(`File is too large. Maximum size is 500MB. Your file is ${(fileToValidate.size / 1024 / 1024).toFixed(2)}MB`);
      return false;
    }
    setFileError('');
    return true;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      } else {
        setFile(null);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      } else {
        setFile(null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || fileError) return;
    onSubmit({ fileName: file.name, fileSize: file.size });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-text-secondary">Upload Document Source</label>
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border border-dashed border-white/10 rounded-md p-8 flex flex-col items-center justify-center gap-4 cursor-pointer bg-white/[0.01]',
            'hover:bg-white/[0.03] hover:border-accent/40 transition-all duration-200',
            dragActive && 'border-accent/60 bg-accent/[0.02]',
            fileError && 'border-danger/50 bg-danger/5'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            onChange={handleChange}
            className="hidden"
          />
          <div className={cn(
            'w-10 h-10 rounded-md flex items-center justify-center border border-white/[0.04]',
            fileError ? 'bg-danger/10 border border-danger/30 text-danger' : 'bg-white/[0.04] border border-white/[0.08] text-text-secondary'
          )}>
            <Upload className="w-5 h-5" />
          </div>
          {file && !fileError ? (
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary max-w-xs truncate">{file.name}</p>
              <p className="text-xs text-text-tertiary mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : fileError ? (
            <div className="text-center">
              <p className="text-sm font-medium text-danger">{fileError}</p>
              <p className="text-xs text-danger/70 mt-1">Try selecting a different file</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Drag & drop your file here, or browse</p>
              <p className="text-xs text-text-tertiary mt-1">{acceptLabel}</p>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !file || !!fileError}
        className={cn(
          'btn-primary w-full py-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        id="file-submit"
      >
        {isLoading ? 'Processing...' : 'Configure & Run Extraction'}
      </button>
    </form>
  );
}

// 3. API Connector Form
export function ApiForm({ onSubmit, isLoading }: FormProps) {
  const [endpoint, setEndpoint] = useState('');
  const [endpointError, setEndpointError] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>([
    { key: 'Content-Type', value: 'application/json' },
  ]);

  const validateEndpoint = (endpointValue: string): boolean => {
    if (!endpointValue.trim()) {
      setEndpointError('API endpoint is required');
      return false;
    }
    if (!isValidUrl(endpointValue)) {
      setEndpointError('Please enter a valid URL (e.g., https://api.example.com/data)');
      return false;
    }
    setEndpointError('');
    return true;
  };

  const handleEndpointChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEndpoint(value);
    if (value) {
      validateEndpoint(value);
    } else {
      setEndpointError('');
    }
  };

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...headers];
    updated[index][field] = val;
    setHeaders(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEndpoint(endpoint)) return;
    onSubmit({
      endpoint,
      method,
      headers: headers.reduce((acc, h) => {
        if (h.key) acc[h.key] = h.value;
        return acc;
      }, {} as Record<string, string>),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-[100px_1fr] gap-4">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-text-secondary">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
            className="input-base bg-[#151515] h-[38px] py-1.5 cursor-pointer"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </div>

        <div className="space-y-3">
          <label htmlFor="api-input" className="block text-sm font-medium text-text-secondary">API Endpoint</label>
          <div className="relative">
            <Plug className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" aria-hidden="true" />
            <input
              type="url"
              value={endpoint}
              onChange={handleEndpointChange}
              placeholder="https://api.example.com/v1/users"
              className={cn(
                'input-base pl-10',
                endpointError && 'border-danger/50 bg-danger/5'
              )}
              id="api-input"
            />
          </div>
          {endpointError && (
            <div className="flex items-center gap-2 text-danger text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {endpointError}
            </div>
          )}
        </div>
      </div>

      {/* Headers Panel */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-secondary">HTTP Headers</span>
          <button
            type="button"
            onClick={addHeader}
            className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Header
          </button>
        </div>

        <div className="space-y-3">
          {headers.map((h, i) => (
            <div key={i} className="flex gap-3 items-center">
              <input
                type="text"
                value={h.key}
                onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
                placeholder="Key"
                className="input-base py-1.5 flex-1"
              />
              <input
                type="text"
                value={h.value}
                onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
                placeholder="Value"
                className="input-base py-1.5 flex-1"
              />
              <button
                type="button"
                onClick={() => removeHeader(i)}
                className="p-2 text-text-tertiary hover:text-danger hover:bg-white/[0.02] rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading || !!endpointError}
        className="btn-primary w-full py-3 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
        id="api-submit"
      >
        Configure & Run Extraction
      </button>
    </form>
  );
}
