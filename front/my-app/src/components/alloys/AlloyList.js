// AlloyList.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { alloyService, patentService, elementService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../common/LoadingSpinner";

const fmt3 = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(3);
};

const AlloyList = () => {
  const [alloys, setAlloys] = useState([]);
  const [patents, setPatents] = useState({});
  const [elements, setElements] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [alloysRes, patentsRes, elementsRes] = await Promise.all([
        alloyService.getAll(),
        patentService.getAll(),
        elementService.getAll(),
      ]);

      setAlloys(alloysRes.data || []);

      const patentMap = {};
      (patentsRes.data || []).forEach((p) => {
        patentMap[p.id] = p;
      });
      setPatents(patentMap);

      const elementMap = {};
      (elementsRes.data || []).forEach((el) => {
        elementMap[el.id] = el;
      });
      setElements(elementMap);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка загрузки");
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот сплав?")) return;

    try {
      await alloyService.delete(id);
      setAlloys(alloys.filter((alloy) => alloy.id !== id));
      alert("Сплав успешно удалён!");
    } catch (err) {
      alert(err.response?.data?.detail || "Ошибка удаления сплава");
      console.error("Delete error:", err);
    }
  };

  const handleEdit = (alloy) => navigate(`/alloys/edit/${alloy.id}`);
  const handleView = (alloy) => navigate(`/alloys/${alloy.id}`);

  const filteredAlloys = alloys.filter((alloy) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      searchTerm === "" ||
      (alloy.category && alloy.category.toLowerCase().includes(term)) ||
      (alloy.rolling_type && alloy.rolling_type.toLowerCase().includes(term)) ||
      String(alloy.prop_value).includes(searchTerm);

    const matchesCategory =
      filterCategory === "" || (alloy.category && alloy.category === filterCategory);

    return matchesSearch && matchesCategory;
  });

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="alloy-list-container">
        <div className="error-message">{error}</div>
        <button className="btn btn-primary" onClick={fetchData}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="alloy-list-container">
      <div className="page-header">
        <h2>Сплавы</h2>
        <button className="btn btn-primary" onClick={() => navigate("/alloys/new")}>
          Добавить
        </button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск (категория/прокатка/prop_value)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control"
          />
        </div>

        <div className="filter-box">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="form-control"
          >
            <option value="">Все категории</option>
            {/* если у тебя есть фиксированный список категорий — можно подставить сюда */}
            {Array.from(new Set(alloys.map((a) => a.category).filter(Boolean))).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredAlloys.length === 0 ? (
        <div className="empty-message">
          <p>Сплавы не найдены</p>
        </div>
      ) : (
        <div className="alloy-grid">
          {filteredAlloys.map((alloy) => {
            const patent = patents[alloy.patent_id];
            return (
              <div key={alloy.id} className="alloy-card">
                <div className="alloy-header">
                  <h3>ID: {alloy.id}</h3>
                </div>

                <div className="alloy-body">
                  <p>
                    <strong>Свойство:</strong> {fmt3(alloy.prop_value)}
                  </p>
                  <p>
                    <strong>Категория:</strong> {alloy.category}
                  </p>
                  <p>
                    <strong>Тип прокатки:</strong> {alloy.rolling_type}
                  </p>

                  {patent ? (
                    <p>
                      <strong>Патент:</strong>{" "}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          isAdmin ? navigate(`/patents/edit/${patent.id}`) : navigate(`/patents/${patent.id}`)
                        }
                        title={patent.patent_name || patent.patentname || ""}
                      >
                        {patent.id} — {patent.patent_name || patent.patentname || "Без названия"}
                      </button>
                    </p>
                  ) : (
                    <p>
                      <strong>Патент:</strong> <span className="text-muted">Не указан</span>
                    </p>
                  )}
                </div>

                <div className="alloy-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleView(alloy)}>
                    Открыть
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleEdit(alloy)}>
                    Редактировать
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(alloy.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="summary-info">
        <p>
          Всего сплавов: <strong>{alloys.length}</strong>
        </p>
        <p>
          Найдено: <strong>{filteredAlloys.length}</strong>
        </p>
      </div>
    </div>
  );
};

export default AlloyList;
