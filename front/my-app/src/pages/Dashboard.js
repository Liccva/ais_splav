import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { alloyService, predictionService, patentService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";

const Dashboard = () => {
  const [stats, setStats] = useState({
    alloys: 0,
    predictions: 0,
    patents: 0,
    loading: true,
  });

  const [recentAlloys, setRecentAlloys] = useState([]);
  const [recentPredictions, setRecentPredictions] = useState([]);

  const { isAdmin, isResearcher, user } = useAuth();

  const myUserId = useMemo(() => user?.id, [user?.id]);

  const filterPredictionsByRole = (list) => {
    const arr = Array.isArray(list) ? list : [];

    // Исследователь видит только свои
    if (isResearcher && !isAdmin) {
      return arr.filter((p) => p?.person_id === myUserId);
    }

    // Админ (и прочие роли, если они вообще попадут на дашборд) — без фильтра
    return arr;
  };

  useEffect(() => {
    fetchStats();
    fetchRecentData();
    // чтобы при догрузке user/id пересчитать фильтр
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isResearcher, myUserId]);

  const fetchStats = async () => {
    try {
      const [alloysRes, predictionsRes, patentsRes] = await Promise.all([
        alloyService.getAll(),
        predictionService.getAll(),
        patentService.getAll(),
      ]);

      const predictionsFiltered = filterPredictionsByRole(predictionsRes.data);

      setStats({
        alloys: alloysRes.data?.length || 0,
        predictions: predictionsFiltered.length || 0,
        patents: patentsRes.data?.length || 0,
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  const fetchRecentData = async () => {
    try {
      const [alloysRes, predictionsRes] = await Promise.all([
        alloyService.getAll(),
        predictionService.getAll(),
      ]);

      const sortedAlloys = [...(alloysRes.data || [])]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);

      setRecentAlloys(sortedAlloys);

      const predictionsFiltered = filterPredictionsByRole(predictionsRes.data);

      const sortedPredictions = [...(predictionsFiltered || [])]
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);

      setRecentPredictions(sortedPredictions);
    } catch (error) {
      console.error("Error fetching recent data:", error);
    }
  };

  const refreshData = () => {
    setStats((prev) => ({ ...prev, loading: true }));
    fetchStats();
    fetchRecentData();
  };

  if (stats.loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Дашборд</h1>

      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-number">{stats.alloys}</div>
          <h3>Сплавы</h3>
          <Link className="stat-link" to="/alloys">
            Перейти к сплавам →
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-number">{stats.predictions}</div>
          <h3>Прогнозы</h3>
          <Link className="stat-link" to="/predictions">
            Перейти к прогнозам →
          </Link>
        </div>

        <div className="stat-card">
          <div className="stat-number">{stats.patents}</div>
          <h3>Патенты</h3>
          <Link className="stat-link" to="/patents">
            Перейти к патентам →
          </Link>
        </div>
      </div>

      <div className="dashboard-sections">
        {/* Быстрые действия */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2>Быстрые действия</h2>
          </div>

          <div className="quick-actions">
            <Link to="/alloys/new" className="btn btn-secondary">
              Добавить сплав
            </Link>

            <Link to="/predictions/new" className="btn btn-primary">
              Создать прогноз
            </Link>

            {/* Управление пользователями — только админ */}
            {isAdmin && (
              <Link to="/users" className="btn btn-outline">
                Управление пользователями
              </Link>
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Последние сплавы</h2>
            <Link className="view-all" to="/alloys">
              Все →
            </Link>
          </div>

          <div className="recent-items">
            {recentAlloys.length === 0 ? (
              <div className="info-message">
                <p>Нет данных</p>
              </div>
            ) : (
              recentAlloys.map((a) => (
                <div key={a.id} className="recent-item">
                  <Link className="item-title" to={`/alloys/${a.id}`}>
                    Сплав #{a.id}
                  </Link>
                  <div className="item-details">
                    <span className="category-badge">{a.category}</span>
                    <span className="item-value">{a.propvalue}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-header">
            <h2>Последние прогнозы</h2>
            <Link className="view-all" to="/predictions">
              Все →
            </Link>
          </div>

          <div className="recent-items">
            {recentPredictions.length === 0 ? (
              <div className="info-message">
                <p>{isResearcher && !isAdmin ? "У вас пока нет прогнозов" : "Нет данных"}</p>
              </div>
            ) : (
              recentPredictions.map((p) => (
                <div key={p.id} className="recent-item">
                  <Link className="item-title" to={`/predictions/${p.id}`}>
                    Прогноз #{p.id}
                  </Link>
                  <div className="item-details">
                    <span className="item-value">{p.prop_value ?? "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>




        {/* Любая инфа про пользователей — только админ */}
        {isAdmin && (
          <div className="dashboard-section">
            <div className="section-header">
              <h2>Администрирование</h2>

            </div>
            <div className="action-buttons">
    <Link to="/users" className="btn btn-outline">
      Пользователи
    </Link>

    <Link to="/admin" className="btn btn-outline">
      Админ-панель
    </Link>
  </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
