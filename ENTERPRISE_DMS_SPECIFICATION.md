# Enterprise Document Management System — Technical Specification

**Target deployment:** mid-sized organization, 50–500 employees
**Scope of this document:** architecture, feature specification, security model, and implementation roadmap. No code.

---

## 0. Feasibility Notice (read before implementing)

This spec covers the full surface requested, including capabilities that are normally bought, not built (endpoint DLP, network DLP, CASB-style cloud DLP). Each section below is tagged:

- 🟢 **Build** — reasonably scoped for an in-house team at this company size.
- 🟡 **Build (reduced)** — buildable, but the "textbook" version is overkill; a scoped-down version is specified.
- 🔴 **Buy / integrate** — do not build from scratch. Specified here as an integration point only. Building this in-house at 50–500 employees produces a worse, unaudited version of a product (Microsoft Purview, Netskope, Forcepoint) that already passed third-party security review — your homegrown version has not, and a DLP bypass is a breach, not a bug.

Building the 🔴 items yourself is the single most common way an internal DMS project quietly becomes a two-year security liability instead of a six-month IT win. Flag this to budget owners early.

---

## 1. Architecture Overview

### 1.1 Tech Stack

| Layer | Recommendation | Rationale |
|---|---|---|
| Frontend | React (Next.js) + TypeScript, Material UI or Ant Design | Component reuse across Admin/User portals; SSR for fast first load on document-heavy pages |
| Backend API | Node.js (NestJS) or Java (Spring Boot) | NestJS matches team velocity for mid-size teams; Spring Boot if compliance/audit tooling maturity matters more than velocity |
| Auth | OAuth2/OIDC via Keycloak (self-hosted) or Auth0/Azure AD (managed) | Do not roll your own auth. RBAC, MFA, and SSO are solved problems — buy this layer even if everything else is built in-house |
| Primary DB | PostgreSQL (managed: RDS/Cloud SQL, or self-hosted with replication) | ACID guarantees for permissions/audit data; row-level security supports multi-tenant-style department isolation |
| Search index | OpenSearch / Elasticsearch | Full-text + metadata search at document-repository scale; Postgres full-text search is not sufficient past ~100k documents with OCR text attached |
| Object storage | AWS S3 (or Azure Blob) with Object Lock / immutability policies, **or** Google Drive (Shared Drives) via the Drive API — see Section 1.3 for the tradeoff | Native versioning, lifecycle policies, and WORM (write-once-read-many) support required for legal hold — do not use local disk or NFS for primary storage |
| Cache/queue | Redis + BullMQ (or SQS) | Session cache, permission-cache invalidation, async job processing (thumbnailing, OCR, virus scan, DLP scan) |
| OCR | Tesseract (self-hosted) or AWS Textract / Azure Form Recognizer (managed) | Self-hosted Tesseract is 🟢 for typed documents; managed OCR strongly preferred for handwriting/forms |
| Malware scan | ClamAV (self-hosted) or cloud AV API | 🟢 build — ClamAV as a scanning microservice is a well-trodden pattern |
| DLP content inspection | Custom regex/pattern engine (🟡) + optional Microsoft Purview/Google DLP API (🔴 for ML-based detection) | See Section 4 |

### 1.2 Storage Backend: S3/Blob vs. Google Drive 🟡

The reference repo this spec accompanies is already built Google-Drive-native (per its `README.md`), so this is documented as a supported primary storage backend, not a hypothetical. Treat it as 🟡 — buildable and viable, with real ceilings that S3/Blob don't have. Don't default to it purely because it's already there; choose deliberately.

