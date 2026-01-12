# application/services/ml_inference.py
import os
import joblib
import pandas as pd
import numpy as np

class MLInference:
    def __init__(self):
        base = os.path.join(os.path.dirname(__file__), "..", "ml_models")
        base = os.path.abspath(base)

        # Модель №1 (RandomForest) — как в app.py
        self.rf_model = joblib.load(os.path.join(base, "random_forest_model.joblib"))
        self.rf_features = joblib.load(os.path.join(base, "model_features.joblib"))

        # Модель №2 (XGBoost) — из train.py (см. ниже примечание про feature columns)
        self.xgb_model = None
        self.xgb_selector = None
        self.xgb_features = None

        xgb_model_path = os.path.join(base, "final_xgb_model.joblib")
        xgb_selector_path = os.path.join(base, "final_feature_selector.joblib")
        xgb_features_path = os.path.join(base, "xgb_feature_columns.joblib")  # нужно добавить

        if os.path.exists(xgb_model_path) and os.path.exists(xgb_selector_path) and os.path.exists(xgb_features_path):
            self.xgb_model = joblib.load(xgb_model_path)
            self.xgb_selector = joblib.load(xgb_selector_path)
            self.xgb_features = joblib.load(xgb_features_path)

    def _make_frame(self, feature_columns, category, rolling_type, size, composition_by_symbol: dict):
        df = pd.DataFrame([{col: 0 for col in feature_columns}]).astype(float)

        # элементы
        for sym, val in (composition_by_symbol or {}).items():
            sym = str(sym).strip().lower()
            if sym in df.columns:
                df.at[0, sym] = float(val)

        # size (если есть)
        if "size" in df.columns and size is not None and str(size).strip() != "":
            df.at[0, "size"] = float(size)

        # one-hot category/rolling (как в твоём app.py)
        if category:
            ccol = f"category_{category}"
            if ccol in df.columns:
                df.at[0, ccol] = 1.0

        if rolling_type:
            rcol = f"rolling_{rolling_type}"
            if rcol in df.columns:
                df.at[0, rcol] = 1.0

        # гарантируем порядок колонок
        df = df.reindex(columns=list(feature_columns), fill_value=0)
        return df

    def predict(self, ml_model_id: int, category: str, rolling_type: str, size, composition_by_symbol: dict) -> float:
        ml_model_id = int(ml_model_id)

        if ml_model_id == 1:
            X = self._make_frame(self.rf_features, category, rolling_type, size, composition_by_symbol)
            pred = self.rf_model.predict(X)[0]
            return float(pred)

        if ml_model_id == 2:
            if self.xgb_model is None or self.xgb_features is None:
                raise ValueError("XGBoost модель не настроена: нет final_xgb_model / xgb_feature_columns")

            X = self._make_frame(self.xgb_features, category, rolling_type, size, composition_by_symbol)
            pred = self.xgb_model.predict(X)[0]
            return float(pred)

        raise ValueError(f"Неизвестная ml_model_id={ml_model_id}")
