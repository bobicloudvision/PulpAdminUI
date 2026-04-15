# Pulp Admin UI

![Dashboard with summary counts, cache notice, shortcuts, and session](screenshots/screenshot.png)

Web admin console for [Pulp 3](https://pulpproject.org/)—manage users, groups, distributions, RPM content, and file uploads against your Pulp API. Built with **Next.js** (App Router), **React 19**, **TypeScript**, and **Tailwind CSS**. Server routes proxy the Pulp REST API with cookie-based sessions.

## Features

### Overview & authentication

- **Dashboard** — Summary cards for users, groups, RPM repositories, and Debian repositories. Counts are loaded via a **short-lived server cache** (~60s) with a **Refresh summary** control when you need up-to-date numbers. **Shortcuts** grid links to users, groups, repositories, content, and upload.
- **Authentication** — Log in against Pulp; **cookie-based session**; protected app pages and API routes; session card with **logout**.

### Identity & access

- **Users** — List and **create** Pulp users (staff/active flags, profile fields).
- **Groups** — List and **create** access groups.

### Repositories (RPM & Debian APT)

- **List & switch** — Paginated list with **RPM** / **DEB** toggle; refresh; actions for create, edit, content, publish, distribute, and delete.
- **Create** — New **RPM** or **Debian APT** repository by name.
- **Edit** — Load repository from Pulp and **PATCH** writable fields. **RPM** aligns with the Pulp `RpmRepository` serializer (name, description, `retain_repo_versions`, `remote`, `autopublish`, `metadata_signing_service`, `retain_package_versions`, metadata/package checksum types, `gpgcheck`, `repo_gpgcheck`, `sqlite_metadata`) plus read-only metadata (created time, latest version href, versions list href). **Debian** supports name, description, retain versions, remote, autopublish, structured repo flag.
- **Publish** — Trigger **RPM** or **Debian** publication; wait on async tasks when needed; **success panel** with publication href and task when available (including parsing `created_resources` from completed tasks). Errors show in the session banner **above** the main content.
- **Repository content** — Browse content for a repository (query by `pulp_href`).
- **RPM version history** — **Versions** lists `RpmRepositoryVersion` rows from `…/versions/` with **added / removed / present** content summaries per type (e.g. `rpm.package`). Rows link to a **version detail** page.
- **RPM single version** — **GET** a version (`…/versions/N/`): number, timestamps, hrefs, `base_version`, content summary. **Delete version** with confirmation; redirect back to the parent repository’s version list.
- **Distributions (RPM)** — From the list, **Distribute** creates an RPM distribution for that repository (`POST` to Pulp) with auto-generated name `«repo»-dist` and `base_path` matching the repo name. The table surfaces **distribution URLs** where applicable. **Delete repository** can optionally remove linked **RPM** distributions (APT distributions are not removed from this flow).

### Content & uploads

- **Content** — List **RPM package** content with pagination; open **package detail** (checksums, NVRA, artifact). **`/content/preview`** accepts `id` or `href` query params and redirects to the package page or list.
- **Uploads** — List upload sessions; **chunked upload** for large files; optional **create RPM content** from an artifact; **add content to an RPM repository** by name.

### UI

- **Sidebar** — Grouped navigation (**Overview**, **Identity**, **Access**, **Repository**): Dashboard, Users, Groups, Repositories, Content, Upload file. Nav tiles with hover/active states and **reduced-motion** support; footer shows **live user and group counts**.
- **Administration layout** — Consistent shell with titles and session; **errors** render under the header so API or publish failures stay visible without scrolling past the main card.

## Getting started

1. Copy environment:

   ```bash
   cp .env.example .env
   ```

   Set `PULP_BASE_URL` to your Pulp API v3 base (e.g. `https://your-host/pulp/api/v3`) and `PULP_PROJECT_NAME` for the sidebar logo title.

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) (redirects to the users list after login).

## Scripts

| Command        | Description        |
| -------------- | ------------------ |
| `npm run dev`  | Development server |
| `npm run build` | Production build  |
| `npm run start` | Start production  |
| `npm run lint`  | ESLint             |

## Discoverability

**Keywords:** pulp, pulp 3, pulp3, repository manager, RPM repository, YUM/DNF content, artifact upload, chunked file upload, distribution, publication, user management, group management, Next.js admin, React dashboard, TypeScript UI, Tailwind, Pulp REST API v3, content gateway, package hosting.
