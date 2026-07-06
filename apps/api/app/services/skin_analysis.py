"""
Server-side skin analysis validation service.

Privacy guarantee: no image ever reaches this service.
Only the 512-dim MobileNetV2 feature vector and classification labels arrive
from the browser. The service validates the vector's statistical properties
to detect spoofed or corrupt submissions.

Bias mitigation: Fitzpatrick tones IV-VI are flagged when confidence falls
below 0.70, and a Sentry warning is emitted for any result below 0.65 to
support future model retraining on darker skin tones.
"""

import logging
from dataclasses import dataclass, field

import numpy as np

log = logging.getLogger(__name__)

FEATURE_VECTOR_DIM = 512
MIN_CONFIDENCE = 0.40
BIAS_CONFIDENCE_THRESHOLD = 0.70   # flag darker tones below this
SENTRY_LOG_THRESHOLD = 0.65        # log to Sentry below this for any tone
DARKER_TONES = frozenset({"IV", "V", "VI"})

# MobileNetV2 global-avg-pool activations are post-ReLU → non-negative.
# Values above ~15 are implausible for a 512-dim bottleneck layer after normalisation.
VECTOR_MIN_VALID = -1.0
VECTOR_MAX_VALID = 20.0
VECTOR_MIN_STD = 0.001   # near-zero variance = blank / constant input


@dataclass
class ValidationResult:
    is_valid: bool
    skin_type: str
    skin_type_confidence: float
    fitzpatrick_tone: str
    vector_stats: dict
    warnings: list[str] = field(default_factory=list)
    bias_flag: bool = False


class SkinAnalysisService:
    """Validates the browser-extracted feature vector and classification labels."""

    def validate_feature_vector(
        self,
        feature_vector: list[float],
        skin_type: str,
        skin_type_confidence: float,
        fitzpatrick_tone: str,
    ) -> ValidationResult:
        """
        Lightweight server-side cross-validation of the 512-dim feature vector.

        Checks (in order):
        1. Dimension must be exactly 512.
        2. Value range — post-ReLU activations must be in a plausible range.
        3. Variance — near-zero std indicates blank/corrupt input.
        4. Confidence floor — reject analyses below MIN_CONFIDENCE.
        5. Bias check — flag darker Fitzpatrick tones (IV-VI) if < 0.70.
        6. Sentry warning — log any result below 0.65 to support retraining.
        """
        def _fail(reason: str) -> ValidationResult:
            return ValidationResult(
                is_valid=False,
                skin_type=skin_type,
                skin_type_confidence=skin_type_confidence,
                fitzpatrick_tone=fitzpatrick_tone,
                vector_stats={},
                warnings=[reason],
            )

        # 1. Dimension
        if len(feature_vector) != FEATURE_VECTOR_DIM:
            return _fail(
                f"Expected {FEATURE_VECTOR_DIM}-dim feature vector, received {len(feature_vector)}"
            )

        arr = np.array(feature_vector, dtype=np.float32)

        # 2. Range — MobileNetV2 post-ReLU bottleneck should be non-negative and bounded
        if float(arr.min()) < VECTOR_MIN_VALID:
            return _fail(
                f"Feature vector contains unexpected negative values (min={arr.min():.3f})"
            )
        if float(arr.max()) > VECTOR_MAX_VALID:
            return _fail(
                f"Feature vector values exceed expected bounds (max={arr.max():.3f})"
            )

        # 3. Variance — real activations have meaningful spread
        if float(arr.std()) < VECTOR_MIN_STD:
            return _fail(
                "Feature vector has near-zero variance — likely blank or corrupt input"
            )

        # 4. Confidence floor
        if skin_type_confidence < MIN_CONFIDENCE:
            return _fail(
                f"Skin type confidence {skin_type_confidence:.2f} below minimum {MIN_CONFIDENCE}"
            )

        # -----------------------------------------------------------------------
        # Valid from here — compute stats and run bias checks
        # -----------------------------------------------------------------------
        warnings: list[str] = []

        vector_stats = {
            "l2_norm": float(np.linalg.norm(arr)),
            "mean": float(arr.mean()),
            "std": float(arr.std()),
            "sparsity": float((arr == 0.0).mean()),   # fraction of dead ReLU activations
            "min": float(arr.min()),
            "max": float(arr.max()),
        }

        # 5. Bias check for darker Fitzpatrick tones
        bias_flag = False
        if fitzpatrick_tone in DARKER_TONES and skin_type_confidence < BIAS_CONFIDENCE_THRESHOLD:
            bias_flag = True
            msg = (
                f"Low confidence ({skin_type_confidence:.2f}) for Fitzpatrick {fitzpatrick_tone} "
                f"— manual skin type override recommended"
            )
            warnings.append(msg)
            log.warning(
                "Skin tone bias indicator: fitzpatrick=%s confidence=%.2f skin_type=%s",
                fitzpatrick_tone,
                skin_type_confidence,
                skin_type,
            )

        # 6. Sentry warning for any low-confidence result (supports retraining dataset)
        if skin_type_confidence < SENTRY_LOG_THRESHOLD:
            log.warning(
                "Low skin analysis confidence: skin_type=%s confidence=%.2f fitzpatrick=%s "
                "vector_std=%.4f",
                skin_type,
                skin_type_confidence,
                fitzpatrick_tone,
                vector_stats["std"],
            )
            self._sentry_warn(
                f"Low skin analysis confidence {skin_type_confidence:.2f} "
                f"| skin_type={skin_type} | fitzpatrick={fitzpatrick_tone}"
            )

        return ValidationResult(
            is_valid=True,
            skin_type=skin_type,
            skin_type_confidence=skin_type_confidence,
            fitzpatrick_tone=fitzpatrick_tone,
            vector_stats=vector_stats,
            warnings=warnings,
            bias_flag=bias_flag,
        )

    @staticmethod
    def _sentry_warn(message: str) -> None:
        try:
            import sentry_sdk
            sentry_sdk.capture_message(message, level="warning")
        except Exception:
            log.debug("Sentry unavailable — bias warning not reported: %s", message)
