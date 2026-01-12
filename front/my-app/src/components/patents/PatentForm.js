import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { patentService, personService } from "../../services/api";
import LoadingSpinner from "../common/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";

const normalizeLogin = (s) => String(s || "").trim().toLowerCase();

// Для отображения/сохранения — как в БД (регистр сохраняем)
const splitAuthorsRaw = (authorsName) =>
  String(authorsName || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

// Для проверок — нормализуем
const splitAuthorsNorm = (authorsName) => splitAuthorsRaw(authorsName).map(normalizeLogin);

const buildPerson = (p) => {
  const id = p?.id;
  const login = p?.login ?? p?.Login ?? p?.username ?? "";
  const firstName = p?.firstName ?? p?.firstname ?? p?.first_name ?? "";
  const lastName = p?.lastName ?? p?.lastname ?? p?.last_name ?? "";
  return { id, login, firstName, lastName };
};

const personLabelFI = (person) => {
  const last = String(person?.lastName || "").trim();
  const first = String(person?.firstName || "").trim();
  const fio = `${last} ${first}`.trim();
  return fio || String(person?.login || "").trim() || "Неизвестно";
};

const PatentForm = ({ isEdit = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { isAdmin, isResearcher, user } = useAuth();
  const myLoginNorm = useMemo(() => normalizeLogin(user?.login), [user?.login]);

  const canAccessForm = useMemo(() => Boolean(user) && (isAdmin || isResearcher), [user, isAdmin, isResearcher]);

  const [formData, setFormData] = useState({
    patent_name: "",
    description: "",
  });

  const [people, setPeople] = useState([]);
  const [peopleByLoginNorm, setPeopleByLoginNorm] = useState({});

  // ВАЖНО: храним авторов “как в БД” (с исходным регистром)
  const [selectedAuthorsRaw, setSelectedAuthorsRaw] = useState([]);

  // UI: ручной ввод (для admin)
  const [manualAuthorsText, setManualAuthorsText] = useState("");

  // UI: скрыть/показать список зарегистрированных
  const [showRegisteredPicker, setShowRegisteredPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);

  const selectedAuthorsNorm = useMemo(
    () => (selectedAuthorsRaw || []).map(normalizeLogin).filter(Boolean),
    [selectedAuthorsRaw]
  );

  const isAuthorOfPatent = useCallback(
    (patent) => {
      const authorsNorm = splitAuthorsNorm(patent?.authors_name);
      return authorsNorm.includes(myLoginNorm);
    },
    [myLoginNorm]
  );

  const loadPeople = useCallback(async () => {
    try {
      const res = await personService.getAll(0, 100000);
      const list = Array.isArray(res.data) ? res.data : [];

      const mapped = list.map(buildPerson).filter((p) => String(p.login || "").trim());

      const mapByNorm = {};
      mapped.forEach((p) => {
        mapByNorm[normalizeLogin(p.login)] = p;
      });

      setPeople(mapped);
      setPeopleByLoginNorm(mapByNorm);
    } catch (e) {
      console.error("Error loading persons:", e);
      setPeople([]);
      setPeopleByLoginNorm({});
    }
  }, []);

  const ensureResearcherIsAuthor = useCallback(() => {
    if (!isResearcher || !myLoginNorm) return;

    setSelectedAuthorsRaw((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const prevNorm = prevArr.map(normalizeLogin);
      if (prevNorm.includes(myLoginNorm)) return prevArr;

      const fromPeople = peopleByLoginNorm[myLoginNorm]?.login;
      const myRaw = String(fromPeople || user?.login || "").trim();
      return myRaw ? [myRaw, ...prevArr] : prevArr;
    });
  }, [isResearcher, myLoginNorm, peopleByLoginNorm, user?.login]);

  const fetchPatent = useCallback(async () => {
    if (!id) return;

    setLoading(true);

    try {
      const res = await patentService.getById(id);
      const patent = res.data || {};

      setFormData({
        patent_name: patent.patent_name || "",
        description: patent.description || "",
      });

      setSelectedAuthorsRaw(splitAuthorsRaw(patent.authors_name));

      if (isEdit && isResearcher && !isAdmin && !isAuthorOfPatent(patent)) {
        alert("У вас нет прав для редактирования этого патента");
        navigate("/patents");
        return;
      }

      setIsInitialized(true);
    } catch (err) {
      console.error("Error fetching patent:", err);
      alert(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          "Не удалось загрузить данные патента"
      );
      navigate("/patents");
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, isResearcher, isAdmin, isAuthorOfPatent, navigate]);

  useEffect(() => {
    if (!canAccessForm) {
      alert("У вас нет прав для работы с патентами");
      navigate("/patents");
      return;
    }

    (async () => {
      await loadPeople();

      if (isEdit && id) {
        await fetchPatent();
      } else {
        setIsInitialized(true);
      }

      // гарантируем автора-исследователя
      ensureResearcherIsAuthor();
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessForm, id, isEdit]);

  const addAuthorsFromText = (text, { replace = false } = {}) => {
    const tokens = String(text || "")
      .split(/[,;\n]+/g)
      .map((x) => x.trim())
      .filter(Boolean);

    if (tokens.length === 0) return;

    setSelectedAuthorsRaw((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const base = replace ? [] : prevArr;

      const seen = new Set(base.map(normalizeLogin).filter(Boolean));
      const out = [...base];

      for (const t of tokens) {
        const norm = normalizeLogin(t);
        if (!norm) continue;
        if (seen.has(norm)) continue;
        seen.add(norm);
        out.push(t); // сохраняем как ввели
      }

      return out;
    });

    if (errors.authors_name) setErrors((p) => ({ ...p, authors_name: "" }));
  };

  const removeAuthor = (authorRaw) => {
    const norm = normalizeLogin(authorRaw);

    // Исследователь не может убрать себя
    if (isResearcher && norm === myLoginNorm) return;

    setSelectedAuthorsRaw((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      return prevArr.filter((x) => normalizeLogin(x) !== norm);
    });

    if (errors.authors_name) setErrors((p) => ({ ...p, authors_name: "" }));
  };

  const toggleRegisteredAuthor = (loginRawFromList) => {
    const loginRaw = String(loginRawFromList || "").trim();
    const loginNorm = normalizeLogin(loginRaw);
    if (!loginNorm) return;

    if (isResearcher && loginNorm === myLoginNorm) return;

    setSelectedAuthorsRaw((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const prevNorm = prevArr.map(normalizeLogin);

      if (prevNorm.includes(loginNorm)) {
        return prevArr.filter((x) => normalizeLogin(x) !== loginNorm);
      }

      const fromPeople = peopleByLoginNorm[loginNorm]?.login;
      const rawToAdd = String(fromPeople || loginRaw).trim();
      return rawToAdd ? [...prevArr, rawToAdd] : prevArr;
    });

    if (errors.authors_name) setErrors((p) => ({ ...p, authors_name: "" }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};

    const trimmedName = String(formData.patent_name || "").trim();
    if (!trimmedName) newErrors.patent_name = "Название патента обязательно";
    else if (trimmedName.length < 3) newErrors.patent_name = "Минимум 3 символа";
    else if (trimmedName.length > 255) newErrors.patent_name = "Максимум 255 символов";

    const authorsNorm = (selectedAuthorsRaw || []).map(normalizeLogin).filter(Boolean);
    if (authorsNorm.length === 0) newErrors.authors_name = "Укажите хотя бы одного автора";

    if (isResearcher && myLoginNorm && !authorsNorm.includes(myLoginNorm)) {
      newErrors.authors_name = "Исследователь должен быть среди авторов";
    }

    const trimmedDescription = String(formData.description || "").trim();
    if (trimmedDescription.length > 2000) newErrors.description = "Максимум 2000 символов";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const authors_name = (selectedAuthorsRaw || [])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .join(", ");

      const payload = {
        patent_name: String(formData.patent_name || "").trim(),
        authors_name,
        description: String(formData.description || "").trim(),
      };

      if (isEdit) {
        await patentService.update(id, payload);
        alert("Патент успешно обновлён!");
      } else {
        await patentService.create(payload);
        alert("Патент успешно создан!");
      }

      navigate("/patents");
    } catch (err) {
      console.error("Save error:", err);

      const status = err.response?.status;

      if (status === 401) {
        alert("Неавторизованный доступ. Войдите снова.");
        navigate("/login");
        return;
      }

      if (status === 403) {
        alert("У вас нет прав для выполнения этого действия");
        return;
      }

      alert(err.response?.data?.detail || err.message || "Ошибка при сохранении патента");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    navigate("/patents");
  };

  if (!isInitialized || loading) return <LoadingSpinner />;

  const authorsDisplay = (selectedAuthorsRaw || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  return (
    <div className="patent-form-container">
      <h2>{isEdit ? "Редактирование патента" : "Создание патента"}</h2>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-group">
          <label htmlFor="patent_name">
            Название патента{" "}
            <span className="char-count">
              {String(formData.patent_name || "").trim().length}/255
            </span>
          </label>
          <input
            type="text"
            id="patent_name"
            name="patent_name"
            value={formData.patent_name}
            onChange={handleInputChange}
            className={`form-control ${errors.patent_name ? "error" : ""}`}
            placeholder="Введите название патента"
            disabled={submitting}
            maxLength={255}
          />
          {errors.patent_name && <span className="error-message">{errors.patent_name}</span>}
        </div>

        {/* AUTHORS */}
        <div className="form-group">
          <label>Авторы</label>

          {errors.authors_name && <div className="error-message">{errors.authors_name}</div>}

          {/* Текущий список авторов */}
          <div style={{ marginTop: 8 }}>
            {authorsDisplay.length === 0 ? (
              <div className="text-muted">—</div>
            ) : (
              <ul style={{ margin: "6px 0 0 18px" }}>
                {authorsDisplay.map((a) => {
                  const aNorm = normalizeLogin(a);
                  const isMyself = isResearcher && aNorm === myLoginNorm;

                  return (
                    <li key={aNorm} style={{ marginBottom: 6 }}>
                      <span>{a}</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ marginLeft: 10 }}
                        onClick={() => removeAuthor(a)}
                        disabled={submitting || isMyself}
                        title={isMyself ? "Исследователь не может удалить себя из авторов" : "Удалить"}
                      >
                        Удалить
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Admin: ручной ввод строкой */}
          {isAdmin && (
            <div style={{ marginTop: 12 }}>
              <div className="text-muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Можно вставить авторов строкой (ФИО/логины), разделяя запятыми/точкой с запятой/переносом строки.
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ minWidth: 280, flex: "1 1 280px" }}
                  value={manualAuthorsText}
                  onChange={(e) => setManualAuthorsText(e.target.value)}
                  placeholder="Напр.: Иванов И.И., Petrov P.P., external_author"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    addAuthorsFromText(manualAuthorsText, { replace: false });
                    setManualAuthorsText("");
                  }}
                  disabled={submitting || !String(manualAuthorsText).trim()}
                >
                  Добавить
                </button>
              </div>
            </div>
          )}

          {/* Кнопка раскрытия выбора зарегистрированных */}
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowRegisteredPicker((v) => !v)}
              disabled={submitting}
            >
              {showRegisteredPicker ? "Скрыть зарегистрированных" : "Выбрать из зарегистрированных"}
            </button>
          </div>

          {/* Скрытый список зарегистрированных */}
          {showRegisteredPicker && (
            <div
              className="authors-selector"
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 12,
                marginTop: 10,
                maxHeight: 260,
                overflow: "auto",
              }}
            >
              {people.length === 0 ? (
                <div className="text-muted">Нет пользователей для выбора.</div>
              ) : (
                <ul style={{ listStyle: "disc", margin: "0 0 0 18px", padding: 0 }}>
                  {people
                    .slice()
                    .sort((a, b) => String(a.login).localeCompare(String(b.login)))
                    .map((p) => {
                      const loginNorm = normalizeLogin(p.login);
                      const checked = selectedAuthorsNorm.includes(loginNorm);
                      const disabled = Boolean(submitting) || (isResearcher && loginNorm === myLoginNorm);

                      const label = `${personLabelFI(p)} (${p.login})`;

                      return (
                        <li key={p.id ?? p.login} style={{ marginBottom: 6 }}>
                          <label style={{ cursor: disabled ? "not-allowed" : "pointer" }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleRegisteredAuthor(p.login)}
                              style={{ marginRight: 8 }}
                            />
                            {label}
                          </label>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* DESCRIPTION */}
        <div className="form-group">
          <label htmlFor="description">
            Описание{" "}
            <span className="char-count">{String(formData.description || "").trim().length}/2000</span>
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Введите описание"
            rows={6}
            className={`form-control ${errors.description ? "error" : ""}`}
            disabled={submitting}
            maxLength={2000}
          />
          {errors.description && <span className="error-message">{errors.description}</span>}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={submitting}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Сохранение..." : isEdit ? "Сохранить" : "Создать"}
          </button>
        </div>

        {/* debug/подсказка */}
        <div className="text-muted" style={{ marginTop: 10, fontSize: 12 }}>
          authors_name: <code>{authorsDisplay.join(", ") || "—"}</code>
        </div>
      </form>
    </div>
  );
};

export default PatentForm;
