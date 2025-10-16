# Miko AI Verification Service

A FastAPI-based microservice that verifies tree images for TreeNFT minting using a defense-in-depth pipeline:

- Tree presence check (CLIP zero-shot classification)
- Geospatial nearby search (MongoDB 2dsphere) within a radius
- Perceptual hash duplicate detection (pHash + Hamming distance)
- Deep visual similarity (EfficientNet-B0 feature vectors + cosine similarity)
- Basic EXIF/forensics heuristics

This service connects to the same MongoDB used by the backend to read existing tree records and can operate in a degraded, read-only mode if Mongo is not configured.

## Environment variables

- MONGO_URI: MongoDB connection string (same as backend DATABASE_URL)
- MONGO_DB: Database name (same as backend DATABASE_NAME, default: miko)
- MONGO_COLLECTION: Trees collection name (default: trees)
- RADIUS_METERS: Geofence radius for duplicate search (default: 20)
- PHASH_MAX_HAMMING: Max Hamming distance to consider as duplicate (default: 5)
- VECTOR_MIN_COSINE: Min cosine similarity to consider as duplicate (default: 0.95)
- TREE_CONFIDENCE_MIN: Min probability to accept "tree" classification (default: 0.5)
- LOG_LEVEL: info|debug (default: info)

## Endpoints

- GET /health
- POST /verify-tree (multipart/form-data: image, latitude, longitude)
- POST /verify-tree-multi (multipart/form-data: images[]=..., latitude, longitude)

## Local run

1) Create venv and install requirements (optional if using Docker)
2) Run server:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Docker

Build and run via docker-compose. The service is named `ai-service` and listens on port 8000.

## Notes

- On first run, models will download. Subsequent starts are faster.
- If Mongo is not configured, the service will still check for tree presence but cannot deduplicate; response will include `degraded: true`.

## Backend integration

The Node backend exposes:

- POST /api/verify/tree (proxy to AI single-image)
- POST /api/verify/tree-multi (proxy to AI multi-image)
- POST /api/mint/submit (authenticated; stores AI decision and artifacts)
- GET /api/mint/pending (ADMIN/VALIDATOR)
- POST /api/mint/:id/approve (ADMIN/VALIDATOR)
- POST /api/mint/:id/reject (ADMIN/VALIDATOR)

Roles: extend `User.role` to include `ADMIN` and `VALIDATOR`. Use JWT `role` claim enforced by `requireRole` middleware.