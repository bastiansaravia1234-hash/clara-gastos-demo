# Estado actual: acceso bancario con clave desactivado

La API rechaza los POST antes de leer credenciales. No se habilita por variables de entorno. El vault está sin permisos para authenticated/anon. La interfaz no solicita claves y las consultas al banco no se ejecutan. La eliminación de una conexión por su titular conserva los registros financieros e incluye el borrado en cascada del ciphertext.

La conexión automática requiere una futura integración autorizada y verificación independiente. El código anterior se conserva como historial de la beta y no indica compatibilidad en producción.

# Clara Bank API

Read-only bank connector for signed-in Clara users. Each connection is owned by its Supabase user ID. The service validates the current JWT against Supabase Auth, applies the caller's RLS context to every database request, and never uses a service-role key.

## Runtime

Node 22, Chromium, Xvfb and the included Dockerfile. All package versions and the lockfile are pinned. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ALLOWED_ORIGINS` (exact comma-separated origins), and a 32-byte base64 `BANK_VAULT_KEY` using the host's secret configuration. Never commit or print the vault key. Keep the same key across deployments; losing it requires users to reconnect their banks.

`schema.sql` provisions additive owner-isolated tables. Bank credentials are stored only as AES-256-GCM ciphertext with a fresh 96-bit nonce and associated data binding the ciphertext to the user and connection. Even the owner can only read ciphertext from the database. The decryption key exists solely in the API runtime.

The API never returns credentials, cookies, HTML, screenshots or scraper debug logs. Credentials are sent to a short-lived scraper process over IPC. Only one browser consultation runs at a time on the initial free service; up to eight can wait. Requests time out after three minutes. Failed login requests are not automatically retried. User-initiated bank refreshes have a cooldown. The service does not implement transfer or payment endpoints.

Successful consultations are saved as account snapshots. A user explicitly maps the bank account to a personal Clara account before any transactions are incorporated. Incorporation preserves manual records and categories, adopts exact matching records, and uses stable transaction identifiers. The last successful snapshot remains available when a subsequent query fails. Only CLP deposit accounts are incorporated; credit cards and other currencies are not supported in v1.

## HTTP

- `GET /healthz`: readiness and supported beta adapters.
- `POST /v1/connections`: authorize a new bank with `{bankId, rut, password, consentVersion}`.
- `GET /v1/connections`: own connections only.
- `POST /v1/connections/:id/sync`: request a consultation.
- `POST /v1/connections/:id/credentials`: replace own credentials and request a consultation.
- `POST /v1/connections/:id/link`: choose `{productId, accountId}`.
- `DELETE /v1/connections/:id`: revoke the connection, delete ciphertext, and stop pending work. Imported finance records remain.

All `/v1` routes require a valid current Supabase user JWT. Bodies, bank login pages and credentials are never logged. The initial manual refresh model deliberately avoids storing Supabase refresh tokens or performing unattended bank logins.

Bank adapters are beta and require real-account validation. Bank website changes, MFA, CAPTCHA or bank restrictions can prevent a consultation. These conditions are shown to the user, without bypassing the bank's verification. On free hosting, a cold start can delay the first request and a process restart can interrupt an in-flight consultation; interrupted jobs are shown as errors after their lease expires.

## Upstream

Adapter source: https://github.com/kaihv/open-banking-chile, commit `085faafd04601ddbef016b08e63e4c42e83a4dfb`, MIT. Original license: `vendor/upstream/LICENSE`. The vendored bundle is built from the included source with esbuild. Clara modifies the Falabella login selectors for the single-modal layout and omits CMR scraping for this deposit-account-only release. There is no bank affiliation or certified bank API claim.

Run `npm test` for authentication, isolation, encryption, normalization and queue tests. These tests use synthetic bank results, never live bank credentials.
