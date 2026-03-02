"""
vision_counter.py — Specialized computer vision counting for Foreperson.

Two strategies:
  1. YOLO (YOLOv8n): for real photographs — counts people, vehicles, equipment, etc.
  2. OpenCV contours: for architectural drawings — counts closed regions (rooms, building footprints).

Use count_objects_in_image(image_b64) as the main entry point.
"""

import base64
import logging
import threading
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

_yolo_lock = threading.Lock()
_yolo_model = None
_YOLO_FAILED = object()  # sentinel — distinct from None


def _get_yolo():
    global _yolo_model
    if _yolo_model is None:
        with _yolo_lock:
            if _yolo_model is None:  # double-checked locking
                try:
                    from ultralytics import YOLO
                    _yolo_model = YOLO("yolov8n.pt")
                    logger.info("VisionCounter: YOLOv8n loaded")
                except Exception as e:
                    logger.warning("VisionCounter: YOLO unavailable (%s)", e)
                    _yolo_model = _YOLO_FAILED  # Issue 3 fix: stop retrying
    if _yolo_model is _YOLO_FAILED:
        return None
    return _yolo_model


@dataclass
class VisionCount:
    count: int
    method: str        # "yolo", "contour", or "none"
    confidence: float  # 0.0 – 1.0
    label: str         # human-readable e.g. "12 objects detected by YOLO"


def _is_drawing(image) -> bool:
    """Return True if the image looks like a technical drawing (low colour saturation)."""
    import cv2
    import numpy as np
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mean_saturation = float(np.mean(hsv[:, :, 1]))
    return mean_saturation < 30


def count_with_yolo(image, target_class: Optional[str] = None) -> VisionCount:
    """Run YOLOv8 detection. Count all objects, or only those matching target_class."""
    import numpy as np
    model = _get_yolo()
    if model is None:
        return VisionCount(count=0, method="none", confidence=0.0, label="YOLO unavailable")

    try:
        results = model(image, verbose=False)
        detections = results[0].boxes

        if target_class:
            names = results[0].names
            target_ids = {k for k, v in names.items() if target_class.lower() in v.lower()}
            boxes = [b for b in detections if int(b.cls) in target_ids]
        else:
            boxes = list(detections)

        count = len(boxes)
        avg_conf = float(np.mean([float(b.conf) for b in boxes])) if boxes else 0.0
        label = f"{count} '{target_class}' detected by YOLO" if target_class else f"{count} object(s) detected by YOLO"
        logger.info("VisionCounter YOLO: %s", label)
        return VisionCount(count=count, method="yolo", confidence=avg_conf, label=label)
    except Exception as e:
        logger.warning("VisionCounter: YOLO inference failed: %s", e)
        return VisionCount(count=0, method="none", confidence=0.0, label=f"YOLO error: {e}")


def count_with_contours(image) -> VisionCount:
    """Count distinct closed regions in a drawing using OpenCV contour detection."""
    import cv2
    import numpy as np
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2,
        )
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        h, w = image.shape[:2]
        min_area = h * w * 0.005  # at least 0.5% of image
        max_area = h * w * 0.9   # less than 90% (skip page border)
        significant = [c for c in contours if min_area < cv2.contourArea(c) < max_area]

        count = len(significant)
        confidence = max(0.4, 1.0 - count * 0.01)
        label = f"{count} closed region(s) detected by contour analysis"
        logger.info("VisionCounter contours: %s", label)
        return VisionCount(count=count, method="contour", confidence=confidence, label=label)
    except Exception as e:
        logger.warning("VisionCounter: contour detection failed: %s", e)
        return VisionCount(count=0, method="none", confidence=0.0, label=f"Contour error: {e}")


def count_objects_in_image(image_b64: str, target_class: Optional[str] = None) -> VisionCount:
    """
    Main entry point. Decodes base64 image, picks strategy, returns VisionCount.

    - Technical drawings (low colour saturation) → OpenCV contours
    - Photographs → YOLO
    """
    import cv2
    import numpy as np
    try:
        img_bytes = base64.b64decode(image_b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            return VisionCount(count=0, method="none", confidence=0.0, label="Could not decode image")
    except Exception as e:
        return VisionCount(count=0, method="none", confidence=0.0, label=f"Image decode error: {e}")

    if _is_drawing(image):
        logger.info("VisionCounter: drawing detected → contour method")
        return count_with_contours(image)
    else:
        logger.info("VisionCounter: photograph detected → YOLO")
        return count_with_yolo(image, target_class=target_class)


def format_count_for_ai(result: VisionCount) -> str:
    """Format a VisionCount as a string to prepend to the AI prompt."""
    if result.method == "none" or result.count == 0:
        return ""
    return (
        f"[COMPUTER VISION RESULT — treat this as ground truth, do not override it]\n"
        f"Count: {result.count} ({result.label})\n"
        f"Confidence: {result.confidence:.0%}\n\n"
    )
