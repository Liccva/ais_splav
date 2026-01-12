import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { predictionService, modelService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const MyProfilePage = () => {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState([]);
  const [models, setModels] = useState({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPredictions: 0,
    averageValue: 0,
    lastPredictionDate: null
  });

  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const [predictionsRes, modelsRes] = await Promise.all([
        predictionService.getByPerson(user.id),
        modelService.getAll()
      ]);

      const predictionsData = predictionsRes.data || [];
      setPredictions(predictionsData);

      // Создаем карту моделей
      const modelsMap = {};
      (modelsRes.data || []).forEach(m => {
        modelsMap[m.id] = m;
      });
      setModels(modelsMap);

      // Рассчитываем статистику
      if (predictionsData.length > 0) {
        const total = predictionsData.length;
        const sum = predictionsData.reduce((acc, p) => acc + (p.prop_value || 0), 0);
        const average = total > 0 ? sum / total : 0;
        const lastPrediction = predictionsData.reduce((latest, p) =>
          (!latest || new Date(p.created_at) > new Date(latest.created_at)) ? p : latest, null
        );

        setStats({
          totalPredictions: total,
          averageValue: parseFloat(average.toFixed(2)),
          lastPredictionDate: lastPrediction?.created_at
        });
      }
    } catch (error) {
      console.error('Error fetching user predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      'admin': 'Администратор',
      'researcher': 'Исследователь',
      'user': 'Пользователь',
      'guest': 'Гость'
    };
    return roleNames[role] || role;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Нет данных';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Получить название модели по ID
  const getModelName = (modelId) => {
    if (!modelId) return "Не выбрана";
    const model = models[modelId];
    return model ? model.name : `Модель #${modelId}`;
  };

  // Получаем полное имя пользователя
  const getUserFullName = () => {
    const firstName = user.first_name || user.firstName || '';
    const lastName = user.last_name || user.lastName || '';
    const login = user.login || '';

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else {
      return login || 'Пользователь';
    }
  };

  // Получаем инициалы для аватара
  const getUserInitials = () => {
    const firstChar = (user.first_name?.charAt(0) || user.firstName?.charAt(0) || user.login?.charAt(0) || 'U').toUpperCase();
    const secondChar = (user.last_name?.charAt(0) || user.lastName?.charAt(0) || '').toUpperCase();

    if (secondChar) {
      return `${firstChar}${secondChar}`;
    }
    return firstChar;
  };

  if (!user) {
    return (
      <div className="access-denied">
        <h2>Требуется авторизация</h2>
        <p>Для просмотра профиля необходимо войти в систему</p>
        <Link to="/login" className="btn btn-primary">
          Войти
        </Link>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>Мой профиль</h1>
        <div className="action-buttons">
          <Link to="/profile/edit" className="btn btn-primary">
            <span className="btn-icon"></span>
            Редактировать профиль
          </Link>
          <Link to="/predictions/new" className="btn btn-secondary">

            Создать прогноз
          </Link>
        </div>
      </div>

      <div className="profile-section">
        <div className="profile-card">
          <div className="profile-header">
            <div className="avatar">
              {getUserInitials()}
            </div>
            <div className="profile-info">
              <h2>{getUserFullName()}</h2>
              <p className="profile-role">
                <span className="role-badge">
                  {getRoleDisplayName(user.role)}
                </span>
                <span className="user-id">ID: #{user.id}</span>
              </p>
            </div>
          </div>

          <div className="profile-details">
            <div className="detail-item">
              <span className="detail-label">Логин:</span>
              <span className="detail-value">{user.login}</span>
            </div>

            {(user.first_name || user.firstName) && (
              <div className="detail-item">
                <span className="detail-label">Имя:</span>
                <span className="detail-value">{user.first_name || user.firstName}</span>
              </div>
            )}

            {(user.last_name || user.lastName) && (
              <div className="detail-item">
                <span className="detail-label">Фамилия:</span>
                <span className="detail-value">{user.last_name || user.lastName}</span>
              </div>
            )}

            {user.organization && (
              <div className="detail-item">
                <span className="detail-label">Организация:</span>
                <span className="detail-value">{user.organization}</span>
              </div>
            )}
          </div>

          <div className="profile-stats">
            <h3>Статистика активности</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Всего прогнозов</span>
                <span className="stat-number">{stats.totalPredictions}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Среднее значение</span>
                <span className="stat-number">{stats.averageValue} МПа</span>
              </div>
            </div>
          </div>
        </div>

        <div className="user-predictions">
          <div className="section-header">
            <h2>Мои прогнозы</h2>
            <div className="section-header-actions">
              <span className="count-badge">{predictions.length}</span>
              <Link to="/predictions" className="btn btn-outline btn-sm">
                Все прогнозы →
              </Link>
            </div>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : predictions.length > 0 ? (
            <>
              <div className="predictions-list">
                <div className="table-container">
                  <table className="table data-table">
                    <thead>
                      <tr className="table-header-dark">
                        <th>ID</th>
                        <th>Категория</th>
                        <th>Предел прочности</th>
                        <th>Тип прокатки</th>
                        <th>ML модель</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.slice(0, 10).map(prediction => (
                        <tr key={prediction.id}>
                          <td>
                            <Link to={`/predictions/${prediction.id}`} className="prediction-link">
                              #{prediction.id}
                            </Link>
                          </td>
                          <td>
                            <span className="category-badge">{prediction.category}</span>
                          </td>
                          <td>
                            <strong>{prediction.prop_value}</strong> МПа
                          </td>
                          <td>{prediction.rolling_type}</td>
                          <td>
                            {getModelName(prediction.ml_model_id)}
                          </td>
                          <td>
                            <div className="action-buttons">

                              <Link
                                to={`/predictions/edit/${prediction.id}`}
                                className="btn btn-sm btn-outline"
                              >
                                Редактировать
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {predictions.length > 10 && (
                <div className="view-all-container">
                  <Link to="/predictions" className="view-all-link">
                    Показать все {predictions.length} прогнозов →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <h3>У вас пока нет созданных прогнозов</h3>
              <p>Начните использовать систему, создав свой первый прогноз</p>
              <div className="empty-state-actions">
                <Link to="/predictions/new" className="btn btn-primary">
                  Создать первый прогноз
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyProfilePage;