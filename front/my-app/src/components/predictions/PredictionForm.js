import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, predictionService, elementService, modelService } from '../../services/api';
import useAuth from '../../context/AuthContext';
import LoadingSpinner from '../common/LoadingSpinner';
import ElementSelector from '../elements/ElementSelector';

const EPS = 0.001;

const round3 = (n) => Math.round(Number(n) * 1000) / 1000;

const uniqSorted = (arr) =>
  Array.from(new Set(arr))
    .map(x => String(x).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const PredictionForm = ({ isEdit = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    category: '',
    rolling_type: '',
    ml_model_id: '1',
    person_id: '',
    elements: [],
  });

  const [size, setSize] = useState('');
  const [originalElements, setOriginalElements] = useState([]);
  const [models, setModels] = useState([]);
  const [allElementsMap, setAllElementsMap] = useState({});
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [rollingOptions, setRollingOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState('');
  const [predictedValue, setPredictedValue] = useState(null);

  useEffect(() => {
    if (user?.id) {
      setFormData(prev => ({
        ...prev,
        person_id: String(user.id)
      }));
    }
  }, [user]);

  const totalPercentage = useMemo(() => {
    const sum = formData.elements
      .reduce((acc, el) => acc + parseFloat(el?.percentage || 0), 0);
    return round3(sum);
  }, [formData.elements]);

  const normalizeElements = useCallback((elements) =>
    elements
      .filter(el => el.element_id != null)
      .map(el => ({
        element_id: parseInt(el.element_id, 10),
        percentage: round3(Number(String(el.percentage).replace(',', '.'))),
      }))
      .filter(el =>
        Number.isFinite(el.element_id) &&
        Number.isFinite(el.percentage) &&
        el.percentage >= 0 &&
        el.percentage <= 99.999
      ), []);

  const loadAllElements = useCallback(async () => {
    try {
      const response = await elementService.getAll();
      const elements = response.data;
      const map = {};
      elements.forEach(el => {
        map[el.id] = el;
      });
      setAllElementsMap(map);
    } catch (err) {
      console.error('Error loading all elements', err);
    }
  }, []);

  const loadCategoryRollingFromJson = useCallback(async () => {
    try {
      const res = await fetch('/data.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load data.json: ${res.status}`);

      const data = await res.json();

      const categories = uniqSorted(data.map(x => x?.category).filter(Boolean));
      const rollings = uniqSorted(data.map(x => x?.rolling).filter(Boolean));

      setCategoryOptions(categories);
      setRollingOptions(rollings);

      setFormData(prev => ({
        ...prev,
        category: prev.category || categories[0] || '',
        rolling_type: prev.rolling_type || rollings[0] || ''
      }));
    } catch (e) {
      console.error('data.json error', e);
      setCategoryOptions([]);
      setRollingOptions([]);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const response = await modelService.getAll();
      const raw = response.data;
      const filtered = raw.filter(m => m?.id === 1 || m?.id === 2);
      const fallback = [
        { id: 1, name: 'Random Forest', description: '' },
        { id: 2, name: 'XGBoost', description: '' }
      ];
      setModels(filtered.length ? filtered : fallback);
    } catch (err) {
      console.error('Error fetching models', err);
      setModels([
        { id: 1, name: 'Random Forest', description: '' },
        { id: 2, name: 'XGBoost', description: '' }
      ]);
    }
  }, []);

  const fetchPredictionData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setApiError('');
    try {
      const [predictionRes, elementsRes] = await Promise.all([
        predictionService.getById(id),
        predictionService.getElements(id),
      ]);
      const prediction = predictionRes.data;
      const elements = elementsRes.data
        .map(el => ({
          element_id: el.element_id,
          percentage: el.percentage == null || el.percentage === undefined
            ? String(el.percentage)
            : el.percentage,
        }));

      setFormData(prev => ({
        ...prev,
        category: prediction?.category || prev.category,
        rolling_type: prediction?.rolling_type || prev.rolling_type,
        ml_model_id: prediction?.ml_model_id != null
          ? String(prediction.ml_model_id)
          : prev.ml_model_id,
        person_id: prediction?.person_id || (user?.id ? String(user.id) : prev.person_id),
        elements,
      }));
      setOriginalElements(elements);
      setPredictedValue(prediction?.prop_value ?? null);
    } catch (err) {
      console.error('Error fetching prediction data', err);
      const msg = err.response?.data?.detail || err.message;
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!String(formData.category).trim()) newErrors.category = 'Выберите категорию';
    if (!String(formData.rolling_type).trim()) newErrors.rolling_type = 'Выберите тип прокатки';
    if (!formData.ml_model_id) newErrors.ml_model_id = 'Выберите модель ML';

    if (!formData.person_id) {
      newErrors.person_id = 'Не удалось определить пользователя. Пожалуйста, войдите в систему.';
    }

    if (Math.abs(totalPercentage - 100) > EPS) {
      newErrors.elements = `Сумма процентов должна быть 100.000 (сейчас: ${totalPercentage.toFixed(3)})`;
    } else if (normalizeElements(formData.elements).length === 0) {
      newErrors.elements = 'Добавьте хотя бы один элемент';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, normalizeElements, totalPercentage]);

  const buildMlPayload = useCallback(() => {
    const elements = normalizeElements(formData.elements);
    const sizeValue = String(size).trim();
    return {
      ml_model_id: parseInt(formData.ml_model_id, 10),
      category: String(formData.category).trim(),
      rolling_type: String(formData.rolling_type).trim(),
      size: sizeValue ? parseFloat(sizeValue.replace(',', '.')) : null,
      elements,
    };
  }, [formData, normalizeElements, size]);

  const requestPrediction = useCallback(async () => {
    setPredictError('');
    const elements = normalizeElements(formData.elements);
    const canPredict =
      String(formData.category).trim() &&
      String(formData.rolling_type).trim() &&
      formData.ml_model_id &&
      elements.length > 0 &&
      Math.abs(totalPercentage - 100) < EPS;
    if (!canPredict) {
      setPredictedValue(null);
      return null;
    }
    try {
      setPredicting(true);
      const payload = buildMlPayload();
      const res = await api.post('api/ml/predict', payload);
      const val = res?.data?.prop_value;
      if (val == null || Number.isNaN(Number(val))) {
        throw new Error('Неверный ответ от сервера: отсутствует prop_value');
      }
      const roundedValue = round3(Number(val));
      setPredictedValue(roundedValue);
      return roundedValue;
    } catch (e) {
      console.error(e);
      setPredictedValue(null);
      setPredictError(e.response?.data?.detail || e.message);
      return null;
    } finally {
      setPredicting(false);
    }
  }, [buildMlPayload, formData, normalizeElements, totalPercentage]);

  useEffect(() => {
    const t = setTimeout(requestPrediction, 400);
    return () => clearTimeout(t);
  }, [requestPrediction]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleElementsChange = (selectedElements) => {
    setFormData(prev => ({ ...prev, elements: selectedElements }));
    if (errors.elements) {
      setErrors(prev => ({ ...prev, elements: '' }));
    }
  };

  const getCreatedPredictionId = async (personId) => {
    await new Promise(r => setTimeout(r, 500));
    const userPredictionsRes = await predictionService.getByPerson(personId);
    const userPredictions = userPredictionsRes.data;
    if (!userPredictions.length) throw new Error('Прогноз не найден');
    return userPredictions.reduce((prev, cur) =>
      prev.id > cur.id ? prev : cur
    ).id;
  };

  const syncPredictionElements = async (predictionId, newElements) => {
    const old = normalizeElements(originalElements);
    for (const el of old) {
      try {
        await predictionService.removeElement(predictionId, el.element_id);
      } catch (e) {
        console.warn(`Не удалось удалить элемент: prediction=${predictionId}, element=${el.element_id}`, e);
      }
    }
    for (const el of newElements) {
      await predictionService.addElement(predictionId, el.element_id, el.percentage);
    }
    setOriginalElements(newElements);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    setPredictError('');

    if (!validateForm()) {
      return;
    }

    let finalPredictedValue = predictedValue;
    if (finalPredictedValue == null) {
      finalPredictedValue = await requestPrediction();
    }

    if (finalPredictedValue == null) {
      setApiError('Невозможно получить предсказание от ML модели. Проверьте правильность введенных данных.');
      return;
    }

    setSubmitting(true);
    try {
      if (!formData.person_id) {
        throw new Error('Не удалось определить ID пользователя');
      }

      const predictionData = {
        prop_value: round3(Number(finalPredictedValue)),
        category: String(formData.category).trim(),
        rolling_type: String(formData.rolling_type).trim(),
        ml_model_id: parseInt(formData.ml_model_id, 10),
        person_id: parseInt(formData.person_id, 10),
      };

      const elements = normalizeElements(formData.elements);

      if (isEdit && id) {
        await predictionService.update(id, predictionData);
        await syncPredictionElements(id, elements);
        alert('✓ Прогноз обновлен');
        navigate('/predictions');
        return;
      }

      const createResponse = await predictionService.create(predictionData);

      let predictionId;

      if (createResponse.data && createResponse.data.id) {
        predictionId = createResponse.data.id;
      } else {
        predictionId = await getCreatedPredictionId(predictionData.person_id);
      }

      for (const el of elements) {
        await predictionService.addElement(predictionId, el.element_id, el.percentage);
      }

      alert('✓ Прогноз сохранен');
      navigate('/predictions');
    } catch (err) {
      console.error('Save error', err);
      setApiError(err.response?.data?.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadAllElements();
    fetchModels();
    loadCategoryRollingFromJson();
    if (isEdit && id) fetchPredictionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  const enrichedElements = useMemo(() => {
    return formData.elements.map(el => {
      const info = allElementsMap[el.element_id];
      return {
        ...el,
        symbol: info?.symbol || '?',
        name: info?.name || '',
        atomic_number: info?.atomic_number,
      };
    });
  }, [formData.elements, allElementsMap]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="prediction-form-container">
      {apiError ? (
        <div className="alert alert-danger" style={{ marginBottom: 12 }}>
          {apiError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="prediction-form">
        <div className="form-group">
          <label htmlFor="ml_model_id">ML модель</label>
          <select
            id="ml_model_id"
            name="ml_model_id"
            value={formData.ml_model_id}
            onChange={handleInputChange}
            className={errors.ml_model_id ? 'input-error' : ''}
          >
            <option value="">Выберите модель</option>
            {models.map(m => (
              <option key={m.id} value={String(m.id)}>
                {m.name}
              </option>
            ))}
          </select>
          {errors.ml_model_id ? (
            <div className="error-text">{errors.ml_model_id}</div>
          ) : null}
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            1 = Random Forest, 2 = XGBoost
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="category">Категория</label>
          {categoryOptions.length ? (
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={errors.category ? 'input-error' : ''}
            >
              <option value="">Выберите категорию</option>
              {categoryOptions.map(c =>
                <option key={c} value={c}>{c}</option>
              )}
            </select>
          ) : (
            <input
              id="category"
              name="category"
              type="text"
              value={formData.category}
              onChange={handleInputChange}
              placeholder="Категория"
              className={errors.category ? 'input-error' : ''}
            />
          )}
          {errors.category && <div className="error-text">{errors.category}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="rolling_type">Тип прокатки</label>
          {rollingOptions.length ? (
            <select
              id="rolling_type"
              name="rolling_type"
              value={formData.rolling_type}
              onChange={handleInputChange}
              className={errors.rolling_type ? 'input-error' : ''}
            >
              <option value="">Выберите тип прокатки</option>
              {rollingOptions.map(r =>
                <option key={r} value={r}>{r}</option>
              )}
            </select>
          ) : (
            <input
              id="rolling_type"
              name="rolling_type"
              type="text"
              value={formData.rolling_type}
              onChange={handleInputChange}
              placeholder="Тип прокатки"
              className={errors.rolling_type ? 'input-error' : ''}
            />
          )}
          {errors.rolling_type && <div className="error-text">{errors.rolling_type}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="size">Размер (size)</label>
          <input
            id="size"
            type="text"
            value={size}
            onChange={e => setSize(e.target.value)}
            placeholder="10.0"
            inputMode="decimal"
          />
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Числовое значение, опционально
          </div>
        </div>

        <div className="form-group">
          <label>Элементы</label>
          <ElementSelector
            selectedElements={formData.elements}
            onChange={handleElementsChange}
            maxTotalPercentage={100}
            requireExactTotal={true}
            disabled={submitting}
          />
          {errors.elements ? (
            <div className="error-text">{errors.elements}</div>
          ) : null}
        </div>

        <div style={{ marginTop: 8 }}>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Сумма процентов: {totalPercentage.toFixed(3)}
          </div>
        </div>

        {enrichedElements.length ? (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {enrichedElements.map((el, idx) => (
              <div key={`${el.element_id}-${idx}`}>
                {el.symbol} {round3(el.percentage).toFixed(3)}%
              </div>
            ))}
          </div>
        ) : null}

        <div className="form-group">
          <label>Прогноз</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ minWidth: 160 }}>
              {predicting ? (
                'Вычисление...'
              ) : predictedValue != null ? (
                round3(predictedValue).toFixed(3)
              ) : (
                ''
              )}
            </div>
            <button
              id="predict-button"
              type="button"
              className="btn btn-secondary"
              onClick={requestPrediction}
              disabled={predicting}
            >
              Предсказать
            </button>
          </div>
          {predictError ? (
            <div className="error-text" style={{ marginTop: 6 }}>
              {predictError}
            </div>
          ) : null}
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: 10 }}>
          <button
            id="submit-button"
            className="btn btn-primary"
            type="submit"
            disabled={submitting || !formData.person_id}
          >
            {submitting ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            id="cancel-button"
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate('/predictions')}
            disabled={submitting}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default PredictionForm;