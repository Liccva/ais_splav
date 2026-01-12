// AlloyForm.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { alloyService, patentService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import ElementSelector from "../elements/ElementSelector";
import LoadingSpinner from "../common/LoadingSpinner";

const EPS = 0.001;
const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

const normalizeLogin = (s) => String(s || "").trim().toLowerCase();

const parseAuthorsLogins = (authors_name) =>
  String(authors_name || "")
    .split(",")
    .map((x) => normalizeLogin(x))
    .filter(Boolean);

const AlloyForm = ({ isEdit = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isAdmin, isResearcher, user } = useAuth();
  const myLogin = useMemo(() => normalizeLogin(user?.login), [user?.login]);

  const [formData, setFormData] = useState({
    prop_value: "",
    category: "",
    rolling_type: "горячая",
    patent_id: "",
    elements: [],
  });

  const [originalElements, setOriginalElements] = useState([]);
  const [patents, setPatents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const totalPercentage = useMemo(() => {
    const sum = (formData.elements || []).reduce(
      (acc, el) => acc + (parseFloat(el?.percentage || 0) || 0),
      0
    );
    return round3(sum);
  }, [formData.elements]);

  const allowedPatentIds = useMemo(() => {
    return new Set((patents || []).map((p) => Number(p.id)));
  }, [patents]);

  const canUseAlloyForm = useMemo(() => {
    return Boolean(user) && (isAdmin || isResearcher);
  }, [user, isAdmin, isResearcher]);

  const isUserAuthorOfPatent = (patent) => {
    if (isAdmin) return true;
    if (!isResearcher) return false;
    const authors = parseAuthorsLogins(patent?.authors_name);
    return authors.includes(myLogin);
  };

  useEffect(() => {
    if (!canUseAlloyForm) {
      alert("У вас нет прав для создания/редактирования сплавов");
      navigate("/alloys");
      return;
    }

    fetchPatents();
    if (isEdit && id) fetchAlloyData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAlloyForm, isEdit, id]);

  const fetchPatents = async () => {
    try {
      const res = await patentService.getAll(0, 100000);
      const all = Array.isArray(res.data) ? res.data : [];
      const filtered = isAdmin ? all : all.filter((p) => isUserAuthorOfPatent(p));
      setPatents(filtered);
    } catch (err) {
      console.error("Error fetching patents:", err);
      setPatents([]);
    }
  };

  const fetchAlloyData = async () => {
    setLoading(true);
    try {
      const [alloyRes, elementsRes] = await Promise.all([
        alloyService.getById(id),
        alloyService.getElements(id),
      ]);

      const elements = (elementsRes.data || []).map((el) => ({
        element_id: el.element_id ?? el.elementid ?? el.elementId,
        percentage:
          el.percentage === null || el.percentage === undefined ? "" : String(el.percentage),
      }));

      setFormData({
        prop_value:
          alloyRes.data?.prop_value === null || alloyRes.data?.prop_value === undefined
            ? ""
            : String(alloyRes.data.prop_value),
        category: alloyRes.data?.category ?? "",
        rolling_type: alloyRes.data?.rolling_type ?? "горячая",
        patent_id: alloyRes.data?.patent_id ?? "",
        elements,
      });

      setOriginalElements(elements);
    } catch (err) {
      console.error("Error fetching alloy data:", err);
      alert("Не удалось загрузить данные сплава");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleElementsChange = (selectedElements) => {
    setFormData((prev) => ({ ...prev, elements: selectedElements || [] }));
    if (errors.elements) setErrors((prev) => ({ ...prev, elements: "" }));
  };

  const validateForm = () => {
    const newErrors = {};

    const prop = Number(String(formData.prop_value).replace(",", "."));
    if (!Number.isFinite(prop) || prop <= 0) {
      newErrors.prop_value = "Значение свойства должно быть положительным числом";
    }

    if (!String(formData.category || "").trim()) {
      newErrors.category = "Категория обязательна";
    }

    if (!formData.patent_id) {
      newErrors.patent_id = "Необходимо выбрать патент";
    } else {
      const pid = Number(formData.patent_id);
      if (!isAdmin && isResearcher && !allowedPatentIds.has(pid)) {
        newErrors.patent_id = "Вы можете выбрать только патент, где вы являетесь автором";
      }
    }

    if (totalPercentage - 100 > EPS) {
      newErrors.elements = `Сумма процентного содержания элементов (${totalPercentage.toFixed(
        3
      )}%) превышает 100.000%`;
    } else if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > EPS) {
      newErrors.elements = `Сумма процентного содержания элементов должна быть ровно 100.000% (сейчас ${totalPercentage.toFixed(
        3
      )}%)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const normalizeElements = (elements) => {
    return (elements || [])
      .filter((el) => el)
      .map((el) => ({
        element_id: parseInt(el.element_id ?? el.elementid ?? el.elementId, 10),
        percentage: round3(Number(String(el.percentage).replace(",", "."))),
      }))
      .filter(
        (el) =>
          Number.isFinite(el.element_id) &&
          Number.isFinite(el.percentage) &&
          el.percentage >= 0 &&
          el.percentage <= 99.999
      );
  };

  const getElementChanges = () => {
    const normalized = normalizeElements(formData.elements);
    const originalNorm = normalizeElements(originalElements);

    const toAdd = normalized.filter(
      (n) => !originalNorm.find((o) => o.element_id === n.element_id)
    );
    const toRemove = originalNorm.filter(
      (o) => !normalized.find((n) => n.element_id === o.element_id)
    );
    const toUpdate = normalized.filter((n) => {
      const o = originalNorm.find((x) => x.element_id === n.element_id);
      return o && o.percentage !== n.percentage;
    });

    return { toAdd, toRemove, toUpdate };
  };

  const updateAlloyElements = async (alloyId) => {
    const { toAdd, toRemove, toUpdate } = getElementChanges();

    for (const el of toRemove) {
      await alloyService.removeElement(alloyId, el.element_id);
    }

    for (const el of toUpdate) {
      await alloyService.removeElement(alloyId, el.element_id);
      await alloyService.addElement(alloyId, el.element_id, el.percentage);
    }

    for (const el of toAdd) {
      await alloyService.addElement(alloyId, el.element_id, el.percentage);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const prop = Number(String(formData.prop_value).replace(",", "."));

      const alloyData = {
        prop_value: round3(prop),
        category: String(formData.category || "").trim(),
        rolling_type: formData.rolling_type,
        patent_id: parseInt(formData.patent_id, 10),
      };

      if (isEdit) {
        await alloyService.update(id, alloyData);
        await updateAlloyElements(id);
        alert("Сплав успешно обновлен!");
      } else {
        const elements = normalizeElements(formData.elements);
        await alloyService.createWithElements(alloyData, elements);
        alert("Сплав успешно создан!");
      }

      navigate("/alloys");
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Ошибка при сохранении сплава";
      alert(errorMsg);
      console.error("Save error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    navigate("/alloys");
  };

  if (loading) return <LoadingSpinner />;

  const patentsEmpty = patents.length === 0;
  const disableSubmitBecauseNoPatents = !isEdit && isResearcher && !isAdmin && patentsEmpty;

  return (
    <div className="alloy-form-container">
      <h2>{isEdit ? "Редактирование сплава" : "Создание сплава"}</h2>

      {!isEdit && disableSubmitBecauseNoPatents && (
        <div className="alert alert-warning">
          Для создания сплава нужен патент, где вы являетесь автором.
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="prop_value">Предел прочности</label>
            <input
              type="number"
              id="prop_value"
              name="prop_value"
              value={formData.prop_value}
              onChange={handleInputChange}
              className={`form-control ${errors.prop_value ? "error" : ""}`}
              placeholder="например: 123.456"
              disabled={submitting}
              step="0.001"
              inputMode="decimal"
            />
            {errors.prop_value && <span className="error-message">{errors.prop_value}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="category">Категория</label>
            <input
              type="text"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className={`form-control ${errors.category ? "error" : ""}`}
              placeholder="Введите категорию"
              disabled={submitting}
            />
            {errors.category && <span className="error-message">{errors.category}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
  <label htmlFor="rolling_type">Тип прокатки</label>
  <input
    type="text"
    id="rolling_type"
    name="rolling_type"
    value={formData.rolling_type}
    onChange={handleInputChange}
    className="form-control"
    disabled={submitting}
    placeholder="Введите тип прокатки"
  />
</div>

          <div className="form-group">
            <label htmlFor="patent_id">Патент</label>
            <select
              id="patent_id"
              name="patent_id"
              value={formData.patent_id}
              onChange={handleInputChange}
              className={`form-control ${errors.patent_id ? "error" : ""}`}
              disabled={submitting || (!isEdit && disableSubmitBecauseNoPatents)}
            >
              <option value="">Выберите патент</option>
              {patents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.patent_name || p.patentname || "Без названия"}
                </option>
              ))}
            </select>
            {errors.patent_id && <span className="error-message">{errors.patent_id}</span>}
            {!isAdmin && isResearcher && (
              <small className="form-hint">
                Исследователь может выбрать только патент, где он автор.
              </small>
            )}
          </div>
        </div>

        <div className="form-section">
          <ElementSelector
            selectedElements={formData.elements}
            onChange={handleElementsChange}
            maxTotalPercentage={100}
            requireExactTotal={true}
            disabled={submitting}
          />

          <div className="form-hint">
            <small>Сумма процентов: {totalPercentage.toFixed(3)}% / 100.000%</small>
          </div>

          {errors.elements && <span className="error-message">{errors.elements}</span>}
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={submitting}
          >
            Отмена
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || disableSubmitBecauseNoPatents}
          >
            {submitting ? "Сохранение..." : isEdit ? "Обновить" : "Создать"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AlloyForm;
