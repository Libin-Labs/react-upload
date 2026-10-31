# @lp-labs/react-upload

Validated file selection, file drops and bounded concurrent uploads with progress/cancellation. React 18+ peer only; native XMLHttpRequest and FormData transport. ESM, CommonJS and TypeScript included.

## Installation

```sh
npm install @lp-labs/react-upload
```

## Quick Start

```jsx
import { Upload } from '@lp-labs/react-upload';
export default function Example() {
  return <Upload url="/api/files" accept=".pdf,image/*" maxFiles={5} maxFileSize={10485760} />;
}
```

The endpoint must accept POST multipart data under field `file` and respond with a2xx status. Uploading is an explicit user action, not automatic after selection.

## API

`Upload` supplies file input, drop handling, Upload/Cancel controls, status and progress. `children(api)` replaces its default status/actions. `useUpload(options)` returns entries, error, isUploading, addFiles(FileList|File[]), start():Promise<void>, cancel(id?), remove(id), retry(id). Retry is intended for error/canceled entries. Entries expose id,file,status,progress,error. A start processes the currently queued snapshot; newly added files need another start.

Options: url, accept, maxFiles: 10, maxFileSize: 10 MiB, maxTotalSize: 50 MiB, and concurrency: 2, headers, withCredentials=false, allowCrossOrigin=false, onComplete(file), or custom upload(file,{signal,onProgress}). Custom transport owns response parsing and must honor AbortSignal. Native uploadFile additionally supports fieldName and timeout (default: 120 s; range: 1 s–1 h). validateFiles and validateUploadUrl are exported. Unmount aborts active uploads and suppresses late updates.

## Benefits

| Area                   | Details                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| Explicit resource caps | Bound file count, individual size, total bytes, and concurrency. |
| Cancelable transport   | Track progress and cancel active requests.                       |
| Extension point        | Use custom upload transport or the built-in multipart request.   |

## Customization

| Area        | Details                                                              |
| ----------- | -------------------------------------------------------------------- |
| Validation  | Set accepted types, count, per-file size, and aggregate size.        |
| Transport   | Configure URL, safe headers, credentials, timeout, or custom upload. |
| Concurrency | Limit simultaneous uploads from one to eight.                        |

## Security And Limits

Hard caps: 1,000 files, 1 GiB per file, 2 GiB total, and 8 workers; native transport timeout is bounded. File names reject slashes/control characters. Accept/MIME/extension checks are usability checks, not malware detection: servers must independently enforce size, MIME sniffing, authentication, authorization, safe names, storage isolation, antivirus policy and CSRF controls. Browser-provided metadata can be forged. Same-origin HTTP(S) URLs are default; cross-origin requires explicit opt-in and CORS. HTTPS pages reject insecure remote HTTP upload targets. URL credentials, non-HTTP schemes, newline headers and manually supplied multipart Content-Type are rejected. Never hard-code credentials in component props or repositories. Cancellation cannot guarantee a server stopped processing a request. No resumable/chunked upload, hashing, cloud-signing or response-body parsing is included.

## Support

[Donate via PayPal](https://www.paypal.me/LibinPrasanth). Author: [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/).

## License

MIT License. See the packaged [LICENSE](LICENSE) file.
