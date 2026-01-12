import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  personService,
  roleService,
  predictionService,
  alloyService,
  patentService,
  modelService,
  elementService,
} from "../services/api";

const getField = (obj, keys) => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
};

const groupCount = (items, keyFn) => {
  const map = new Map();
  for (const it of items || []) {
    const key = keyFn(it);
    const k = String(key ?? "").trim() || "(пусто)";
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const toCsv = (rows, headers) => {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const head = headers.map((h) => esc(h.label)).join(",");
  const body = (rows || [])
    .map((r) => headers.map((h) => esc(typeof h.value === "function" ? h.value(r) : r[h.value])).join(","))
    .join("\n");
  return `${head}\n${body}\n`;
};

const downloadTextFile = (filename, content, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const TabBtn = ({ active, onClick, children, disabled }) => (
  <button type="button" className={`admin-tab ${active ? "active" : ""}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const userId = user?.id;

  // только 2 вкладки: summary (только для admin) и my (для всех)
  const [tab, setTab] = useState(isAdmin ? "summary" : "my");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // admin: данные системы
  const [roles, setRoles] = useState([]);
  const [persons, setPersons] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [alloys, setAlloys] = useState([]);
  const [patents, setPatents] = useState([]);
  const [models, setModels] = useState([]);
  const [elements, setElements] = useState([]);

  // admin summary extras
  const [elementRanking, setElementRanking] = useState([]); // [{ elementId, name, symbol, count }]
  const [elementStatsInfo, setElementStatsInfo] = useState({ usedPredictions: 0, totalPredictions: 0 });

  // everyone: мои прогнозы
  const [myPredictions, setMyPredictions] = useState([]);

  const loadAdminData = async () => {
    const [r, p, pr, a, pa, m, el] = await Promise.all([
      roleService.getAll(),
      personService.getAll(0, 100000),
      predictionService.getAll(0, 100000),
      alloyService.getAll(0, 100000),
      patentService.getAll(0, 100000),
      modelService.getAll(),
      elementService.getAll(),
    ]);

    setRoles(r.data || []);
    setPersons(p.data || []);
    setPredictions(pr.data || []);
    setAlloys(a.data || []);
    setPatents(pa.data || []);
    setModels(m.data || []);
    setElements(el.data || []);

    // Рейтинг элементов: считаем по последним N прогнозам, чтобы не делать слишком много запросов
    const allPreds = pr.data || [];
    const MAX_FOR_ELEMENT_STATS = 200;

    const sorted = [...allPreds].sort((x, y) => (Number(y.id) || 0) - (Number(x.id) || 0));
    const subset = sorted.slice(0, MAX_FOR_ELEMENT_STATS);

    const elMap = new Map();
    (el.data || []).forEach((e) => elMap.set(String(e.id), e));

    const responses = await Promise.all(
      subset.map(async (pred) => {
        try {
          const res = await predictionService.getElements(pred.id);
          return { predId: pred.id, items: res.data || [] };
        } catch {
          return { predId: pred.id, items: [] };
        }
      })
    );

    const freq = new Map(); // elementId -> count occurrences
    for (const r0 of responses) {
      for (const it of r0.items) {
        const eid = String(getField(it, ["element_id", "elementid", "elementId"]));
        if (!eid || eid === "undefined" || eid === "null") continue;
        freq.set(eid, (freq.get(eid) || 0) + 1);
      }
    }

    const ranking = Array.from(freq.entries())
      .map(([elementId, count]) => {
        const e = elMap.get(String(elementId));
        return {
          elementId,
          count,
          name: e?.name || `element#${elementId}`,
          symbol: e?.symbol || "",
        };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 15);

    setElementRanking(ranking);
    setElementStatsInfo({ usedPredictions: subset.length, totalPredictions: allPreds.length });
  };

  const loadMyPredictions = async () => {
    if (!userId) {
      setMyPredictions([]);
      return;
    }
    const res = await predictionService.getByPerson(userId);
    setMyPredictions(res.data || []);
  };

  useEffect(() => {
    // если вдруг роль/статус поменялся — не оставляем не-админа на summary
    if (!isAdmin && tab === "summary") setTab("my");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        // всегда загружаем мои прогнозы (даже админу)
        await loadMyPredictions();

        if (isAdmin) {
          await loadAdminData();
        } else {
          // чтобы в "Мои предсказания" показывать имена моделей
          const m = await modelService.getAll();
          setModels(m.data || []);
        }
      } catch (e) {
        setError(e.response?.data?.detail || e.message || "Ошибка загрузки отчётов");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, userId]);

  // ---- mappings ----
  const roleIdToName = useMemo(() => {
    const map = new Map();
    for (const r of roles || []) map.set(String(r.id), r.name);
    return map;
  }, [roles]);

  const modelIdToName = useMemo(() => {
    const map = new Map();
    for (const m of models || []) map.set(String(m.id), m.name);
    return map;
  }, [models]);

  const personIdToUser = useMemo(() => {
    const map = new Map();
    for (const p of persons || []) map.set(String(p.id), p);
    return map;
  }, [persons]);

  // ---- summary blocks ----
  const adminTotals = useMemo(() => {
    if (!isAdmin) return null;
    return {
      users: persons.length,
      roles: roles.length,
      elements: elements.length,
      predictions: predictions.length,
      alloys: alloys.length,
      patents: patents.length,
      models: models.length,
    };
  }, [isAdmin, persons, roles, elements, predictions, alloys, patents, models]);

  const usersByRole = useMemo(() => {
    if (!isAdmin) return [];
    return groupCount(persons, (u) => {
      const rid = getField(u, ["role_id", "roleid"]);
      return roleIdToName.get(String(rid)) || `role#${rid ?? "?"}`;
    });
  }, [isAdmin, persons, roleIdToName]);

  const predictionsByCategory = useMemo(() => {
    if (!isAdmin) return [];
    return groupCount(predictions, (p) => getField(p, ["category"]));
  }, [isAdmin, predictions]);

  const predictionsByRolling = useMemo(() => {
    if (!isAdmin) return [];
    return groupCount(predictions, (p) => getField(p, ["rolling_type", "rollingtype"]));
  }, [isAdmin, predictions]);

  const predictionsByModel = useMemo(() => {
    if (!isAdmin) return [];
    return groupCount(predictions, (p) => {
      const mid = getField(p, ["ml_model_id", "mlmodelid", "mlmodel_id"]);
      return modelIdToName.get(String(mid)) || `model#${mid ?? "?"}`;
    });
  }, [isAdmin, predictions, modelIdToName]);

  const mostActiveUsers = useMemo(() => {
    if (!isAdmin) return [];
    const counts = new Map(); // personId -> count

    for (const p of predictions || []) {
      const pid = getField(p, ["person_id", "personid"]);
      const key = String(pid ?? "");
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([personId, count]) => {
        const u = personIdToUser.get(String(personId));
        const rid = getField(u, ["role_id", "roleid"]);
        return {
          personId,
          count,
          login: u?.login || "-",
          name: `${u?.first_name ?? u?.firstname ?? ""} ${u?.last_name ?? u?.lastname ?? ""}`.trim() || "-",
          organization: u?.organization || "-",
          role: roleIdToName.get(String(rid)) || (rid ? `role#${rid}` : "-"),
        };
      })
      .sort((a, b) => b.count - a.count || a.login.localeCompare(b.login))
      .slice(0, 10);
  }, [isAdmin, predictions, personIdToUser, roleIdToName]);

  const orgsByPredictions = useMemo(() => {
    if (!isAdmin) return [];
    return groupCount(predictions, (p) => {
      const pid = getField(p, ["person_id", "personid"]);
      const u = personIdToUser.get(String(pid));
      return u?.organization || "(пусто)";
    }).slice(0, 10);
  }, [isAdmin, predictions, personIdToUser]);

  const recentPredictions = useMemo(() => {
    if (!isAdmin) return [];
    const arr = [...(predictions || [])];
    arr.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return arr.slice(0, 10);
  }, [isAdmin, predictions]);

  // ---- my predictions ----
  const myPredictionsSorted = useMemo(() => {
    const arr = [...(myPredictions || [])];
    arr.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return arr;
  }, [myPredictions]);

  const myByCategory = useMemo(() => groupCount(myPredictions, (p) => getField(p, ["category"])), [myPredictions]);
  const myByRolling = useMemo(
    () => groupCount(myPredictions, (p) => getField(p, ["rolling_type", "rollingtype"])),
    [myPredictions]
  );

  const downloadMyPredictionsCsv = () => {
    const headers = [
      { label: "id", value: (p) => p.id },
      { label: "category", value: (p) => getField(p, ["category"]) },
      { label: "rolling_type", value: (p) => getField(p, ["rolling_type", "rollingtype"]) },
      { label: "prop_value", value: (p) => getField(p, ["prop_value", "propvalue"]) },
      { label: "ml_model_id", value: (p) => getField(p, ["ml_model_id", "mlmodelid", "mlmodel_id"]) },
      { label: "person_id", value: (p) => getField(p, ["person_id", "personid"]) },
    ];
    downloadTextFile("my_predictions_report.csv", toCsv(myPredictionsSorted, headers));
  };

  if (loading) {
    return (
      <div className="reports-page">
        <div className="page-header">
          <h2>Отчёты</h2>
        </div>
        <div className="info-message">
          <p>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <h2>Отчёты</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Tabs: "Сводка" скрыта для не-админов */}
      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        {isAdmin && (
          <TabBtn active={tab === "summary"} onClick={() => setTab("summary")}>
            Сводка
          </TabBtn>
        )}

        <TabBtn active={tab === "my"} onClick={() => setTab("my")}>
          Мои предсказания
        </TabBtn>
      </div>

      {/* SUMMARY (admin only) */}
      {isAdmin && tab === "summary" && adminTotals && (
        <>
          <div className="data-card">
            <h3>Сводка системы</h3>
            <div className="stats-cards">
              <div className="stat-card">
                <h3>Пользователи</h3>
                <p className="stat-number">{adminTotals.users}</p>
              </div>
              <div className="stat-card">
                <h3>Роли</h3>
                <p className="stat-number">{adminTotals.roles}</p>
              </div>
              <div className="stat-card">
                <h3>Элементы</h3>
                <p className="stat-number">{adminTotals.elements}</p>
              </div>
              <div className="stat-card">
                <h3>Прогнозы</h3>
                <p className="stat-number">{adminTotals.predictions}</p>
              </div>
              <div className="stat-card">
                <h3>Сплавы</h3>
                <p className="stat-number">{adminTotals.alloys}</p>
              </div>
              <div className="stat-card">
                <h3>Патенты</h3>
                <p className="stat-number">{adminTotals.patents}</p>
              </div>
              <div className="stat-card">
                <h3>ML модели</h3>
                <p className="stat-number">{adminTotals.models}</p>
              </div>
            </div>
          </div>

          {/* ПЕРВЫЙ ГРИД: теперь "Пользователи по ролям" (вместо "Самые активные") */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="data-card">
              <h3>Пользователи по ролям</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Роль</th>
                    <th style={{ width: 140 }}>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {usersByRole.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                  {usersByRole.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-muted">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-card">
              <h3>Топ организаций по прогнозам</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Организация</th>
                    <th style={{ width: 140 }}>Прогнозов</th>
                  </tr>
                </thead>
                <tbody>
                  {orgsByPredictions.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                  {orgsByPredictions.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-muted">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ВТОРОЙ ГРИД: теперь "Самые активные пользователи" рядом с рейтингом элементов */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="data-card">
              <h3>Самые активные пользователи</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Организация</th>
                    <th>Роль</th>
                    <th style={{ width: 120 }}>Прогнозов</th>
                  </tr>
                </thead>
                <tbody>
                  {mostActiveUsers.map((u) => (
                    <tr key={u.personId}>
                      <td>
                        <button className="btn btn-link" type="button" onClick={() => navigate(`/users/${u.personId}`)}>
                          {u.login}
                        </button>
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          {u.name}
                        </div>
                      </td>
                      <td>{u.organization}</td>
                      <td>{u.role}</td>
                      <td>{u.count}</td>
                    </tr>
                  ))}
                  {mostActiveUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-muted">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-card">
              <h3>Рейтинг элементов по частоте</h3>
              <div className="text-muted" style={{ marginBottom: 8, fontSize: 12 }}>
                Посчитано по последним {elementStatsInfo.usedPredictions} прогнозам из {elementStatsInfo.totalPredictions}.
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Элемент</th>
                    <th style={{ width: 140 }}>Упоминаний</th>
                  </tr>
                </thead>
                <tbody>
                  {elementRanking.map((e) => (
                    <tr key={e.elementId}>
                      <td>
                        {e.name}{" "}
                        {e.symbol ? <span className="text-muted">({e.symbol})</span> : null}
                      </td>
                      <td>{e.count}</td>
                    </tr>
                  ))}
                  {elementRanking.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-muted">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div className="data-card">
              <h3>Прогнозы по категориям</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Категория</th>
                    <th style={{ width: 120 }}>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionsByCategory.slice(0, 8).map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                  {predictionsByCategory.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-muted">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-card">
              <h3>Прогнозы по прокатке</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Тип</th>
                    <th style={{ width: 120 }}>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionsByRolling.slice(0, 8).map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                  {predictionsByRolling.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-muted">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-card">
              <h3>Прогнозы по моделям</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Модель</th>
                    <th style={{ width: 120 }}>Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionsByModel.slice(0, 8).map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                  {predictionsByModel.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-muted">
                        Нет данных
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="data-card">
            <h3>Последние прогнозы</h3>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>ID</th>
                  <th>Категория</th>
                  <th style={{ width: 160 }}>Прокатка</th>
                  <th style={{ width: 220 }}>ML модель</th>
                  <th style={{ width: 120 }}>User ID</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {recentPredictions.map((p) => {
                  const mid = getField(p, ["ml_model_id", "mlmodelid", "mlmodel_id"]);
                  const modelName = modelIdToName.get(String(mid)) || (mid ? `model#${mid}` : "-");
                  const pid = getField(p, ["person_id", "personid"]);

                  return (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{getField(p, ["category"])}</td>
                      <td>{getField(p, ["rolling_type", "rollingtype"])}</td>
                      <td>{modelName}</td>
                      <td>{pid ?? "-"}</td>
                      <td className="actions">
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate(`/predictions/${p.id}`)}>
                          Открыть
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {recentPredictions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted">
                      Нет данных
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MY PREDICTIONS (для всех, включая admin) */}
      {tab === "my" && (
        <>
          <div className="data-card">
            <h3>Мои предсказания</h3>

            <div className="admin-toolbar" style={{ justifyContent: "flex-start" }}>

              <span className="text-muted">Всего: {myPredictionsSorted.length}</span>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Категория</th>
                  <th style={{ width: 160 }}>Прокатка</th>
                  <th style={{ width: 140 }}>Значение</th>
                  <th style={{ width: 220 }}>ML модель</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {myPredictionsSorted.slice(0, 30).map((p) => {
                  const mid = getField(p, ["ml_model_id", "mlmodelid", "mlmodel_id"]);
                  const modelName = modelIdToName.get(String(mid)) || (mid ? `model#${mid}` : "-");

                  return (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{getField(p, ["category"])}</td>
                      <td>{getField(p, ["rolling_type", "rollingtype"])}</td>
                      <td>{getField(p, ["prop_value", "propvalue"]) ?? "-"}</td>
                      <td>{modelName}</td>
                      <td className="actions">
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => navigate(`/predictions/${p.id}`)}>
                          Открыть
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {myPredictionsSorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted">
                      Пока нет предсказаний
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="text-muted" style={{ marginTop: 8 }}>
              Показаны последние 30 (по убыванию ID).
            </div>
          </div>

          <div className="data-card">
            <h3>Аналитика моих предсказаний</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <h4 style={{ marginBottom: 8 }}>По категориям</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Категория</th>
                      <th style={{ width: 120 }}>Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myByCategory.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                    {myByCategory.length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-muted">
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 style={{ marginBottom: 8 }}>По типу прокатки</h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th style={{ width: 120 }}>Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myByRolling.map((r) => (
                      <tr key={r.name}>
                        <td>{r.name}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                    {myByRolling.length === 0 && (
                      <tr>
                        <td colSpan={2} className="text-muted">
                          Нет данных
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
