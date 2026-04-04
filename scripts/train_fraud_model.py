#!/usr/bin/env python3
# pyright: reportMissingImports=false
"""Train a synthetic Isolation Forest model for SPEC-02 fraud scoring.

Outputs:
- models/fraud_model.pkl
- models/fraud_model_meta.json
"""

from __future__ import annotations

import json
import pathlib
import time
from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import f1_score
from sklearn.model_selection import train_test_split

try:
    import shap  # type: ignore
except Exception:  # pragma: no cover
    shap = None

try:
    import joblib  # type: ignore
except Exception as exc:  # pragma: no cover
    raise SystemExit("joblib is required to persist model artifacts") from exc

FEATURES = [
    "mock_location_flag",
    "accelerometer_variance",
    "barometric_delta_match",
    "gnss_cn0_agc_anomaly",
    "gnss_ntp_time_delta",
    "bssid_zone_match",
    "cell_tower_zone_match",
    "battery_drain_z_score",
    "speed_variance_30min",
    "route_vector_linearity",
    "recent_app_activity_in_zone",
    "claim_burst_rank",
    "device_proximity_graph_degree",
    "shared_network_flag",
]


@dataclass
class Dataset:
    X: np.ndarray
    y: np.ndarray


def generate_dataset() -> Dataset:
    rng = np.random.default_rng(42)

    # Genuine samples
    genuine = np.column_stack(
        [
            np.zeros(500),
            rng.uniform(0.25, 0.65, 500),
            np.ones(500),
            np.zeros(500),
            rng.uniform(0.0, 2.0, 500),
            np.ones(500),
            np.ones(500),
            rng.uniform(0.0, 0.8, 500),
            rng.uniform(0.08, 0.5, 500),
            rng.uniform(0.05, 0.3, 500),
            np.ones(500),
            rng.uniform(0.1, 1.0, 500),
            rng.integers(0, 2, 500),
            np.zeros(500),
        ]
    )

    # GPS spoofers
    spoof = np.column_stack(
        [
            np.ones(300),
            rng.uniform(0.0, 0.08, 300),
            rng.integers(0, 2, 300),
            np.ones(300),
            rng.uniform(5.0, 15.0, 300),
            rng.integers(0, 2, 300),
            rng.integers(0, 2, 300),
            rng.uniform(0.5, 2.0, 300),
            rng.uniform(0.0, 0.05, 300),
            rng.uniform(0.75, 1.0, 300),
            rng.integers(0, 2, 300),
            rng.uniform(0.0, 0.08, 300),
            rng.integers(0, 2, 300),
            rng.integers(0, 2, 300),
        ]
    )

    # Ring fraud
    ring = np.column_stack(
        [
            rng.integers(0, 2, 200),
            rng.uniform(0.05, 0.2, 200),
            rng.integers(0, 2, 200),
            rng.integers(0, 2, 200),
            rng.uniform(2.0, 8.0, 200),
            rng.integers(0, 2, 200),
            rng.integers(0, 2, 200),
            rng.uniform(0.4, 1.7, 200),
            rng.uniform(0.0, 0.12, 200),
            rng.uniform(0.6, 1.0, 200),
            rng.integers(0, 2, 200),
            rng.uniform(0.0, 0.05, 200),
            rng.integers(3, 8, 200),
            np.ones(200),
        ]
    )

    X = np.vstack([genuine, spoof, ring])
    y = np.concatenate([np.zeros(500), np.ones(300), np.ones(200)])
    return Dataset(X=X, y=y)


def main() -> None:
    dataset = generate_dataset()
    X_train, X_test, y_train, y_test = train_test_split(
        dataset.X, dataset.y, test_size=0.2, random_state=42, stratify=dataset.y
    )

    model = IsolationForest(n_estimators=100, contamination=0.2, random_state=42)
    model.fit(X_train)

    preds = model.predict(X_test)
    y_pred = np.where(preds == -1, 1, 0)
    f1 = f1_score(y_test, y_pred)

    start = time.perf_counter()
    for _ in range(100):
        model.decision_function(X_test[:1])
    elapsed = (time.perf_counter() - start) / 100
    p95_ms = elapsed * 1000

    models_dir = pathlib.Path("models")
    models_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / "fraud_model.pkl"
    joblib.dump(model, model_path)

    meta = {
        "version": "iforest-synthetic-v1",
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "f1": round(float(f1), 4),
        "inference_p95_ms": round(float(p95_ms), 4),
        "feature_names": FEATURES,
    }

    if shap is not None:
        try:
            explainer = shap.TreeExplainer(model)
            sample_shap = explainer.shap_values(X_test[:1])
            meta["shap_example"] = [float(v) for v in np.ravel(sample_shap).tolist()]
        except Exception:
            meta["shap_example"] = []

    with (models_dir / "fraud_model_meta.json").open("w", encoding="utf-8") as file:
        json.dump(meta, file, indent=2)

    print("Model saved:", model_path)
    print("Validation F1:", round(float(f1), 4))
    print("Inference p95 (ms):", round(float(p95_ms), 4))


if __name__ == "__main__":
    main()
