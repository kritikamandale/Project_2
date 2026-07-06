"""
Server-side skin type classifier — scikit-learn GradientBoostingClassifier.
Trained offline; model artifact loaded from disk at startup.
"""

import pickle
from pathlib import Path

import numpy as np

MODEL_PATH = Path(__file__).parent / "artifacts" / "skin_classifier.pkl"

SKIN_TYPES = ["dry", "oily", "combination", "normal", "sensitive"]
CONDITIONS = [
    "acne",
    "pigmentation",
    "dark_circles",
    "uneven_tone",
    "wrinkles",
    "dehydration",
    "redness",
    "enlarged_pores",
]


class SkinClassifier:
    """Wraps the sklearn model. Loaded once at process startup."""

    _model = None

    @classmethod
    def load(cls) -> "SkinClassifier":
        """Load model from disk. Call once during app startup."""
        instance = cls()
        if MODEL_PATH.exists():
            with open(MODEL_PATH, "rb") as f:
                # MODEL_PATH is a fixed path baked into the deployment (this
                # repo's own trained artifact), never derived from request
                # input — not a deserialization vector for untrusted data.
                instance._model = pickle.load(f)  # nosec B301 # noqa: S301
        else:
            # Dev mode — use dummy pass-through
            instance._model = None
        return instance

    def predict_skin_type(self, features: np.ndarray) -> tuple[str, dict[str, float]]:
        """Returns (predicted_class, confidence_per_class)."""
        if self._model is None:
            return "normal", {t: 0.2 for t in SKIN_TYPES}

        proba = self._model.predict_proba([features])[0]
        classes = self._model.classes_
        confidences = dict(zip(classes, proba.tolist(), strict=True))
        predicted = max(confidences, key=confidences.get)
        return predicted, confidences

    def predict_conditions(self, features: np.ndarray) -> list[str]:
        """Multi-label condition detection. TODO: train separate binary classifier per condition."""
        return []