| Dimension | AWS S3 / Azure Blob | Google Drive (Shared Drives + Drive API) |
|---|---|---|
| Immutability / WORM for legal hold | Native (Object Lock, governance/compliance mode) — a hold is enforced by the storage provider itself, independent of your application | **No native equivalent.** A "hold" is only ever an application-enforced permission lockdown via your own Drive-service layer (revoke edit/delete scopes, monitor for out-of-band changes). This is provably weaker: anyone with direct Drive access at the domain-admin level can still alter or delete the file, and your audit chain (Section 6) becomes the *only* evidence a hold was respected — it is not itself a control. |
| Versioning | Native, unlimited retention configurable | Native, but Drive prunes older revisions after 30 days / 100 revisions per file unless "keep forever" is set per revision — this must be set programmatically on every upload, not left as a per-file manual toggle, or version history silently degrades under retention requirements (Section 2.6/3.1). |
| Cost model | Pay-per-GB + request pricing, scales predictably | Google Workspace per-seat storage pooling (typically bundled into Business/Enterprise licensing) — often cheaper at this company's scale *if* you're already paying for Workspace, since incremental storage cost is near-zero up to the pooled quota. |
| API rate limits | Effectively unbounded for this scale | Drive API has per-user and per-project query quotas (default ~12,000 queries/min/project, lower per-user ceilings). Bulk operations (mass reclassification, org-wide search reindex, legal-hold sweep across thousands of files) must be rate-limited/queued — a naive bulk job will get throttled or banned. Design async, backoff-aware batch jobs from day one, not as a later fix. |
| Data residency | Explicit region pinning per bucket | Coarser: Google Workspace offers "data regions" (US/EU) at the domain level, not per-file/per-bucket granularity. Fine for most mid-market needs; insufficient if a specific contract requires per-document jurisdiction control. |
| Malware scan / DLP hook point | You control the upload path end-to-end, so ClamAV/DLP gate runs before the object is ever persisted | Same is achievable — route all uploads through your backend (never client-direct-to-Drive), scan/DLP-check, *then* write to Drive via a service account. If any upload path bypasses your backend (e.g., a native Drive share added outside the app), it bypasses DLP and audit entirely — this is the main operational risk of a Drive-backed design and must be closed by Workspace-level admin policy (disable direct external sharing on the Shared Drive) in addition to app-level controls. |
| Encryption at rest | Customer-managed KMS keys, envelope-encrypted per object (Section 5) | Google encrypts at rest by default, but **customer-managed key control is limited** compared to S3+KMS — Workspace CSE (Client-Side Encryption) can close this gap but adds real integration complexity and is its own build/buy decision, not assumed by default here. |

**Recommendation:** Google Drive as primary storage is a legitimate choice for this company size specifically *because* Workspace licensing is often already sunk cost — but every claim elsewhere in this document that assumes S3-style storage-layer immutability (Section 2.6 legal hold, Section 5 encryption/key management) must be read with the weaker Drive-backed variant substituted, not silently assumed to still hold. The two are not interchangeable at the "just swap the storage driver" level — legal hold in particular changes from a *storage guarantee* to an *application promise*, which is a materially different risk posture to put in front of a compliance-minded evaluator.

### 1.3 Deployment Model

**Recommendation: Hybrid-leaning-cloud, single-region with cross-region backup.**

| Model | Verdict for 50–500 employees |
|---|---|
| Pure on-premise | Rejected as default — requires a dedicated ops team for HA, patching, and DR that most mid-size IT departments don't have. Only justified if regulatory data-residency rules forbid cloud storage entirely (some government, defense, or specific healthcare contracts). |
| Pure cloud (AWS/Azure/GCP) | **Recommended default.** Managed KMS, managed Postgres, S3 Object Lock, and IAM give you compliance controls (encryption, key rotation, access logging) that would otherwise need to be built and audited in-house. |
| Hybrid | Justified only when a subset of documents must stay on-prem for contractual/regulatory reasons (e.g., government contracts, specific EU data-residency clauses) while everything else runs in cloud. Adds real operational complexity — do not choose this by default "to be safe." |

