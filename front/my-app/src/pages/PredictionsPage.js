import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { predictionService, personService, modelService } from "../services/api";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useAuth } from "../context/AuthContext";

const PredictionsPage = () => {
  const [predictions, setPredictions] = useState([]);
  const [filteredPredictions, setFilteredPredictions] = useState([]);
  const [users, setUsers] = useState({}); // id -> user
  const [models, setModels] = useState({}); // id -> model
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterUser, setFilterUser] = useState("all");

  const { isAdmin, isResearcher, user } = useAuth();

  // Проверяем доступ пользователя к странице
  const hasAccess = isAdmin || isResearcher;

  const fetchPredictions = async () => {
    // Если пользователь не авторизован или гость - не загружаем данные
    if (!hasAccess && !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [predictionsRes, usersRes, modelsRes] = await Promise.all([
        predictionService.getAll(),
        personService.getAll(),
        modelService.getAll()
      ]);

      const predictionsData = predictionsRes.data || [];
      setPredictions(predictionsData);
      setFilteredPredictions(predictionsData);

      // Создаем карту пользователей
      const usersMap = {};
      (usersRes.data || []).forEach(u => {
        usersMap[u.id] = u;
      });
      setUsers(usersMap);

      // Создаем карту моделей
      const modelsMap = {};
      (modelsRes.data || []).forEach(m => {
        modelsMap[m.id] = m;
      });
      setModels(modelsMap);

    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Ошибка загрузки прогнозов");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  useEffect(() => {
    filterPredictions();
  }, [searchTerm, filterCategory, filterUser, predictions]);

  const filterPredictions = () => {
    let filtered = [...predictions];

    // Если гость или неавторизованный пользователь - не показываем прогнозы
    if (!user) {
      filtered = [];
    }
    // Если исследователь - показываем только его прогнозы
    else if (isResearcher && !isAdmin) {
      filtered = filtered.filter(p => p.person_id === user?.id);
    }
    // Если обычный пользователь (не исследователь и не админ) - не показываем прогнозы
    else if (!isAdmin && !isResearcher) {
      filtered = [];
    }

    // Поиск по тексту
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(prediction =>
        prediction.category.toLowerCase().includes(term) ||
        prediction.rolling_type.toLowerCase().includes(term) ||
        prediction.property_name?.toLowerCase().includes(term) ||
        prediction.prop_value.toString().includes(term) ||
        prediction.id.toString().includes(term) ||
        prediction.ml_model_id?.toString().includes(term)
      );
    }

    // Фильтр по категории
    if (filterCategory !== "all") {
      filtered = filtered.filter(prediction => prediction.category === filterCategory);
    }

    // Фильтр по пользователю (только для админа)
    if (filterUser !== "all" && isAdmin) {
      filtered = filtered.filter(prediction => prediction.person_id === parseInt(filterUser));
    }

    setFilteredPredictions(filtered);
  };

  const canEditPrediction = (prediction) => {
    // Админ может редактировать все прогнозы
    if (isAdmin) return true;
    // Исследователь может редактировать только свои прогнозы
    if (isResearcher && prediction.person_id === user?.id) return true;
    return false;
  };

  const canDeletePrediction = (prediction) => {
    // Админ может удалять все прогнозы
    if (isAdmin) return true;
    // Исследователь может удалять только свои прогнозы
    if (isResearcher && prediction.person_id === user?.id) return true;
    return false;
  };

  const canViewPrediction = (prediction) => {
    // Админ может просматривать все прогнозы
    if (isAdmin) return true;
    // Исследователь может просматривать только свои прогнозы
    if (isResearcher && prediction.person_id === user?.id) return true;
    return false;
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Удалить прогноз?")) return;
    try {
      await predictionService.delete(id);
      setPredictions((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e.response?.data?.detail || e.message || "Ошибка удаления");
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryFilterChange = (e) => {
    setFilterCategory(e.target.value);
  };

  const handleUserFilterChange = (e) => {
    setFilterUser(e.target.value);
  };

  const getCategories = () => {
    const categories = new Set(predictions.map(p => p.category));
    return Array.from(categories).sort();
  };

  const getUserOptions = () => {
    const userIds = new Set(predictions.map(p => p.person_id).filter(id => id));
    const userOptions = Array.from(userIds)
      .map(id => ({
        id,
        login: users[id]?.login || `Пользователь #${id}`
      }))
      .sort((a, b) => a.login.localeCompare(b.login));

    return userOptions;
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategory("all");
    setFilterUser("all");
  };

  // Получить название модели по ID
  const getModelName = (modelId) => {
    if (!modelId) return "Не выбрана";
    const model = models[modelId];
    return model ? model.name : `Модель #${modelId}`;
  };

  if (loading) return <LoadingSpinner />;

  // Если пользователь гость или обычный пользователь без прав
  if (!hasAccess && !user) {
    return (
      <div className="predictions-page">
        <div className="page-header">
          <h2>Прогнозы</h2>
        </div>
        <div className="empty-state">
          <h3>Доступ запрещен</h3>
          <p>У вас нет прав для просмотра прогнозов.</p>
          {!user ? (
            <Link to="/login" className="btn btn-primary mt-2">
              Войти в систему
            </Link>
          ) : (
            <p className="text-muted">Обратитесь к администратору для получения прав исследователя.</p>
          )}
        </div>
      </div>
    );
  }

  // Если у пользователя есть доступ, но нет прогнозов
  if (!loading && predictions.length === 0 && hasAccess) {
    return (
      <div className="predictions-page">
        <div className="page-header">
          <h2>Прогнозы</h2>
          {(isAdmin || isResearcher) && (
            <Link to="/predictions/new" className="btn btn-primary">
              Создать прогноз
            </Link>
          )}
        </div>
        <div className="empty-state">
          <h3>Прогнозов нет</h3>
          <p>В системе пока нет ни одного прогноза</p>
          {(isAdmin || isResearcher) && (
            <Link to="/predictions/new" className="btn btn-primary mt-2">
              Создать первый прогноз
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="predictions-page">
      <div className="page-header">
        <h2>Прогнозы</h2>
        {(isAdmin || isResearcher) && (
          <Link to="/predictions/new" className="btn btn-primary">
            Создать прогноз
          </Link>
        )}
      </div>

      {/* Панель поиска и фильтров */}
      <div className="predictions-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск по прогнозам..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        <div className="filter-select">
          <select value={filterCategory} onChange={handleCategoryFilterChange}>
            <option value="all">Все категории</option>
            {getCategories().map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {isAdmin && (
          <div className="filter-select">
            <select value={filterUser} onChange={handleUserFilterChange}>
              <option value="all">Все пользователи</option>
              {getUserOptions().map(userOption => (
                <option key={userOption.id} value={userOption.id}>
                  {userOption.login}
                </option>
              ))}
            </select>
          </div>
        )}

        {(searchTerm || filterCategory !== "all" || (isAdmin && filterUser !== "all")) && (
          <button className="btn btn-outline" onClick={clearFilters}>
            Сбросить фильтры
          </button>
        )}
      </div>

      {error ? (
        <div className="error-message">{error}</div>
      ) : predictions.length === 0 ? (
        <div className="empty-state">
          <h3>Прогнозов нет</h3>
          <p>В системе пока нет ни одного прогноза</p>
          {(isAdmin || isResearcher) && (
            <Link to="/predictions/new" className="btn btn-primary mt-2">
              Создать первый прогноз
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="table-info">
            <p>
              Найдено прогнозов: <strong>{filteredPredictions.length}</strong> из {predictions.length}
              {(searchTerm || filterCategory !== "all" || (isAdmin && filterUser !== "all")) && (
                <span className="text-muted ml-2">
                  {searchTerm && ` (поиск: "${searchTerm}")`}
                  {filterCategory !== "all" && ` (категория: ${filterCategory})`}
                  {isAdmin && filterUser !== "all" && ` (пользователь: ${getUserOptions().find(u => u.id === parseInt(filterUser))?.login})`}
                </span>
              )}
            </p>
          </div>

          {filteredPredictions.length === 0 ? (
            <div className="empty-state">
              <h3>Прогнозы не найдены</h3>
              <p>Попробуйте изменить параметры поиска</p>
              <button className="btn btn-primary mt-2" onClick={clearFilters}>
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="table data-table">
                <thead>
                  <tr className="table-header-dark">
                    <th>№ (ID)</th>
                    <th>Категория</th>
                    <th>Предел прочности</th>
                    <th>Тип прокатки</th>
                    <th>ML модель</th>
                    <th>Создатель</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPredictions.map((p) => {
                    const creator = p.person_id ? users[p.person_id] : null;
                    const creatorName = creator
                      ? creator.login || `Пользователь #${p.person_id}`
                      : "Неизвестно";

                    const canView = canViewPrediction(p);
                    const canEdit = canEditPrediction(p);
                    const canDelete = canDeletePrediction(p);

                    return (
                      <tr key={p.id}>
                        <td>
                          {canView ? (
                            <Link to={`/predictions/${p.id}`} className="prediction-link">
                              #{p.id}
                            </Link>
                          ) : (
                            <span className="text-muted">#{p.id}</span>
                          )}
                        </td>
                        <td>
                          <span className="category-badge">{p.category}</span>
                        </td>
                        <td>
                          <strong>{p.prop_value}</strong> МПа
                        </td>
                        <td>{p.rolling_type}</td>
                        <td>
                          {getModelName(p.ml_model_id)}
                        </td>
                        <td>
                          {p.person_id ? (
                            isAdmin ? (
                              <Link to={`/users/${p.person_id}`} className="user-link">
                                {creatorName}
                              </Link>
                            ) : (
                              <span>{creatorName}</span>
                            )
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            {canView && (
                              <Link to={`/predictions/${p.id}`} className="btn btn-secondary btn-sm">
                                Просмотр
                              </Link>
                            )}
                            {canEdit && (
                              <Link to={`/predictions/edit/${p.id}`} className="btn btn-outline btn-sm">
                                Изменить
                              </Link>
                            )}
                            {canDelete && (
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                                Удалить
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PredictionsPage;