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
import open_clip
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
    tree_confidence_min: float = 0.7  # stricter by default
    min_blur_score: float = 0.08      # require some high-frequency content
    min_veg_ratio: float = 0.12       # fraction of pixels with green vegetation signal
    min_clip_margin: float = 0.20     # require positive vs negative prompt margin


class Models:
    def __init__(self):
        logger.info("Loading image encoder (EfficientNet-B0)…")
        self.encoder = timm.create_model('efficientnet_b0', pretrained=True, num_classes=0)
        self.encoder.eval()
        self.encoder_cfg = timm.data.resolve_data_config(self.encoder.pretrained_cfg)
        self.encoder_tf = timm.data.create_transform(**self.encoder_cfg)

        # CLIP zero-shot classification for 'tree' vs negatives
        logger.info("Loading OpenCLIP (ViT-B-32) for zero-shot checks…")
        self.clip_model, self.clip_preprocess, _ = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')
        self.clip_model.eval()
        self.clip_tokenizer = open_clip.get_tokenizer('ViT-B-32')
        # Pre-tokenize prompts
        self.clip_positive = self.clip_tokenizer([
            "a photo of a tree",
            "an image of a tree in nature",
            "a single tree outdoors",
            "a forest tree"
        ])
        self.clip_negative = self.clip_tokenizer([
            "a human face",
            "a selfie",
            "an indoor room",
            "a wall",
            "a person portrait"
        ])
        logger.info("OpenCLIP ready.")

    def encode_image(self, img: Image.Image) -> np.ndarray:
        img = ImageOps.exif_transpose(img).convert('RGB')
        tensor = self.encoder_tf(img).unsqueeze(0)
        with torch.no_grad():
            vec = self.encoder(tensor)
        return vec.cpu().numpy()

    def clip_tree_prob(self, img: Image.Image) -> float:
        # Return a score ~[0,1] for tree likelihood vs negatives
        with torch.no_grad():
            image = self.clip_preprocess(ImageOps.exif_transpose(img).convert('RGB')).unsqueeze(0)
            pos = self.clip_positive
            neg = self.clip_negative
            # Compute logits against concatenated prompts
            texts = torch.cat([pos, neg], dim=0)
            image_features = self.clip_model.encode_image(image)
            text_features = self.clip_model.encode_text(texts)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            logits = (image_features @ text_features.t()).squeeze(0)
            # Softmax over prompts
            probs = logits.softmax(dim=0)
            pos_prob = float(probs[: len(pos)].sum().cpu())
            return pos_prob

    def clip_tree_stats(self, img: Image.Image) -> tuple[float, float]:
        with torch.no_grad():
            image = self.clip_preprocess(ImageOps.exif_transpose(img).convert('RGB')).unsqueeze(0)
            pos = self.clip_positive
            neg = self.clip_negative
            texts = torch.cat([pos, neg], dim=0)
            image_features = self.clip_model.encode_image(image)
            text_features = self.clip_model.encode_text(texts)
            image_features /= image_features.norm(dim=-1, keepdim=True)
            text_features /= text_features.norm(dim=-1, keepdim=True)
            logits = (image_features @ text_features.t()).squeeze(0)
            probs = logits.softmax(dim=0)
            pos_prob = float(probs[: len(pos)].sum().cpu())
            neg_prob = float(probs[len(pos):].sum().cpu())
            return pos_prob, neg_prob

    def vegetation_ratio(self, img: Image.Image) -> float:
        # Simple vegetation signal: ExG (excess green) > 0 on normalized channels
        arr = np.asarray(ImageOps.exif_transpose(img).convert('RGB'), dtype=np.float32) / 255.0
        r = arr[..., 0]
        g = arr[..., 1]
        b = arr[..., 2]
        exg = 2*g - r - b
        mask = exg > 0.05
        return float(mask.mean())

    def face_area_fraction(self, img: Image.Image) -> float:
        if not OPENCV_OK:
            return 0.0
        try:
            gray = np.array(ImageOps.exif_transpose(img).convert('L'))
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            if len(faces) == 0:
                return 0.0
            H, W = gray.shape[:2]
            total = H * W
            area = 0
            for (x, y, fw, fh) in faces:
                area = max(area, fw * fh)
            return float(area / max(1, total))
        except Exception:
            return 0.0

    def skin_ratio(self, img: Image.Image) -> float:
        # Very coarse skin detection in YCrCb; helps detect selfies
        bgr = np.array(ImageOps.exif_transpose(img).convert('RGB'))[..., ::-1]
        ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb) if OPENCV_OK else None
        if ycrcb is None:
            return 0.0
        Y, Cr, Cb = ycrcb[..., 0], ycrcb[..., 1], ycrcb[..., 2]
        mask = (Cr > 135) & (Cr < 180) & (Cb > 85) & (Cb < 135)
        return float(mask.mean())


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


