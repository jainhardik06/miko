# Species master and tree diseases

This doc outlines the interim approach and the target backend design.

## Frontend
- Two synced dropdowns on `src/app/mint/page.tsx`:
  - Common Name (e.g., Neem)
  - Scientific Name (e.g., Azadirachta indica)
- Initial list is in `src/lib/speciesData.ts` and is sorted in the UI. Admin sync can replace this with an API call later.
- Disease subform supports multiple entries with fields: `name`, `appearance`, and an image. Images are embedded as data URLs in the local metadata for now.
- The minted request metadata includes:
  - `speciesCommon`, `speciesScientific`
  - `diseases` array (name, appearance, photo data URL)
  - `diseaseNotes` (free‑text)

## Backend (proposed)
- New models created:
  - `Species` (Mongo): `scientificName`, `commonName`, optional sequestration `{low, baseline, high}`, `notes`.
    - File: `backend/src/models/species.model.js`
  - `TreeDisease` (Mongo): links either to `Tree` or `TreeSubmission`: `{ treeId?, submissionId?, name, appearance, photoUrl }`.
    - File: `backend/src/models/treeDisease.model.js`
- Temporary route:
  - `GET /api/species/list` serves a hardcoded starter list. File: `backend/src/routes/species.routes.js`
- Wire‑up done in `backend/src/index.js`.

## Next steps
- Add admin CRUD routes for Species:
  - `POST /api/species` (ADMIN)
  - `PUT /api/species/:id` (ADMIN)
  - `DELETE /api/species/:id` (ADMIN)
- Store disease images via a storage provider (S3/Cloudinary) and persist their URLs to `TreeDisease.photoUrl`.
- When a mint request is submitted, create a `TreeSubmission` first; if disease entries exist, upload photos, then create `TreeDisease` docs referencing the `submissionId`.
- Replace the frontend static list with `GET /api/species/list` and cache client‑side.
- Optional: include per‑species sequestration baseline in UI to inform estimates.
