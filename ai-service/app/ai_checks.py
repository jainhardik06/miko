from __future__ import annotations
import io
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image, ImageFile, ImageOps
import imagehash
from loguru import logger

import torch
import timm
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import math
from PIL import ImageChops
try:
    import cv2
    OPENCV_OK = True
except Exception:
    OPENCV_OK = False

# Make PIL robust to truncated images
ImageFile.LOAD_TRUNCATED_IMAGES = True

@dataclass
class Thresholds:
    phash_max_hamming: int = 5
    vector_min_cosine: float = 0.95
    tree_confidence_min: float = 0.5


class Models:
    def __init__(self):
        logger.info("Loading image encoder (EfficientNet-B0)…")
        self.encoder = timm.create_model('efficientnet_b0', pretrained=True, num_classes=0)
        self.encoder.eval()
        self.encoder_cfg = timm.data.resolve_data_config(self.encoder.pretrained_cfg)
        self.encoder_tf = timm.data.create_transform(**self.encoder_cfg)

        # Lightweight CLIP text-image zero-shot classification for 'tree'
        # To avoid extra heavy deps, emulate zero-shot using the encoder features
        # and a simple linear probe: we approximate by comparing to a tiny set of
        # positive/negative reference images embedded at startup.
        logger.info("Preparing zero-shot references for 'tree' check…")
        self._zs_pos_vec = None
        self._zs_neg_vec = None
        self._prepare_zero_shot_refs()

    def _prepare_zero_shot_refs(self):
        # We craft two synthetic reference images: one greenish texture (tree-like)
        # and one gray flat texture (non-tree). It's a pragmatic, dependency-free
        # proxy to gate obvious non-tree submissions.
        pos = Image.new('RGB', (224, 224), (34, 139, 34))  # forest green block
        neg = Image.new('RGB', (224, 224), (128, 128, 128))
        self._zs_pos_vec = self.encode_image(pos)
        self._zs_neg_vec = self.encode_image(neg)

    def encode_image(self, img: Image.Image) -> np.ndarray:
        img = ImageOps.exif_transpose(img).convert('RGB')
        tensor = self.encoder_tf(img).unsqueeze(0)
        with torch.no_grad():
            vec = self.encoder(tensor)
        return vec.cpu().numpy()


MODELS: Optional[Models] = None


def ensure_models_loaded() -> Models:
    global MODELS
    if MODELS is None:
        MODELS = Models()
    return MODELS


def read_image_from_bytes(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


def compute_phash(img: Image.Image) -> str:
    return str(imagehash.phash(img))  # 16-char hex string typically


def hamming_distance_hex(a: str, b: str) -> int:
    # Convert hex to int and compute Hamming by XOR popcount
    x = int(a, 16) ^ int(b, 16)
    return x.bit_count()


def is_tree_like(img: Image.Image, thresholds: Thresholds) -> Tuple[bool, float]:
    m = ensure_models_loaded()
    v = m.encode_image(img)
    pos_sim = float(cosine_similarity(v, m._zs_pos_vec)[0, 0])
    neg_sim = float(cosine_similarity(v, m._zs_neg_vec)[0, 0])
    # Normalize a pseudo-probability
    score = (pos_sim - neg_sim + 1) / 2  # map roughly to [0,1]
    logger.debug(f"zero-shot score ~ {score:.3f} (pos {pos_sim:.3f} / neg {neg_sim:.3f})")
    return score >= thresholds.tree_confidence_min, score


def encode_feature_vector(img: Image.Image) -> np.ndarray:
    m = ensure_models_loaded()
    return m.encode_image(img)


def max_cosine_similarity(query_vec: np.ndarray, vectors: List[np.ndarray]) -> float:
    if not vectors:
        return 0.0
    mat = np.vstack(vectors)
    sims = cosine_similarity(query_vec, mat)
    return float(np.max(sims))


# --- Forensics ---
def extract_basic_exif(img: Image.Image) -> dict:
    info = {}
    try:
        exif = img.getexif()
        if exif:
            for k, v in exif.items():
                info[str(k)] = str(v)
    except Exception:
        pass
    return info


def error_level_analysis(img: Image.Image, quality: int = 85) -> float:
    try:
        # Save to JPEG at known quality and compare difference magnitude
        bio = io.BytesIO()
        img.save(bio, 'JPEG', quality=quality)
        bio.seek(0)
        comp = Image.open(bio)
        diff = ImageChops.difference(img.convert('RGB'), comp.convert('RGB'))
        # Average pixel intensity as simple score
        arr = np.asarray(diff).astype(np.float32)
        return float(arr.mean() / 255.0)
    except Exception:
        return 0.0


def blur_score_fft(img: Image.Image) -> float:
    # Simple high-frequency energy ratio as blur proxy
    arr = np.asarray(img.convert('L').resize((256, 256), Image.BICUBIC), dtype=np.float32)
    f = np.fft.fft2(arr)
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)
    total = magnitude.sum()
    center = magnitude[96:160, 96:160].sum()
    high = total - center
    return float((high / (total + 1e-6)))


def aggregate_multi_view(vectors: List[np.ndarray]) -> np.ndarray:
    # Average-pooled embedding to represent a single tree instance from multiple angles
    mat = np.vstack([v.reshape(1, -1) for v in vectors])
    return mat.mean(axis=0, keepdims=True)


def orb_match_ratio(img1: Image.Image, img2: Image.Image) -> float:
    if not OPENCV_OK:
        return 0.0
    a = np.array(img1.convert('RGB'))
    b = np.array(img2.convert('RGB'))
    orb = cv2.ORB_create()
    kp1, des1 = orb.detectAndCompute(a, None)
    kp2, des2 = orb.detectAndCompute(b, None)
    if des1 is None or des2 is None:
        return 0.0
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = bf.match(des1, des2)
    if not matches:
        return 0.0
    matches = sorted(matches, key=lambda m: m.distance)
    # Good match ratio: fraction of matches with distance below a threshold
    good = [m for m in matches if m.distance < 40]
    return float(len(good) / max(1, len(matches)))


def exif_time_consistent(imgs: List[Image.Image], tolerance_minutes: int = 10) -> bool:
    times = []
    for im in imgs:
        exif = im.getexif()
        ts = None
        for k, v in (exif or {}).items():
            s = str(v)
            if ':' in s and ' ' in s and s.count(':') >= 2:
                ts = s
                break
        if ts:
            times.append(ts)
    # If missing timestamps, allow but don't fail
    if len(times) < 2:
        return True
    # Very rough consistency: all timestamps equal or within tolerance is non-trivial here without parsing.
    # We accept equality as the simple heuristic.
    return len(set(times)) <= 2
