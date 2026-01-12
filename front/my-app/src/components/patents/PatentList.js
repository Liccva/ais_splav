import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { patentService, personService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../common/LoadingSpinner";

const normalizeLogin = (s) => String(s || "").trim().toLowerCase();

// Для отображения — сохраняем регистр как в БД
const splitAuthorsRaw = (authorsName) =>
  String(authorsName || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

// Для проверок прав — нормализуем
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

const PatentList = () => {
  const [patents, setPatents] = useState([]);
  const [filteredPatents, setFilteredPatents] = useState([]);
  const [peopleByLogin, setPeopleByLogin] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { isAdmin, isResearcher, user } = useAuth();
  const myLogin = useMemo(() => normalizeLogin(user?.login), [user?.login]);

  const navigate = useNavigate();

  const canCreatePatent = () => isAdmin || isResearcher;

  const authorsDisplayFromDb = (authorsName) => {
    const rawTokens = splitAuthorsRaw(authorsName);
    if (rawTokens.length === 0) return "—";

    return rawTokens
      .map((tokenRaw) => {
        const person = peopleByLogin[normalizeLogin(tokenRaw)];
        // Если автора нет в системе — выводим как в БД
        if (!person) return tokenRaw;
        return `${personLabelFI(person)} (${person.id})`;
      })
      .join(", ");
  };

  const canEditPatent = (patent) => {
    if (isAdmin) return true;
    if (!isResearcher) return false;
    const authors = splitAuthorsNorm(patent?.authors_name);
    return authors.includes(myLogin);
  };

  // NEW: исследователь может удалять только свои патенты
  const canDeletePatent = (patent) => {
    if (isAdmin) return true;
    if (!isResearcher) return false;
    const authors = splitAuthorsNorm(patent?.authors_name);
    return authors.includes(myLogin);
  };

  const fetchAll = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [patentsRes, peopleRes] = await Promise.all([
        patentService.getAll(0, 100000),
        personService.getAll(0, 100000),
      ]);

      const patentsData = Array.isArray(patentsRes.data) ? patentsRes.data : [];
      const peopleData = Array.isArray(peopleRes.data) ? peopleRes.data : [];

      const byLogin = {};
      peopleData
        .map(buildPerson)
        .filter((p) => String(p.login || "").trim())
        .forEach((p) => {
          byLogin[normalizeLogin(p.login)] = p;
        });

      setPeopleByLogin(byLogin);
      setPatents(patentsData);
      setFilteredPatents(patentsData);
    } catch (e) {
      console.error("Error fetching patents:", e);
      setError(e.response?.data?.detail || e.message || "Ошибка загрузки патентов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = String(searchTerm || "").trim().toLowerCase();
    let filtered = [...(patents || [])];

    if (term) {
      filtered = filtered.filter((p) => {
        const baseText = `${p.patent_name || ""} ${p.authors_name || ""} ${p.description || ""} ${
          p.id || ""
        }`.toLowerCase();
        const renderedAuthors = authorsDisplayFromDb(p.authors_name).toLowerCase();
        return baseText.includes(term) || renderedAuthors.includes(term);
      });
    }

    setFilteredPatents(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, patents, peopleByLogin]);

  const handleDelete = async (patent) => {
    if (!canDeletePatent(patent)) {
      alert("У вас нет прав для удаления этого патента");
      return;
    }

    if (!window.confirm("Вы уверены, что хотите удалить этот патент?")) return;

    try {
      await patentService.delete(patent.id);
      setPatents((prev) => prev.filter((p) => p.id !== patent.id));
      setFilteredPatents((prev) => prev.filter((p) => p.id !== patent.id));
    } catch (err) {
      alert(err.response?.data?.detail || "Ошибка удаления патента");
      console.error("Delete error:", err);
    }
  };

  const handleCreate = () => navigate("/patents/new");

  if (loading) return <LoadingSpinner />;

  if (!user) {
    return (
      <div className="page-container">
        <div className="error-container">
          <h2>У вас нет прав для просмотра патентов.</h2>
          <Link className="btn btn-primary" to="/login">
            Войти в систему
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="patents-page">
      <div className="page-header">
        <h2>Патенты</h2>
        {canCreatePatent() && (
          <button className="btn btn-primary" onClick={handleCreate}>
            Создать патент
          </button>
        )}
      </div>

      <div className="patents-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск (название, авторы, описание, id)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="error-container">
          <h2>Ошибка</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchAll}>
            Повторить
          </button>
        </div>
      )}

      {!error && filteredPatents.length === 0 && (
        <div className="empty-state">
          <h3>Патенты не найдены.</h3>
          {canCreatePatent() && (
            <button className="btn btn-primary mt-2" onClick={handleCreate}>
              Создать первый патент
            </button>
          )}
        </div>
      )}

      {!error && filteredPatents.length > 0 && (
        <div className="table-container">
          <table className="table data-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>№</th>
                <th>Название</th>
                <th>Авторы</th>
                <th>Описание</th>
                <th style={{ width: 220 }}>Действия</th>
              </tr>
            </thead>

            <tbody>
              {filteredPatents.map((p) => {
                const canEdit = canEditPatent(p);
                const canDelete = canDeletePatent(p);

                return (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>
                      <Link to={`/patents/${p.id}`} className="btn-link">
                        {p.patent_name}
                      </Link>
                    </td>
                    <td>{authorsDisplayFromDb(p.authors_name)}</td>
                    <td>
                      {p.description
                        ? p.description.length > 120
                          ? `${p.description.substring(0, 120)}...`
                          : p.description
                        : "—"}
                    </td>
                    <td className="actions">
                      <Link to={`/patents/${p.id}`} className="btn btn-secondary btn-sm">
                        Просмотр
                      </Link>{" "}
                      {canEdit && (
                        <Link to={`/patents/edit/${p.id}`} className="btn btn-outline btn-sm">
                          Изменить
                        </Link>
                      )}{" "}
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(p)}
                        >
                          Удалить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PatentList;