def is_tree_like(img: Image.Image, thresholds: Thresholds) -> Tuple[bool, float, dict]:
    m = ensure_models_loaded()
    # Quick pre-checks: very small images or extremely low high-frequency energy (likely blank)
    w, h = img.size
    if w < 160 or h < 160:
        logger.debug("reject: image too small for reliable detection")
        return False, 0.0, {"reason": "too_small", "w": w, "h": h}
    blur = blur_score_fft(img)
    if blur < thresholds.min_blur_score:
        logger.debug("reject: image extremely blurry")
        return False, 0.0, {"reason": "blur_low", "blur": blur}

    # Face/saliency rejection (basic): if face detected prominently, likely not a tree submission
    try:
        if OPENCV_OK:
            face_frac = m.face_area_fraction(img)
            if face_frac > 0.04:
                logger.debug("reject: large face detected")
                return False, 0.0, {"reason": "face_detected", "face_area_frac": face_frac}
    except Exception:
        pass

    # OpenCLIP tree probability and margin vs negatives
    try:
        pos_prob, neg_prob = m.clip_tree_stats(img)
        tree_prob = pos_prob
        margin = pos_prob - neg_prob
    except Exception:
        tree_prob = 0.0
        margin = -1.0
    logger.debug(f"clip tree prob ~ {tree_prob:.3f} | margin ~ {margin:.3f}")

    # Vegetation ratio
    veg = m.vegetation_ratio(img)
    logger.debug(f"vegetation ratio ~ {veg:.3f}")

    # EfficientNet feature heuristic (kept as a secondary signal)
    # Combine signals: weighted score
    score = float(0.7 * tree_prob + 0.2 * min(1.0, veg * 2.0) + 0.1 * max(0.0, margin))

    # Additional selfie guard
    skin = m.skin_ratio(img)
    face_frac = m.face_area_fraction(img) if OPENCV_OK else 0.0

    ok = (
        (tree_prob >= thresholds.tree_confidence_min) and
        (veg >= thresholds.min_veg_ratio) and
        (margin >= thresholds.min_clip_margin) and
        (skin < 0.15) and
        (face_frac < 0.04)
    )
    info = {
        "clip_tree_prob": tree_prob,
        "clip_margin": margin,
        "vegetation_ratio": veg,
        "blur": blur,
        "skin_ratio": skin,
        "face_area_frac": face_frac,
        "w": w,
        "h": h
    }
    if not ok:
        reasons = []
        if tree_prob < thresholds.tree_confidence_min:
            reasons.append("low_tree_prob")
        if veg < thresholds.min_veg_ratio:
            reasons.append("low_vegetation")
        if margin < thresholds.min_clip_margin:
            reasons.append("low_clip_margin")
        if skin >= 0.15:
            reasons.append("skin_detected")
        if face_frac >= 0.04:
            reasons.append("face_detected")
        info["reasons"] = reasons

    return ok, score, info


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
