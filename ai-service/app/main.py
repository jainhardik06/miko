from __future__ import annotations
import os
from dotenv import load_dotenv
import tempfile
from typing import Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from loguru import logger

from .ai_checks import (
    Thresholds, read_image_from_bytes, compute_phash, hamming_distance_hex,
    is_tree_like, encode_feature_vector, max_cosine_similarity,
    extract_basic_exif, error_level_analysis, blur_score_fft, aggregate_multi_view, orb_match_ratio
)
from .database import MongoRepo

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
app = FastAPI(title="Miko AI Verification Service")

# Config
RADIUS_METERS = float(os.getenv('RADIUS_METERS', '20'))
PHASH_MAX_HAMMING = int(os.getenv('PHASH_MAX_HAMMING', '5'))
VECTOR_MIN_COSINE = float(os.getenv('VECTOR_MIN_COSINE', '0.95'))
TREE_CONFIDENCE_MIN = float(os.getenv('TREE_CONFIDENCE_MIN', '0.5'))
CLUSTER_MAX_IN_RADIUS = int(os.getenv('CLUSTER_MAX_IN_RADIUS', '5'))

THRESHOLDS = Thresholds(
    phash_max_hamming=PHASH_MAX_HAMMING,
    vector_min_cosine=VECTOR_MIN_COSINE,
    tree_confidence_min=TREE_CONFIDENCE_MIN
)

repo = MongoRepo()
repo.connect()


@app.get("/health")
def health():
    return {"ok": True, "degraded": not repo.is_connected()}


@app.get("/config")
def config():
    # Do not expose MONGO_URI
    return {
        "radius_meters": RADIUS_METERS,
        "phash_max_hamming": PHASH_MAX_HAMMING,
        "vector_min_cosine": VECTOR_MIN_COSINE,
        "tree_confidence_min": TREE_CONFIDENCE_MIN,
        "cluster_max_in_radius": CLUSTER_MAX_IN_RADIUS,
        "db_connected": repo.is_connected()
    }


@app.post("/verify-tree")
async def verify_tree(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...)
):
    if image.content_type is None or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type; must be an image.")

    data = await image.read()
    img = read_image_from_bytes(data)

    # Step 1: Tree present check
    tree_ok, tree_score = is_tree_like(img, THRESHOLDS)
    if not tree_ok:
        return JSONResponse(status_code=422, content={
            "status": "REJECTED",
            "reason": "No tree detected with sufficient confidence",
            "details": {"tree_score": tree_score}
        })

    # Compute new image features
    new_ph = compute_phash(img)
    new_vec = encode_feature_vector(img)  # shape (1, D)

    result: Dict[str, Any] = {
        "status": "PASSED",
        "reason": "",
        "metrics": {
            "tree_score": tree_score
        },
        "degraded": not repo.is_connected(),
        "artifacts": {
            "phash": new_ph,
            "vector": new_vec.reshape(-1).tolist()
        }
    }

    # If no DB, we can't dedupe; return degraded pass
    if not repo.is_connected():
        result["reason"] = "No DB connection; only tree presence validated"
        return result

    # Step 2: Geofence query
    nearby = repo.find_nearby(latitude, longitude, RADIUS_METERS)
    if len(nearby) > CLUSTER_MAX_IN_RADIUS:
        return {
            "status": "FLAGGED",
            "reason": "Dense cluster of existing trees in radius; manual review required",
            "metrics": {"cluster_count": len(nearby)},
            "degraded": False
        }

    # Step 3a: pHash quick reject
    for rec in nearby:
        if rec.phash:
            dist = hamming_distance_hex(new_ph, rec.phash)
            if dist <= THRESHOLDS.phash_max_hamming:
                return {
                    "status": "REJECTED",
                    "reason": "Duplicate by perceptual hash",
                    "duplicate_of": str(rec.id),
                    "metrics": {"phash_hamming": dist},
                    "degraded": False
                }

    # Step 3b: Deep similarity
    existing_vecs = [
        (rec.id, np_vec) for rec in nearby for np_vec in ([None] if rec.vector is None else [rec.vector])
    ]
    # Convert to (id, np.ndarray) list
    vecs = []
    ids = []
    for _id, v in existing_vecs:
        if v is not None:
            ids.append(_id)
            vecs.append(v)
    # Compute cosine similarity
    if vecs:
        import numpy as np
        mat = [np.array(v, dtype=np.float32).reshape(1, -1) for v in vecs]
        # Stack and compare
        mat = np.vstack(mat)
        from sklearn.metrics.pairwise import cosine_similarity
        sims = cosine_similarity(new_vec, mat)[0]
        top_idx = int(np.argmax(sims))
        top_sim = float(sims[top_idx])
        if top_sim >= THRESHOLDS.vector_min_cosine:
            return {
                "status": "REJECTED",
                "reason": "Duplicate by deep visual similarity",
                "duplicate_of": str(ids[top_idx]),
                "metrics": {"cosine": top_sim},
                "degraded": False
            }
        result["metrics"]["max_cosine"] = top_sim

    result["reason"] = "All checks passed"
    return result


@app.post("/verify-tree-multi")
async def verify_tree_multi(
    images: list[UploadFile] = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...)
):
    if not images or len(images) < 2:
        raise HTTPException(status_code=400, detail="At least 2 images required")

    imgs = []
    phashes = []
    vecs = []
    tree_scores = []
    forensic = []
    for up in images:
        if up.content_type is None or not up.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="All files must be images")
        data = await up.read()
        img = read_image_from_bytes(data)
        ok, score = is_tree_like(img, THRESHOLDS)
        if not ok:
            return JSONResponse(status_code=422, content={
                "status": "REJECTED",
                "reason": "A view lacks a tree with sufficient confidence",
                "details": {"min_tree_score": score}
            })
        imgs.append(img)
        tree_scores.append(score)
        phashes.append(compute_phash(img))
        vecs.append(encode_feature_vector(img))
        forensic.append({
            "ela": error_level_analysis(img),
            "blur": blur_score_fft(img)
        })

    # Intra-set duplicate check: ensure views are not trivial copies
    for i in range(len(phashes)):
        for j in range(i+1, len(phashes)):
            if hamming_distance_hex(phashes[i], phashes[j]) <= THRESHOLDS.phash_max_hamming:
                return {
                    "status": "REJECTED",
                    "reason": "Provided views are too similar (pHash)",
                    "metrics": {"pair": [i,j]}
                }

    # Additional intra-set feature matching: ensure views are from same instance
    if len(imgs) >= 2:
        try:
            ratios = []
            for i in range(len(imgs)-1):
                ratios.append(orb_match_ratio(imgs[i], imgs[i+1]))
            avg_ratio = sum(ratios)/len(ratios) if ratios else 0.0
            if ratios and avg_ratio < 0.05:
                return {
                    "status": "REJECTED",
                    "reason": "Views appear to be unrelated objects (low feature match)",
                    "metrics": {"avg_orb_match": avg_ratio}
                }
        except NameError:
            # OpenCV not installed; skip strict enforcement, just report metric
            avg_ratio = -1.0

    # EXIF time sanity
    # If EXIF times wildly inconsistent (not strictly parsed here), you might flag for review.
    # We leave as soft signal in metrics for now.

    # Aggregate representation for the submitted tree
    agg_vec = aggregate_multi_view(vecs)

    # Geofence and dedupe against existing
    degraded = not repo.is_connected()
    if not degraded:
        nearby = repo.find_nearby(latitude, longitude, RADIUS_METERS)
        if len(nearby) > CLUSTER_MAX_IN_RADIUS:
            return {
                "status": "FLAGGED",
                "reason": "Dense cluster of existing trees in radius; manual review required",
                "metrics": {"cluster_count": len(nearby)},
                "degraded": False
            }
        # Compare aggregate vector to existing vectors
        ids, mat = [], []
        import numpy as np
        for rec in nearby:
            if rec.vector:
                ids.append(rec.id)
                mat.append(np.array(rec.vector, dtype=np.float32).reshape(1,-1))
        if mat:
            mat = np.vstack(mat)
            from sklearn.metrics.pairwise import cosine_similarity
            sims = cosine_similarity(agg_vec, mat)[0]
            top_idx = int(np.argmax(sims))
            top_sim = float(sims[top_idx])
            if top_sim >= THRESHOLDS.vector_min_cosine:
                return {
                    "status": "REJECTED",
                    "reason": "Duplicate tree detected across views",
                    "duplicate_of": str(ids[top_idx]),
                    "metrics": {"cosine": top_sim},
                    "degraded": False
                }

    return {
        "status": "PASSED",
        "reason": "All multi-view checks passed",
        "metrics": {
            "min_tree_score": float(min(tree_scores)),
            "avg_ela": float(sum(d["ela"] for d in forensic)/len(forensic)),
            "avg_blur": float(sum(d["blur"] for d in forensic)/len(forensic))
        },
        "artifacts": {
            "phashes": phashes,
            "vector": agg_vec.reshape(-1).tolist()
        },
        "degraded": degraded
    }
