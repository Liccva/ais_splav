import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { personService, roleService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const UsersListPage = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await personService.getAll();
      const usersData = response.data || [];

      // Получаем роли для всех пользователей
      const usersWithRoles = await Promise.all(
        usersData.map(async (user) => {
          let roleName = 'Неизвестно';
          if (user.role_id) {
            try {
              const roleRes = await roleService.getById(user.role_id);
              roleName = roleRes.data?.name || 'Неизвестно';
            } catch (roleErr) {
              console.warn('Error fetching role for user:', user.id, roleErr);
            }
          }
          return {
            ...user,
            roleName
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Не удалось загрузить данные пользователей');
    } finally {
      setLoading(false);
    }
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

  const getDisplayName = (user) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    } else if (user.first_name) {
      return user.first_name;
    } else {
      return user.login;
    }
  };

  const filteredUsers = searchTerm
    ? users.filter(u =>
        u.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.first_name && u.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.last_name && u.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        u.roleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.organization && u.organization.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : users;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Пользователи системы</h1>
        {/* Кнопка добавления пользователя только для админа */}
        {isAdmin && (
          <Link to="/register" className="btn btn-primary">
            Добавить пользователя
          </Link>
        )}
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Поиск пользователей */}
      <div className="users-search">
        <div className="search-box">
          <input
            type="text"
            placeholder="Поиск пользователей..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <button className="btn btn-outline" onClick={() => setSearchTerm('')}>
            Очистить поиск
          </button>
        )}
      </div>

      <div className="table-container">
        <div className="table-info">
          <p>
            Всего пользователей: <strong>{filteredUsers.length}</strong>
            {searchTerm && ` (найдено по "${searchTerm}")`}
            {isAdmin && (
              <span className="admin-info">
                <span className="admin-badge">⚡ Админ-режим</span>
              </span>
            )}
          </p>
        </div>

        {filteredUsers.length > 0 ? (
          <div className="users-grid">
            {filteredUsers.map(userItem => (
              <div key={userItem.id} className="user-card">
                <div className="user-card-header">
                  <div className="user-avatar-small">
                    {userItem.first_name?.charAt(0) || userItem.login?.charAt(0)}
                  </div>
                  <div className="user-info">
                    <h3>
                      <Link to={`/users/${userItem.id}`} className="user-link">
                        {getDisplayName(userItem)}
                        {currentUser?.id === userItem.id && (
                          <span className="you-badge"> (Вы)</span>
                        )}
                      </Link>
                    </h3>
                    <p className="user-login">@{userItem.login}</p>
                    <span className={`badge ${getRoleBadgeClass(userItem.roleName)}`}>
                      {userItem.roleName}
                    </span>
                  </div>
                </div>

                <div className="user-card-details">
                  {userItem.organization && (
                    <div className="user-detail">
                      <span className="detail-label">Организация:</span>
                      <span className="detail-value">{userItem.organization}</span>
                    </div>
                  )}
                  <div className="user-detail">
                    <span className="detail-label">ID:</span>
                    <span className="detail-value">#{userItem.id}</span>
                  </div>

                </div>

                <div className="user-card-actions">
                  <Link
                    to={`/users/${userItem.id}`}
                    className="btn btn-outline btn-sm"
                  >
                    Просмотр профиля
                  </Link>

                  {/* Кнопки управления только для админа */}
                  {isAdmin && (
                    <>
                      <Link
                        to={`/users/${userItem.id}/edit`}
                        className="btn btn-outline btn-sm"
                      >
                        Редактировать
                      </Link>

                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Пользователи не найдены</h3>
            <p>
              {searchTerm
                ? 'Попробуйте изменить параметры поиска'
                : 'В системе еще нет зарегистрированных пользователей'}
            </p>
            {isAdmin && !searchTerm && (
              <Link to="/register" className="btn btn-primary">
                Добавить первого пользователя
              </Link>
            )}
            {searchTerm && (
              <button className="btn btn-primary" onClick={() => setSearchTerm('')}>
                Сбросить поиск
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersListPage;