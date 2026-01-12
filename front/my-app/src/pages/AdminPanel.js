import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { modelService, personService, roleService } from "../services/api";

const ORG_NONE = "__NO_ORG__";

export default function AdminPanel() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("models");
  const [loading, setLoading] = useState(false);

  const [bulkApplying, setBulkApplying] = useState(false);
  const [progressText, setProgressText] = useState("");

  const [error, setError] = useState("");

  const [models, setModels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [persons, setPersons] = useState([]);

  // create forms
  const [newModel, setNewModel] = useState({ name: "", description: "" });
  const [newRole, setNewRole] = useState({ name: "", description: "" });

  // user filters + bulk role
  const [orgFilter, setOrgFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [bulkRoleId, setBulkRoleId] = useState("");

  const safeTrim = (v) => String(v ?? "").trim();

  const reloadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [m, r, p] = await Promise.all([
        modelService.getAll(),
        roleService.getAll(),
        personService.getAll(0, 5000),
      ]);

      setModels(m.data || []);
      setRoles(r.data || []);
      setPersons(p.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, []);

  // организации для dropdown (пустые не добавляем в список)
  const organizations = useMemo(() => {
    const set = new Set(
      (persons || [])
        .map((u) => safeTrim(u.organization))
        .filter(Boolean)
    );

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [persons]);

  const filteredPersons = useMemo(() => {
    let list = persons || [];

    const org = safeTrim(orgFilter);

    // --- ФИЛЬТР ПО ОРГАНИЗАЦИИ ---
    if (org === ORG_NONE) {
      list = list.filter((p) => safeTrim(p.organization) === "");
    } else if (org) {
      list = list.filter((p) => safeTrim(p.organization) === org);
    }

    const q = safeTrim(userSearch).toLowerCase();
    if (!q) return list;

    return list.filter((u) => {
      const idStr = String(u.id ?? "").toLowerCase();
      const login = String(u.login ?? "").toLowerCase();
      const firstName = String(u.first_name ?? "").toLowerCase();
      const lastName = String(u.last_name ?? "").toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();

      return (
        idStr.includes(q) ||
        login.includes(q) ||
        firstName.includes(q) ||
        lastName.includes(q) ||
        fullName.includes(q)
      );
    });
  }, [persons, orgFilter, userSearch]);

  // если пароль не приходит в DTO, дотягиваем по логину (у тебя такой метод есть в api.js)
  const getPasswordForUser = async (u) => {
    if (u?.password) return u.password;
    const res = await personService.getPasswordByLogin(u.login);
    return res.data;
  };

  // ---------- actions: models ----------
  const createModel = async () => {
    setLoading(true);
    setError("");
    try {
      await modelService.create({
        name: safeTrim(newModel.name),
        description: safeTrim(newModel.description),
      });
      setNewModel({ name: "", description: "" });
      await reloadAll();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка создания модели");
    } finally {
      setLoading(false);
    }
  };

  const deleteModel = async (id) => {
    if (!window.confirm(`Удалить модель #${id}?`)) return;
    setLoading(true);
    setError("");
    try {
      await modelService.delete(id);
      await reloadAll();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка удаления модели");
    } finally {
      setLoading(false);
    }
  };

  // ---------- actions: roles ----------
  const createRole = async () => {
    setLoading(true);
    setError("");
    try {
      await roleService.create({
        name: safeTrim(newRole.name),
        description: safeTrim(newRole.description),
      });
      setNewRole({ name: "", description: "" });
      await reloadAll();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка создания роли");
    } finally {
      setLoading(false);
    }
  };

  const deleteRole = async (id) => {
    if (!window.confirm(`Удалить роль #${id}?`)) return;
    setLoading(true);
    setError("");
    try {
      await roleService.delete(id);
      await reloadAll();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка удаления роли");
    } finally {
      setLoading(false);
    }
  };

  // ---------- actions: users ----------
  const updateUserRole = async (personId, newRoleId) => {
    const user = (persons || []).find((p) => p.id === personId);
    if (!user) return;

    setLoading(true);
    setError("");
    try {
      const password = await getPasswordForUser(user);

      await personService.update(personId, {
        first_name: user.first_name,
        last_name: user.last_name,
        organization: user.organization,
        login: user.login,
        password,
        role_id: Number(newRoleId),
      });

      await reloadAll();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка смены роли");
    } finally {
      setLoading(false);
    }
  };

  // массовая смена роли — строго по текущим фильтрам (org + search)
  const applyRoleToFilteredUsers = async () => {
    if (!bulkRoleId) return alert("Выбери роль для массового назначения");

    const targets = filteredPersons || [];
    if (targets.length === 0) return alert("Нет пользователей, подходящих под фильтры");

    const confirmText =
      `Назначить роль #${bulkRoleId} для пользователей по текущим фильтрам?\n` +
      `Количество: ${targets.length}`;

    if (!window.confirm(confirmText)) return;

    setBulkApplying(true);
    setError("");
    setProgressText("Старт...");

    const failed = [];
    try {
      for (let i = 0; i < targets.length; i++) {
        const u = targets[i];
        setProgressText(`Обновление ${i + 1}/${targets.length}: id=${u.id}, login=${u.login}`);

        try {
          // можно оптимизировать: не слать запрос если роль уже такая
          if (Number(u.role_id) === Number(bulkRoleId)) continue;

          const password = await getPasswordForUser(u);

          await personService.update(u.id, {
            first_name: u.first_name,
            last_name: u.last_name,
            organization: u.organization,
            login: u.login,
            password,
            role_id: Number(bulkRoleId),
          });
        } catch (e) {
          failed.push({
            id: u.id,
            login: u.login,
            error: e.response?.data?.detail || e.message || "unknown error",
          });
        }
      }

      await reloadAll();

      if (failed.length > 0) {
        setError(
          `Часть пользователей не обновилась (${failed.length}). ` +
            `Пример: id=${failed[0].id}, login=${failed[0].login}, err=${failed[0].error}`
        );
      }
    } finally {
      setProgressText("");
      setBulkApplying(false);
    }
  };

  const resetUserFilters = () => {
    setOrgFilter("");
    setUserSearch("");
  };

  const isBusy = loading || bulkApplying;

  // Фикс габаритов таб-кнопок (и по высоте, и по ширине), чтобы не прыгали
  const tabBtnStyle = {
    width: 170, // все одинаковые по ширине
    minHeight: 36,
    padding: "0.45rem 0.8rem",
    fontSize: "0.9rem",
    lineHeight: 1.1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>

        <button
          style={tabBtnStyle}
          className={`btn ${tab === "models" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("models")}
          disabled={isBusy}
        >
          Модели
        </button>

        <button
          style={tabBtnStyle}
          className={`btn ${tab === "roles" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("roles")}
          disabled={isBusy}
        >
          Роли
        </button>

        <button
          style={tabBtnStyle}
          className={`btn ${tab === "users" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setTab("users")}
          disabled={isBusy}
        >
          Пользователи
        </button>


      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      {bulkApplying ? (
        <div className="alert alert-info" style={{ whiteSpace: "pre-wrap" }}>
          {progressText || "Выполняется..."}
        </div>
      ) : null}

      {tab === "models" ? (
        <div>
          <h2>Модели</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <input
              className="form-control"
              placeholder="Название"
              value={newModel.name}
              onChange={(e) => setNewModel((p) => ({ ...p, name: e.target.value }))}
              disabled={isBusy}
              style={{ maxWidth: 280 }}
            />
            <input
              className="form-control"
              placeholder="Описание"
              value={newModel.description}
              onChange={(e) => setNewModel((p) => ({ ...p, description: e.target.value }))}
              disabled={isBusy}
              style={{ maxWidth: 420 }}
            />
            <button className="btn btn-primary" onClick={createModel} disabled={isBusy}>
              Создать
            </button>
          </div>

          {models.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id}>
                    <td>{m.id}</td>
                    <td>{m.name}</td>
                    <td>{m.description}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteModel(m.id)}
                        disabled={isBusy}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>Нет моделей</div>
          )}
        </div>
      ) : null}

      {tab === "roles" ? (
        <div>
          <h2>Роли</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <input
              className="form-control"
              placeholder="Название"
              value={newRole.name}
              onChange={(e) => setNewRole((p) => ({ ...p, name: e.target.value }))}
              disabled={isBusy}
              style={{ maxWidth: 280 }}
            />
            <input
              className="form-control"
              placeholder="Описание"
              value={newRole.description}
              onChange={(e) => setNewRole((p) => ({ ...p, description: e.target.value }))}
              disabled={isBusy}
              style={{ maxWidth: 420 }}
            />
            <button className="btn btn-primary" onClick={createRole} disabled={isBusy}>
              Создать
            </button>
          </div>

          {roles.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.description}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteRole(r.id)}
                        disabled={isBusy}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>Нет ролей</div>
          )}
        </div>
      ) : null}

      {tab === "users" ? (
        <div>
          <h2>Пользователи</h2>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <select
              className="form-control"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              disabled={isBusy}
              style={{ maxWidth: 320 }}
            >
              <option value="">Все организации</option>
              <option value={ORG_NONE}>Без организации</option>
              {organizations.map((org) => (
                <option key={org} value={org}>
                  {org}
                </option>
              ))}
            </select>

            <input
              className="form-control"
              placeholder="Поиск по id/login/имени"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              disabled={isBusy}
              style={{ maxWidth: 360 }}
            />

            <button className="btn btn-secondary" onClick={resetUserFilters} disabled={isBusy}>
              Сбросить фильтры
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <select
              className="form-control"
              value={bulkRoleId}
              onChange={(e) => setBulkRoleId(e.target.value)}
              disabled={isBusy}
              style={{ maxWidth: 260 }}
            >
              <option value="">Массово назначить роль...</option>
              {roles.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.id} — {r.name}
                </option>
              ))}
            </select>

            <button
              className="btn btn-primary"
              onClick={applyRoleToFilteredUsers}
              disabled={isBusy || !bulkRoleId}
            >
              Применить к отфильтрованным
            </button>

            <div style={{ alignSelf: "center", color: "#666" }}>
              Найдено: {filteredPersons.length}
            </div>
          </div>

          {filteredPersons.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th style={{ width: 180 }}>Login</th>
                  <th>Name</th>
                  <th style={{ width: 220 }}>Org</th>
                  <th style={{ width: 220 }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredPersons.map((u) => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.login}</td>
                    <td>
                      {u.first_name} {u.last_name}
                    </td>
                    <td>{safeTrim(u.organization)}</td>
                    <td>
                      <select
                        className="form-control"
                        value={String(u.role_id ?? "")}
                        onChange={(e) => updateUserRole(u.id, e.target.value)}
                        disabled={isBusy}
                      >
                        <option value="">(нет роли)</option>
                        {roles.map((r) => (
                          <option key={r.id} value={String(r.id)}>
                            {r.id} — {r.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div>Нет пользователей по текущим фильтрам</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
