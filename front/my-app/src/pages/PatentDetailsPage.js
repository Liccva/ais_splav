import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import { patentService, personService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";

const normalizeLogin = (s) => String(s || "").trim().toLowerCase();

const splitAuthorsRaw = (authorsName) =>
  String(authorsName || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

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
  return fio;
};

const PatentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [patent, setPatent] = useState(null);
  const [peopleByLogin, setPeopleByLogin] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPatentDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [patentRes, peopleRes] = await Promise.all([
        patentService.getById(id),
        personService.getAll(0, 100000),
      ]);

      setPatent(patentRes.data);

      const peopleData = Array.isArray(peopleRes.data) ? peopleRes.data : [];
      const byLogin = {};
      peopleData
        .map(buildPerson)
        .filter((p) => String(p.login || "").trim())
        .forEach((p) => {
          byLogin[normalizeLogin(p.login)] = p;
        });
      setPeopleByLogin(byLogin);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка загрузки патента");
      console.error("Error fetching patent details:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatentDetails();
  }, [fetchPatentDetails]);

  const authorsPretty = useMemo(() => {
    const tokens = splitAuthorsRaw(patent?.authors_name);

    if (tokens.length === 0) return "—";

    return tokens
      .map((loginRaw) => {
        const login = String(loginRaw || "").trim();
        const person = peopleByLogin[normalizeLogin(login)];

        if (!person) return login;

        const fio = personLabelFI(person);
        return fio ? `${fio} (${login})` : login;
      })
      .join(", ");
  }, [patent?.authors_name, peopleByLogin]);

  const handleBack = () => navigate("/patents");

  const handleDelete = async () => {
    if (!window.confirm("Вы уверены, что хотите удалить этот патент?")) return;

    try {
      await patentService.delete(id);
      alert("Патент успешно удалён!");
      navigate("/patents");
    } catch (err) {
      alert(err.response?.data?.detail || "Ошибка удаления патента");
      console.error("Delete error:", err);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="page-container">
        <div className="error-container">
          <h2>Ошибка</h2>
          <p>{error}</p>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={handleBack}>
              Назад к списку
            </button>
            <button className="btn btn-primary" onClick={fetchPatentDetails}>
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!patent) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Патент не найден</h3>
          <button className="btn btn-secondary" onClick={handleBack}>
            Назад к списку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <h2 style={{ marginRight: "auto" }}>Детали патента</h2>

        <button className="btn btn-secondary" onClick={handleBack}>
          Назад к списку
        </button>

        {isAdmin && (
          <Link className="btn btn-outline" to={`/patents/edit/${patent.id}`}>
            Редактировать
          </Link>
        )}

        {isAdmin && (
          <button className="btn btn-danger" onClick={handleDelete}>
            Удалить
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="table">
          <tbody>
            <tr>
              <th style={{ width: 160 }}>ID:</th>
              <td>{patent.id}</td>
            </tr>
            <tr>
              <th>Название:</th>
              <td>{patent.patent_name}</td>
            </tr>
            <tr>
              <th>Авторы:</th>
              <td>{authorsPretty}</td>
            </tr>
            <tr>
              <th>Описание:</th>
              <td>{patent.description || "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PatentDetailsPage;