Rationale for a 50–500-person org specifically: this size company almost never has a 24/7 SRE/security-ops function. Managed cloud services shift patching, physical security, and much of the compliance evidence-gathering (SOC 2 inherited controls) onto the cloud provider. Pure on-prem at this scale is usually a false economy once you price in the staff needed to run it correctly.

---

## 2. Admin Portal

### 2.1 User & Role Management (RBAC) 🟢

- **Purpose:** centralize who can do what, without per-document manual grants.
- **Key functions:**
  - Predefined roles: `SuperAdmin`, `Compliance Officer`, `Department Admin`, `Manager`, `Contributor`, `Viewer`, `External Guest`.
  - Custom role builder: permission matrix (view/upload/edit/delete/share/approve/export) composable per role.
  - SCIM or SSO-driven provisioning/deprovisioning (Azure AD / Okta) so offboarding revokes access automatically — this is the single most common audit finding in real DMS reviews (ex-employees retaining access).
- **Security consideration:** role changes must themselves be audit-logged with before/after state. Deprovisioning must be near-real-time (webhook-driven from IdP), not a nightly batch job — a nightly job leaves a same-day termination with access for up to 24 hours.
- **Visibility:** SuperAdmin and Department Admin configure; Compliance Officer has read-only oversight of all role assignments.

### 2.2 Group / Department Permissions 🟢

- **Purpose:** map real org structure (departments, projects, cross-functional teams) onto folder/document ACLs without per-user assignment sprawl.
- **Key functions:**
  - Nested group hierarchy mirroring org chart (synced from HRIS/IdP where possible, not maintained by hand).
  - Folder-level ACL inheritance with explicit override and **deny-wins** conflict resolution (explicit deny always beats an inherited allow — ambiguous inheritance is a recurring source of over-exposed folders in real deployments).
  - Time-bound group membership (e.g., contractor access auto-expires).
- **Security consideration:** inheritance cycles must be detected and rejected at write time, not discovered at read time.
- **Visibility:** Department Admins manage their own department's groups; SuperAdmin manages cross-department groups.

### 2.3 DLP Policy Engine 🟡 (build reduced scope; see Section 4 for full DLP)

- **Purpose:** stop sensitive content (PII, financial data, credentials) from being uploaded, shared externally, or downloaded without review.
- **Key functions (in-house buildable):**
  - Regex/pattern library: SSNs, credit card numbers (with Luhn checksum validation to cut false positives), API keys/secrets, email/phone patterns, custom org-defined patterns (e.g., internal project codenames, customer IDs).
  - Policy actions on match: **block upload**, **quarantine + notify admin**, **allow with watermark**, **allow with logging only** — configurable per pattern and per department.
  - Confidence scoring to reduce false positives (e.g., a 16-digit number alone is not a credit card; require Luhn + contextual keyword).
- **What NOT to build:** ML-based fuzzy PII detection (e.g., detecting an SSN described in prose without standard formatting), file-content-aware DLP inside compressed/nested archives, and cross-document data-exfiltration pattern detection (someone downloading pieces across many sessions to avoid single-event thresholds). This is 🔴 — integrate Microsoft Purview Information Protection or Google Cloud DLP API for that tier.
- **Security consideration:** the policy engine itself must run server-side on ingest, not rely on client-side validation (client-side checks are UX sugar only, trivially bypassed).
- **Visibility:** Compliance Officer owns policy definitions; Department Admin can request department-specific exceptions, approved by Compliance Officer.

### 2.4 Security Controls 🟢 (MFA/session) / 🔴 (do not build your own crypto or IP-reputation engine)

- **Key functions:**
  - MFA/2FA via TOTP (authenticator app) and/or WebAuthn/FIDO2 (hardware keys) — enforced org-wide, not opt-in, for any role above `Viewer`.
  - Session management: configurable idle timeout, concurrent-session limits, forced re-auth for sensitive actions (bulk export, permission changes).
  - IP allowlisting per department or per document sensitivity tier (e.g., "Finance" folder only accessible from corporate VPN CIDR ranges).
  - Encryption at rest (AES-256, via cloud KMS — see Section 5) and in transit (TLS 1.2+ minimum, TLS 1.3 preferred).
