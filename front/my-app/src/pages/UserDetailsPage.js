import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { personService, roleService, predictionService, modelService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const UserDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isAdmin } = useAuth();
  const [user, setUser] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [models, setModels] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalPredictions: 0,
    averageValue: 0,
    lastPredictionDate: null
  });

  // Проверяем, является ли текущий пользователь владельцем профиля
  const isOwner = currentUser?.id === parseInt(id);

  useEffect(() => {
    fetchUserData();
  }, [id]);

  const fetchUserData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Загружаем данные пользователя
      const userRes = await personService.getById(id);

      if (!userRes.data) {
        throw new Error('Пользователь не найден');
      }

      // Получаем информацию о роли
      let roleName = 'Неизвестно';
      if (userRes.data && userRes.data.role_id) {
        try {
          const roleRes = await roleService.getById(userRes.data.role_id);
          roleName = roleRes.data?.name || 'Неизвестно';
        } catch (roleErr) {
          console.warn('Error fetching role:', roleErr);
        }
      }

      setUser({
        ...userRes.data,
        roleName
      });

      // Загружаем модели
      try {
        const modelsRes = await modelService.getAll();
        const modelsMap = {};
        (modelsRes.data || []).forEach(m => {
          modelsMap[m.id] = m;
        });
        setModels(modelsMap);
      } catch (modelsErr) {
        console.warn('Error fetching models:', modelsErr);
      }

      // Пытаемся загрузить прогнозы пользователя
      let predictionsData = [];
      try {
        const predictionsRes = await predictionService.getByPerson(id);
        predictionsData = predictionsRes.data || [];
      } catch (predErr) {
        // Если ошибка 404 - у пользователя нет прогнозов, это нормально
        if (predErr.response?.status !== 404) {
          console.warn('Error fetching predictions:', predErr);
        }
        // В случае 404 просто оставляем пустой массив
      }

      setPredictions(predictionsData);

      // Рассчитываем статистику только если есть прогнозы
      if (predictionsData.length > 0) {
        const total = predictionsData.length;
        const sum = predictionsData.reduce((acc, p) => acc + (p.prop_value || 0), 0);
        const average = total > 0 ? sum / total : 0;

        setStats({
          totalPredictions: total,
          averageValue: parseFloat(average.toFixed(2)),
          lastPredictionDate: null // не отображаем даты
        });
      }

    } catch (err) {
      console.error('Error fetching user data:', err);

      // Более информативное сообщение об ошибке
      if (err.response?.status === 404) {
        setError('Пользователь не найден. Возможно, он был удален или вы ввели неверный ID.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Не удалось загрузить данные пользователя');
      }
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
    return roleNames[role] || role || 'Неизвестно';
  };

  // Получить название модели по ID
  const getModelName = (modelId) => {
    if (!modelId) return "Не выбрана";
    const model = models[modelId];
    return model ? model.name : `Модель #${modelId}`;
  };

  // Получаем полное имя пользователя (как в MyProfilePage)
  const getUserFullName = () => {
    if (!user) return '';
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

  // Получаем инициалы для аватара (как в MyProfilePage)
  const getUserInitials = () => {
    if (!user) return 'U';
    const firstChar = (user.first_name?.charAt(0) || user.firstName?.charAt(0) || user.login?.charAt(0) || 'U').toUpperCase();
    const secondChar = (user.last_name?.charAt(0) || user.lastName?.charAt(0) || '').toUpperCase();

    if (secondChar) {
      return `${firstChar}${secondChar}`;
    }
    return firstChar;
  };

  const getRoleBadgeClass = (roleName) => {
    if (!roleName) return 'badge-outline';
    switch(roleName.toLowerCase()) {
      case 'admin': return 'badge-danger';
      case 'researcher': return 'badge-primary';
      case 'user': return 'badge-secondary';
      case 'guest': return 'badge-outline';
      default: return 'badge-outline';
    }
  };

  const handleEditProfile = () => {
    // Если это профиль текущего пользователя - редактировать свой профиль
    if (isOwner) {
      navigate('/profile/edit');
    }
    // Если админ редактирует чужой профиль
    else if (isAdmin) {
      navigate(`/users/${id}/edit`);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="error-message">{error}</div>;
  if (!user) return <div className="not-found">Пользователь не найден</div>;

  return (
    <div className="user-details-page">
      <div className="page-header">
        <h1>Профиль пользователя</h1>
        <div className="action-buttons">
          <Link to="/users" className="btn btn-outline">
            ← Назад к списку
          </Link>

          {/* Показываем кнопку редактирования если это профиль текущего пользователя или админ */}
          {(isAdmin || isOwner) && (
            <button
              onClick={handleEditProfile}
              className="btn btn-primary"
            >
              Редактировать профиль
            </button>
          )}
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
                <span className={`badge ${getRoleBadgeClass(user.roleName)}`}>
                  {getRoleDisplayName(user.roleName)}
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

          {/* Показываем статистику только если есть прогнозы */}
          {(isAdmin || isOwner) && predictions.length > 0 && (
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
          )}
        </div>

        {/* Секция прогнозов - показываем только если это профиль текущего пользователя или админ */}
        {(isAdmin || isOwner) && (
          <div className="user-predictions">
            <div className="section-header">
              <h2>Прогнозы пользователя</h2>
              <div className="section-header-actions">
                <span className="count-badge">{predictions.length}</span>
                <Link to={`/predictions?user=${user.id}`} className="btn btn-outline btn-sm">
                  Все прогнозы →
                </Link>
              </div>
            </div>

            {predictions.length > 0 ? (
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
                              <span className="category-badge">
                                {prediction.category}
                              </span>
                            </td>
                            <td>
                              <span className="value-display">
                                {prediction.prop_value} МПа
                              </span>
                            </td>
                            <td>{prediction.rolling_type}</td>
                            <td>
                              {getModelName(prediction.ml_model_id)}
                            </td>
                            <td>
                              <div className="action-buttons">
                                <Link
                                  to={`/predictions/${prediction.id}`}
                                  className="btn btn-sm btn-outline"
                                >
                                  👁️ Просмотр
                                </Link>
                                {isAdmin && (
                                  <Link
                                    to={`/predictions/edit/${prediction.id}`}
                                    className="btn btn-sm btn-outline"
                                  >
                                    ✏️ Редактировать
                                  </Link>
                                )}
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
                    <Link to={`/predictions?user=${user.id}`} className="view-all-link">
                      Показать все {predictions.length} прогнозов →
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <h3>У пользователя пока нет созданных прогнозов</h3>
                <p>Пользователь еще не создавал прогнозы в системе</p>
              </div>
            )}
          </div>
        )}

        {/* Если не админ и не владелец - показываем ограниченную информацию */}
        {!(isAdmin || isOwner) && (
          <div className="restricted-info">
            <p>Для просмотра полной информации и прогнозов пользователя необходимо быть администратором</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailsPage;