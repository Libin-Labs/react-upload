# Security Policy

Do not post credentials, private data, or exploit payloads in public issues. Report suspected vulnerabilities privately through the maintainer's verified repository security advisory channel. If none is configured, contact the maintainer before disclosing details.

This client-side package is not an authorization boundary. Validate and authorize all server operations independently. Do not store secrets in URLs, localStorage, notification content, or form defaults. Render untrusted labels as text; never pass untrusted HTML through application renderers.

Public APIs enforce documented size limits, but application callbacks and native browser resources remain application responsibilities. Test your exact browser, assistive-technology, CSP and SSR environment before deploying. Automated tests are not a security certification or accessibility audit.

Keep dependencies updated and run `npm run verify` and your dependency audit in CI. This package is distributed under the MIT License; see the packaged LICENSE file. The license does not grant access to data, services, or third-party assets used by an application.