- **Security consideration:** MFA enforcement must not have an admin-configurable global bypass switch reachable without a second admin's approval (a single compromised admin account should not be able to disable MFA org-wide unilaterally) — implement as a two-person-rule action.
- **Visibility:** SuperAdmin configures org-wide policy; individual users cannot weaken their own MFA/session settings.

### 2.5 Audit & Compliance Logs 🟢

See Section 6 (dedicated deep-dive — this is one of the two or three areas an evaluator will actually stress-test).

### 2.6 Retention Policies & Legal Hold 🟢 (S3/Blob) / 🟡 (Google Drive — see caveat below)

- **Purpose:** enforce that documents are kept exactly as long as required — no longer (privacy/storage cost) and no shorter (regulatory/legal risk) — with an override for active litigation.
- **Key functions:**
  - Retention schedules by document class/tag/folder (e.g., "Invoices: 7 years," "HR records: per jurisdiction," "Draft/working files: 90 days").
  - Automated deletion at retention expiry, itself audit-logged.
  - Legal hold flag: suspends automated deletion for a document, folder, or user's entire corpus, overriding all retention schedules, settable only by Compliance Officer/Legal role, and itself logged with justification text.
- **Security consideration:** legal hold must be enforced at the storage layer (S3 Object Lock / immutability), not only at the application layer — an application-layer-only hold can be bypassed by anyone with direct storage access (a real gap in several commercial DMS implementations).
  - **If Google Drive is the storage backend (Section 1.2):** this guarantee does not hold as written. Drive has no Object Lock equivalent, so a hold is only a permission lockdown your own service enforces, plus revision "keep forever" pinning to stop version pruning. State this explicitly to Legal/Compliance before relying on it for active litigation — it is evidence-of-intent, not a storage-enforced guarantee, and a Workspace domain admin can still bypass it outside the app. Mitigate by restricting domain-admin Drive access itself and alerting on any out-of-band change to a held file's ACL or content hash (detected via periodic Drive API `revisions.list`/checksum comparison against the audit log, not assumed).
- **Visibility:** Compliance Officer/Legal sets and releases holds; SuperAdmin cannot override an active legal hold without a change ticket and second approval.

---

## 3. User Portal

### 3.1 Document Lifecycle: Upload / Download / Versioning / Check-in-Check-out 🟢

- **Purpose:** standard document handling without collisions or lost edits.
- **Key functions:**
  - Drag-and-drop upload with resumable chunked transfer for large files.
  - Automatic versioning on every save (not just on explicit "save as new version") with diff/compare for text-based formats.
  - Check-out locks the document for editing (visible to all viewers as "locked by X"); check-in releases the lock and creates a new version. Lock auto-expires after a configurable timeout to prevent permanent locks from forgotten sessions.
- **Security consideration:** version history must be immutable and included in retention/legal-hold scope — a common gap is retention policies applying only to the "current" version while old versions silently age out unprotected.
- **Visibility:** all authenticated users within their permission scope; check-out override (force-unlock) restricted to Department Admin.

### 3.2 Advanced Search 🟢 (full-text/metadata) / 🟡 (OCR search — depends on Section 1.1 OCR choice)

- **Key functions:** full-text search (via OpenSearch), metadata filters (author, date, department, tag, classification level), saved searches, search results scoped to the searcher's actual permissions (never show a result the user can't open — see security note below).
- **Security consideration:** this is the most common real-world DMS vulnerability class — **search index permission leakage**, where the index returns a document's existence, filename, or snippet to a user who lacks document-level access. The index must be filtered by the querying user's ACL at query time, not just at the UI result-rendering step (a raw API call to the search endpoint must enforce the same filter as the UI).
- **Visibility:** all users, scoped to their permissions automatically.

### 3.3 In-App Viewer 🟡

- **Purpose:** preview without requiring local download (this is also a DLP control — reduces the surface where sensitive content lands on an endpoint).
- **Key functions:** PDF/image native rendering in-browser; Office documents via a conversion service (LibreOffice headless in a sandboxed worker, or a managed API) rendering to PDF/image for preview rather than shipping the native editable file to the browser.
- **Security consideration:** the preview pipeline is a common malware/exploit vector if it executes untrusted file parsers with full privileges — run conversion workers in isolated, non-networked containers with no access to the rest of the infrastructure.
- **Visibility:** all users with view permission; "view-only" documents (see DRM, Section 8) render exclusively through this pipeline, with download disabled server-side, not just hidden in the UI.

### 3.4 Collaboration 🟢

- **Key functions:** threaded comments/annotations anchored to document location (page/paragraph for text, region for images/CAD); shared links with configurable expiry, password protection, and view-count/access limits; link-level audit trail (who opened a shared link, when, from what IP).
- **Security consideration:** shared links must default to **authenticated-recipient-only** (link + recipient must both be verified) for anything above a "Public" classification tier; anonymous-access links should require explicit Compliance Officer approval per document class, not be a self-service default for sensitive folders.
- **Visibility:** document owner and Department Admin can create shares; Compliance Officer can revoke any share org-wide.

### 3.5 Personal Dashboard 🟢

- **Key functions:** recent/frequently accessed files, pending approvals (workflow items awaiting the user's action), notifications (comments, shares, approaching retention deletion, document unlocked).
- **Visibility:** per-user, private by default.

---

## 4. Data Loss Prevention — Deep Dive

| Layer | Feasibility | Notes |
|---|---|---|
| Content inspection on upload/access | 🟡 build reduced | Regex + checksum-validated patterns (Section 2.3) run synchronously on upload before the file is committed to storage; async re-scan on policy updates (a file uploaded before a new pattern existed should be retroactively flagged). |
| Endpoint DLP (block OS-level copy/paste, screenshot, download) | 🔴 buy/integrate | True endpoint DLP requires an agent on every device with OS-level hooks (clipboard, screen capture, print spooler). This is a different product category (Microsoft Purview Endpoint DLP, CrowdStrike, Forcepoint) — do not attempt to build this in the DMS itself. What the DMS **can** do natively: disable browser-level download/copy for "view-only" documents (Section 3.3/8), watermark previews, and disable right-click/print in the in-app viewer. This is a deterrent, not a control — say so explicitly to stakeholders, don't market it as equivalent to real endpoint DLP. |
| Network DLP (block upload to external services, email exfiltration) | 🔴 buy/integrate | This operates at the network/proxy layer (CASB, secure web gateway), outside the DMS's control boundary entirely. The DMS's contribution is limiting what leaves it in the first place (link expiry, watermarking, no-download mode) — actual network-layer blocking is Netskope/Microsoft Defender for Cloud Apps territory. |
| Cloud DLP / CASB integration | 🔴 integrate | Expose an event webhook (upload, download, share-created, permission-change) that a CASB can subscribe to for its own policy enforcement, rather than reimplementing CASB logic in-house. |
| Incident response workflow | 🟢 build | On a DLP policy match above a configured severity: auto-quarantine the file (move out of normal access path, block download), notify Compliance Officer + document owner, optionally suspend the uploading user's write access pending review, and log the full event chain. This workflow is genuinely in scope to build — it's orchestration of your own data, not new security-control surface. |

**Bottom line for the roadmap:** phase 2 should ship the 🟡/🟢 rows above. The 🔴 rows should be scoped as "integration points" (webhooks, API for a future CASB) rather than committed features — promising in-house endpoint/network DLP and not delivering it is worse than not promising it.

---

## 5. Security & Compliance

- **Encryption:** AES-256 at rest via cloud KMS (AWS KMS/Azure Key Vault) with envelope encryption per document, not a single shared key; TLS 1.2 minimum (1.3 preferred) in transit; key rotation policy (annual minimum, or per compliance framework requirement) with rotation itself audit-logged. **If Google Drive is the storage backend:** customer-managed key control is limited to what Google Workspace exposes (default server-side encryption; customer-held keys require Workspace Client-Side Encryption, a separate integration — do not assume KMS-equivalent key ownership is available by default).
- **Key management:** cloud KMS for 🟢 default; dedicated HSM only if a specific compliance framework (e.g., certain HIPAA/finance contracts) mandates hardware-backed keys — HSM operational overhead is not justified by default at this company size.
- **Data residency:** if required, pin storage buckets/regions per data-residency requirement (e.g., EU customer data in an EU region) — this is a storage/infrastructure configuration decision, not an application feature; flag it as a deployment-config item, not a code feature. Google Drive's residency control is coarser (Workspace-level US/EU data region, not per-bucket/per-file) — confirm this is sufficient before committing to Drive as backend for any customer with a per-document residency clause.
- **Compliance readiness:**
  - **GDPR:** data subject access/export, right-to-erasure (reconciled against legal hold — erasure requests on a legal-hold document must be blocked and escalated, not silently honored), pseudonymization in audit logs where feasible (matches the existing repo's stated approach in `SECURITY_FIXES_APPLIED.md`).
  - **SOC 2:** access logging, change management evidence, vendor risk documentation for every 🔴 integration — SOC 2 auditors will ask about sub-processors.
  - **ISO 27001:** the retention/legal-hold/audit-chain design in this spec maps to A.12.4 (logging) and A.18 (compliance) controls.
  - **HIPAA:** only in scope if the company actually handles PHI — do not build HIPAA controls speculatively; it adds real cost (BAAs with every vendor, stricter audit requirements) for no benefit if unneeded. Confirm with the business before including.
- **Backup & DR:** define RPO/RTO explicitly before choosing a strategy — do not default to "as low as possible," that's a budget decision. A reasonable mid-market default: RPO 1 hour (continuous WAL archiving for Postgres, S3 cross-region replication), RTO 4 hours (documented, tested runbook — untested DR is not DR).
- **Anti-malware:** ClamAV as a synchronous upload-gate scan (Section 1.1); fail-closed by default, not fail-open — the existing repo's README states "fail-open, logged" for ClamAV, which is a deliberate UX-over-security tradeoff worth revisiting: a failed scan should block the upload and alert admins, not let unscanned content through silently.

---

## 6. Logging & Auditing

- **Structured logging:** every state-changing action (login, logout, view, download, edit, delete, share-create, share-revoke, permission-change, retention-delete) emitted as JSON with: actor ID, action, target document ID, timestamp (UTC), source IP, user agent, and result (success/denied/error).
- **Tamper-proof audit trail:** append-only storage; each log entry hash-chained to the previous entry (hash of entry N includes hash of entry N-1) so any retroactive edit or deletion breaks the chain and is detectable — matches the `verifyChain()` approach already referenced in this repo's `SECURITY_FIXES_APPLIED.md`. Periodically export chain-verification results to a separate, admin-inaccessible store (or external log sink) so a compromised SuperAdmin account can't both tamper with logs and suppress the tamper-detection alert.
- **Admin console:** real-time log viewer with filter by actor/action/document/date range/result; CSV/JSON export for auditor handoff; alerting rules (e.g., bulk download by one user in a short window, off-hours access to a sensitive folder, repeated permission-denied events).
- **Retention of logs themselves:** logs are also subject to a retention policy (commonly 1–7 years depending on framework) — this must be configured independently from document retention, since log retention requirements often outlast the documents they describe.

---

## 7. User Experience

- **Dashboard:** Material Design–based, single component library shared between Admin and User portals (reduces build/maintenance cost — do not build two separate design systems).
- **Drag-and-drop upload, bulk operations:** 🟢, standard.
- **AI-powered content classification:** 🟡 — realistic scope is auto-tagging by document type/department using a pretrained classifier (not a custom-trained model — no realistic training data volume at this company size to justify one). Treat as phase 3, optional, and explicitly non-blocking for any compliance workflow (a misclassification must never silently determine a retention or DLP outcome without human review).
- **Activity heatmaps:** 🟢, genuinely useful for both UX polish and a security signal (unusual access spikes are visible at a glance) — worth prioritizing over purely decorative features for that dual purpose.
- **Dark mode/themes:** 🟢, low cost, include if UI budget allows; correctly de-prioritized below anything in Sections 2–6 if time is short. An evaluator assessing "enterprise-grade" will not be impressed by dark mode if the audit log can be edited by a SuperAdmin without a second approver.

---

## 8. Additional Pro Features

| Feature | Feasibility | Notes |
|---|---|---|
| eSignature (DocuSign/Adobe Sign) | 🟢 integrate | API integration only — do not build a signature product. Store the signed envelope + signature certificate as a new immutable document version. |
| DRM: watermarking, view-only, restricted printing | 🟡 build reduced | Dynamic watermark (viewer's name/email/timestamp overlaid) on the in-app preview (Section 3.3) is buildable and genuinely deters casual leaking. True DRM (preventing a determined user from photographing their screen, or cracking a downloaded protected PDF) is not achievable in software alone — market this internally as "leak deterrence," not "leak prevention." |
| Workflow automation (approval chains) | 🟢 build | Configurable multi-step approval (sequential or parallel approvers), with escalation on timeout and full audit trail per step. |
| OCR for searchable scanned PDFs | 🟡 | See Section 1.1 — self-hosted for typed text, managed API for handwriting/forms. |
| Document lifecycle tracking (creation → archive → deletion) | 🟢 | This is essentially Section 2.6 (retention) plus a visible status field/timeline per document — not a separate system. |

---

## 9. Recommended Implementation Roadmap

**Phase 1 — Core security + document handling (foundation; nothing else is trustworthy without this)**
- Storage backend decision made explicitly (S3/Blob vs. Google Drive, Section 1.2) — this is a Phase 1 gate, not a later swap: legal hold, key management, and residency posture all follow from it (Sections 2.6, 5), and switching backends after documents/permissions accumulate is a migration project, not a config change.
- Auth/SSO/MFA (via IdP, not custom-built), RBAC, group/department permissions
- Upload/download/versioning/check-in-check-out
- Encryption at rest/in transit, KMS integration
- ClamAV scanning (fail-closed)
- Basic structured audit logging (not yet hash-chained)

**Phase 2 — DLP + auditing hardening**
- Regex/pattern DLP engine with quarantine workflow (Section 2.3/4)
- Hash-chained tamper-evident audit trail + admin log console (Section 6)
- Retention policies + legal hold, enforced at storage layer
- Advanced search with permission-filtered indexing
- Shared links with expiry/access control
- Webhook integration points for future CASB/network-DLP tooling

**Phase 3 — Collaboration, DRM, and "polish" features**
- In-app viewer with watermarking/view-only mode
- Comments/annotations, workflow approval chains
- eSignature integration
- OCR for scanned documents
- AI-assisted classification (advisory only, human-reviewed)
- Dashboard polish: activity heatmaps, dark mode, themes

**Explicitly out of scope for in-house build at any phase** (revisit only as a budgeted integration decision): true endpoint DLP, true network DLP/CASB, hardware HSM (unless compliance-mandated), custom-trained ML models for classification.

---

*This document is an architecture and feature specification only. No application code is included or implied to exist as a result of this document.*
