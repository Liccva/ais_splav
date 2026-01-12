import React, { useEffect, useMemo, useState } from "react";
import { elementService } from "../../services/api";

const EPS = 0.001;

const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const isDecimal3Input = (s) => /^(\d+)?(\.\d{0,3})?$/.test(s);

const normalizeDecimalInput = (raw) => String(raw ?? "").replace(",", ".");

const normalizeText = (s) => String(s || "").trim().toLowerCase();

const ElementSelector = ({
  selectedElements = [],
  onChange,
  maxTotalPercentage = 100,
  requireExactTotal = false,
  disabled = false,
}) => {
  const [allElements, setAllElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerms, setSearchTerms] = useState([]);

  useEffect(() => {
    fetchElements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearchTerms((prev) => {
      const next = [...prev];
      if (next.length < normalizedSelected.length) {
        while (next.length < normalizedSelected.length) next.push("");
      } else if (next.length > normalizedSelected.length) {
        next.length = normalizedSelected.length;
      }
      return next.map((x) => x ?? "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElements?.length]);

  const fetchElements = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await elementService.getAll();
      setAllElements(response.data || []);
    } catch (err) {
      setError("Ошибка загрузки элементов");
      console.error("Error fetching elements:", err);
    } finally {
      setLoading(false);
    }
  };

  // Исправлено: используем правильные имена полей
  const normalizedSelected = useMemo(() => {
    return (selectedElements || []).map((el) => ({
      element_id: el?.element_id ?? el?.element_id ?? "",
      percentage:
        el?.percentage === null || el?.percentage === undefined
          ? ""
          : String(el.percentage),
    }));
  }, [selectedElements]);

  const totalPercentage = useMemo(() => {
    const sum = normalizedSelected.reduce(
      (acc, el) => acc + (parseFloat(el.percentage) || 0),
      0
    );
    return round3(sum);
  }, [normalizedSelected]);

  const handleAddElement = () => {
    const newElement = { element_id: "", percentage: "" };
    setSearchTerms((prev) => [...prev, ""]);
    onChange([...normalizedSelected, newElement]);
  };

  const handleRemoveElement = (index) => {
    setSearchTerms((prev) => prev.filter((_, i) => i !== index));
    onChange(normalizedSelected.filter((_, i) => i !== index));
  };

  const handleElementChange = (index, field, value) => {
    const updated = [...normalizedSelected];

    if (field === "percentage") {
      const v = normalizeDecimalInput(value);

      if (v !== "" && !isDecimal3Input(v)) return;

      if (v !== "") {
        const num = Number(v);
        if (Number.isFinite(num)) {
          const clamped = clamp(num, 0, 99.999);
          updated[index] = { ...updated[index], percentage: String(clamped) };
        } else {
          updated[index] = { ...updated[index], percentage: v };
        }
      } else {
        updated[index] = { ...updated[index], percentage: "" };
      }

      onChange(updated);
      return;
    }

    // Исправлено: snake_case для element_id
    if (field === "element_id") {
      updated[index] = { ...updated[index], element_id: value };
      onChange(updated);
      return;
    }
  };

  const handlePercentageBlur = (index) => {
    const updated = [...normalizedSelected];
    const v = normalizeDecimalInput(updated[index]?.percentage);

    if (v === "") {
      onChange(updated);
      return;
    }

    const num = Number(v);
    if (!Number.isFinite(num)) {
      onChange(updated);
      return;
    }

    const fixed = round3(clamp(num, 0, 99.999)).toFixed(3);
    updated[index] = { ...updated[index], percentage: fixed };
    onChange(updated);
  };

  const handleSearchChange = (index, value) => {
    setSearchTerms((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const getFilteredOptions = (index, selectedElementId) => {
    const q = normalizeText(searchTerms[index]);
    const filtered = q
      ? allElements.filter((el) => {
          const name = normalizeText(el.name);
          const symbol = normalizeText(el.symbol);
          const idStr = String(el.id ?? "");
          return (
            name.includes(q) ||
            symbol.includes(q) ||
            idStr.includes(q)
          );
        })
      : allElements;

    const selIdNum = selectedElementId ? Number(selectedElementId) : null;
    const selectedEl =
      selIdNum != null ? allElements.find((e) => Number(e.id) === selIdNum) : null;

    if (selectedEl && !filtered.some((e) => Number(e.id) === selIdNum)) {
      return [selectedEl, ...filtered];
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="composition-form">
        <div className="info-message">
          <p>Загрузка элементов…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="composition-form">
        <div className="error-message">{error}</div>
        <button type="button" className="btn btn-primary" onClick={fetchElements}>
          Повторить
        </button>
      </div>
    );
  }

  const hasOverMax = totalPercentage - maxTotalPercentage > EPS;
  const needsExact =
    requireExactTotal && totalPercentage > 0 && Math.abs(totalPercentage - 100) > EPS;

  return (
    <div className="composition-form">
      <h3 className="section-title">Состав</h3>

      <div className="element-controls-container">
        {normalizedSelected.length === 0 ? (
          <div className="empty-composition">
            <p>Элементы не добавлены</p>
          </div>
        ) : (
          <div>
            {normalizedSelected.map((selected, index) => {
              const options = getFilteredOptions(index, selected.element_id);

              return (
                <div key={index} className="element-input-row">
                  <div className="form-group">
                    <label className="form-label">Элемент</label>

                    <input
                      type="text"
                      className="form-control"
                      placeholder="Поиск: имя / символ / номер"
                      value={searchTerms[index] ?? ""}
                      onChange={(e) => handleSearchChange(index, e.target.value)}
                      disabled={disabled}
                      style={{ marginBottom: 8 }}
                    />

                    <select
                      className="element-select"
                      value={selected.element_id}
                      onChange={(e) => {
                        // Исправлено: передаем значение в поле element_id
                        handleElementChange(index, "element_id", e.target.value);
                        handleSearchChange(index, "");
                      }}
                      disabled={disabled}
                    >
                      <option value="">Выберите элемент</option>
                      {options.map((el) => (
                        <option key={el.id} value={el.id}>
                          {el.name} {el.symbol ? `(${el.symbol})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">%</label>
                    <input
                      type="number"
                      className="percentage-input"
                      min={0}
                      max={99.999}
                      step="0.001"
                      inputMode="decimal"
                      value={selected.percentage}
                      onChange={(e) =>
                        handleElementChange(index, "percentage", e.target.value)
                      }
                      onBlur={() => handlePercentageBlur(index)}
                      placeholder="например: 12.345"
                      disabled={disabled}
                    />
                  </div>

                  <div className="element-buttons">
                    <button
                      type="button"
                      className="btn-remove-element"
                      onClick={() => handleRemoveElement(index)}
                      disabled={disabled}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="form-actions" style={{ justifyContent: "flex-start" }}>
          <button
            type="button"
            className="btn-add-element"
            onClick={handleAddElement}
            disabled={disabled}
          >
            Добавить элемент
          </button>
        </div>
      </div>

      <div className={`total-percentage ${!hasOverMax && !needsExact ? "valid" : "invalid"}`}>
        {totalPercentage.toFixed(3)}% / {Number(maxTotalPercentage).toFixed(3)}%
      </div>

      {hasOverMax && (
        <div className="validation-error">
          Сумма процентов не должна превышать {Number(maxTotalPercentage).toFixed(3)}%.
        </div>
      )}

      {needsExact && (
        <div className="validation-error">Сумма процентов должна быть ровно 100.000%.</div>
      )}
    </div>
  );
};

export default ElementSelector;