'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
export interface UploadLimits {
  maxFiles?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  accept?: string;
}
export interface UploadEntry {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'success' | 'error' | 'canceled';
  progress: number;
  error?: string;
}
export function validateFiles(
  files: readonly File[],
  {
    maxFiles = 10,
    maxFileSize = 10485760,
    maxTotalSize = 52428800,
    accept = '',
  }: UploadLimits = {},
) {
  if (
    !Number.isInteger(maxFiles) ||
    maxFiles < 1 ||
    maxFiles > 1000 ||
    !Number.isSafeInteger(maxFileSize) ||
    maxFileSize < 1 ||
    maxFileSize > 1073741824 ||
    !Number.isSafeInteger(maxTotalSize) ||
    maxTotalSize < 1 ||
    maxTotalSize > 2147483648
  )
    throw new RangeError('Invalid upload limits.');
  if (files.length > maxFiles) throw new RangeError('File count limit exceeded.');
  let total = 0;
  const rules = accept
    .toLowerCase()
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean);
  for (const file of files) {
    if (!file.name || /[\x00-\x1f\x7f/\\]/.test(file.name) || file.size > maxFileSize)
      throw new TypeError('File name or size is not allowed.');
    total += file.size;
    if (total > maxTotalSize) throw new RangeError('Total upload size limit exceeded.');
    if (
      rules.length &&
      !rules.some((rule) =>
        rule.startsWith('.')
          ? file.name.toLowerCase().endsWith(rule)
          : rule.endsWith('/*')
            ? file.type.toLowerCase().startsWith(rule.slice(0, -1))
            : file.type.toLowerCase() === rule,
      )
    )
      throw new TypeError('File type is not accepted.');
  }
  return files;
}
export function validateUploadUrl(url: string, base: string, allowCrossOrigin = false) {
  if (url.length > 2048) throw new RangeError('Upload URL too long.');
  const target = new URL(url, base);
  const origin = new URL(base);
  if (
    !['http:', 'https:'].includes(target.protocol) ||
    target.username ||
    target.password ||
    (!allowCrossOrigin && target.origin !== origin.origin) ||
    (target.protocol === 'http:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
      origin.protocol === 'https:')
  )
    throw new TypeError('Unsafe upload URL or cross-origin upload denied.');
  return target;
}
export function uploadFile(
  file: File,
  {
    url,
    signal,
    onProgress,
    headers = {},
    withCredentials = false,
    allowCrossOrigin = false,
    fieldName = 'file',
    timeout = 120000,
  }: {
    url: string;
    signal: AbortSignal;
    onProgress: (progress: number) => void;
    headers?: Record<string, string>;
    withCredentials?: boolean;
    allowCrossOrigin?: boolean;
    fieldName?: string;
    timeout?: number;
  },
): Promise<void> {
  if (timeout < 1000 || timeout > 3600000 || !Number.isFinite(timeout) || fieldName.length > 128)
    throw new RangeError('Invalid upload timeout or field name.');
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new DOMException('Canceled', 'AbortError'));
      return;
    }
    const target = validateUploadUrl(url, window.location.href, allowCrossOrigin);
    const xhr = new window.XMLHttpRequest();
    const cleanup = () => signal.removeEventListener('abort', cancel);
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cancel = () => {
      xhr.abort();
    };
    xhr.open('POST', target);
    xhr.timeout = timeout;
    xhr.withCredentials = withCredentials;
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type' || /[\r\n]/.test(key + value) || value.length > 8192)
        throw new TypeError('Invalid multipart upload header.');
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, (event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => fail(new Error('Upload network error.'));
    xhr.ontimeout = () => fail(new Error('Upload timed out.'));
    xhr.onabort = () => fail(new DOMException('Upload canceled', 'AbortError'));
    signal.addEventListener('abort', cancel, { once: true });
    const form = new window.FormData();
    form.append(fieldName, file, file.name);
    xhr.send(form);
  });
}
export interface UploadOptions extends UploadLimits {
  url?: string;
  concurrency?: number;
  headers?: Record<string, string>;
  allowCrossOrigin?: boolean;
  withCredentials?: boolean;
  upload?: (
    file: File,
    options: {
      signal: AbortSignal;
      onProgress: (value: number) => void;
    },
  ) => Promise<void>;
  onComplete?: (file: File) => void;
}
export function useUpload(options: UploadOptions = {}) {
  const { concurrency = 2 } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new RangeError('Concurrency must be 1..8.');
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const reference = useRef(entries);
  reference.current = entries;
  const [error, setError] = useState<Error | null>(null);
  const [isUploading, setUploading] = useState(false);
  const alive = useRef(false);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(false);
  const counter = useRef(0);
  const config = useRef(options);
  config.current = options;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      for (const controller of controllers.current.values()) controller.abort();
    };
  }, []);
  const update = (id: string, patch: Partial<UploadEntry>) => {
    if (!alive.current) return;
    const next = reference.current.map((entry) =>
      entry.id === id ? { ...entry, ...patch } : entry,
    );
    reference.current = next;
    setEntries(next);
  };
  const addFiles = (input: FileList | readonly File[]) => {
    try {
      if (input.length > (options.maxFiles ?? 10))
        throw new RangeError('File count limit exceeded.');
      const files = Array.from(input);
      validateFiles([...reference.current.map((entry) => entry.file), ...files], options);
      const next = [
        ...reference.current,
        ...files.map((file) => ({
          id: `upload-${++counter.current}`,
          file,
          status: 'queued' as const,
          progress: 0,
        })),
      ];
      reference.current = next;
      setEntries(next);
      setError(null);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error(String(reason)));
      return false;
    }
  };
  const cancel = (id?: string) => {
    for (const entry of reference.current)
      if ((id === undefined || entry.id === id) && ['queued', 'uploading'].includes(entry.status)) {
        controllers.current.get(entry.id)?.abort();
        update(entry.id, { status: 'canceled' });
      }
  };
  const start = async () => {
    if (running.current) return;
    running.current = true;
    setUploading(true);
    const queue = reference.current.filter((entry) => entry.status === 'queued');
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const entry = queue[cursor++]!;
        if (!alive.current) return;
        if (reference.current.find((item) => item.id === entry.id)?.status !== 'queued') continue;
        const controller = new AbortController();
        controllers.current.set(entry.id, controller);
        update(entry.id, { status: 'uploading', error: undefined });
        try {
          const progress = (value: number) => {
            if (Number.isFinite(value))
              update(entry.id, { progress: Math.max(0, Math.min(100, value)) });
          };
          if (config.current.upload)
            await config.current.upload(entry.file, {
              signal: controller.signal,
              onProgress: progress,
            });
          else {
            if (!config.current.url) throw new Error('Provide url or upload callback.');
            await uploadFile(entry.file, {
              url: config.current.url,
              headers: config.current.headers,
              allowCrossOrigin: config.current.allowCrossOrigin,
              withCredentials: config.current.withCredentials,
              signal: controller.signal,
              onProgress: progress,
            });
          }
          if (!controller.signal.aborted) {
            update(entry.id, { status: 'success', progress: 100 });
            config.current.onComplete?.(entry.file);
          }
        } catch (reason) {
          update(entry.id, {
            status: controller.signal.aborted ? 'canceled' : 'error',
            error: reason instanceof Error ? reason.message : String(reason),
          });
        } finally {
          controllers.current.delete(entry.id);
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    } finally {
      running.current = false;
      if (alive.current) setUploading(false);
    }
  };
  const remove = (id: string) => {
    cancel(id);
    const next = reference.current.filter((entry) => entry.id !== id);
    reference.current = next;
    setEntries(next);
  };
  const retry = (id: string) => update(id, { status: 'queued', progress: 0, error: undefined });
  return { entries, error, isUploading, addFiles, start, cancel, remove, retry };
}
export function Upload({
  children,
  label = 'Files',
  ...options
}: UploadOptions & {
  children?: (api: ReturnType<typeof useUpload>) => ReactNode;
  label?: string;
}) {
  const api = useUpload(options);
  const field = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        api.addFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={field}
        type="file"
        multiple
        accept={options.accept}
        aria-label={label}
        onChange={(event) => {
          if (event.currentTarget.files) api.addFiles(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
      />
      {children ? (
        children(api)
      ) : (
        <>
          <button
            type="button"
            disabled={api.isUploading || !api.entries.some((entry) => entry.status === 'queued')}
            onClick={() => void api.start()}
          >
            Upload
          </button>
          <button type="button" disabled={!api.isUploading} onClick={() => api.cancel()}>
            Cancel uploads
          </button>
          <ul>
            {api.entries.map((entry) => (
              <li key={entry.id}>
                {entry.file.name}: {entry.status}{' '}
                <progress
                  value={entry.progress}
                  max={100}
                  aria-label={`Upload ${entry.file.name}`}
                />
                {entry.error && <span role="alert">{entry.error}</span>}
              </li>
            ))}
          </ul>
          {api.error && <p role="alert">{api.error.message}</p>}
        </>
      )}
    </div>
  );
}
export default Upload;
