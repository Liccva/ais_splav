import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { personService, roleService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const UserEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [roles, setRoles] = useState([]);

  // Состояние для хранения текущего пароля
  const [currentPassword, setCurrentPassword] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    login: '',
    organization: '',
    password: '', // Поле для нового пароля
    confirm_password: '',
    role_id: '',
    is_active: true,
  });

  useEffect(() => {
    fetchUserData();
    fetchRoles();
  }, [id]);

  const fetchUserData = async () => {
    try {
      const response = await personService.getById(id);
      const userData = response.data;

      setForm({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        login: userData.login || '',
        organization: userData.organization || '',
        password: '', // Не загружаем текущий пароль (он должен быть скрыт)
        confirm_password: '',
        role_id: userData.role_id?.toString() || '',
        is_active: userData.is_active !== false,
      });

      // Попробуем получить текущий пароль отдельно
      try {
        // Если есть API для получения пароля (например, только для админа)
        const passwordResponse = await personService.getPasswordByLogin?.(userData.login);
        if (passwordResponse?.data) {
          setCurrentPassword(passwordResponse.data);
        }
      } catch (err) {
        console.log('Не удалось получить текущий пароль, пользователь должен будет ввести его');
      }
    } catch (err) {
      setError('Не удалось загрузить данные пользователя');
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await roleService.getAll();
      setRoles(response.data || []);
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    const errors = {};

    // Обязательные поля
    if (!form.first_name.trim()) errors.first_name = 'Имя обязательно';
    if (!form.last_name.trim()) errors.last_name = 'Фамилия обязательна';
    if (!form.login.trim()) errors.login = 'Логин обязателен';
    if (!form.role_id) errors.role_id = 'Роль обязательна';

    // Проверка пароля только если он введен
    if (form.password.trim() !== '') {
      if (form.password.length < 6) {
        errors.password = 'Пароль должен быть не менее 6 символов';
      }
      if (form.password !== form.confirm_password) {
        errors.confirm_password = 'Пароли не совпадают';
      }
    }

    // Если есть ошибки, показываем их
    if (Object.keys(errors).length > 0) {
      // Можно отображать отдельные ошибки полей
      setError('Пожалуйста, исправьте ошибки в форме');
      return false;
    }

    return true;
  };

  const getPasswordForUpdate = async () => {
    // Если введен новый пароль - используем его
    if (form.password.trim() !== '') {
      return form.password.trim();
    }

    // Если не введен новый пароль, но у нас есть текущий - используем его
    if (currentPassword) {
      return currentPassword;
    }

    // Если нет ни нового, ни текущего пароля - запрашиваем у пользователя
    const passwordFromUser = prompt(
      'Для обновления профиля требуется пароль. Введите текущий пароль пользователя:'
    );

    if (!passwordFromUser) {
      throw new Error('Пароль обязателен для обновления профиля');
    }

    // Сохраняем введенный пароль для будущих обновлений
    setCurrentPassword(passwordFromUser);
    return passwordFromUser;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setSaving(true);

    try {
      // Получаем пароль для обновления
      const passwordToSend = await getPasswordForUpdate();

      // Подготавливаем данные для отправки
      const dataToSend = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        login: form.login.trim(),
        organization: form.organization.trim() || '',
        role_id: parseInt(form.role_id),
        password: passwordToSend, // Всегда отправляем пароль
      };

      console.log('Отправляемые данные (пароль скрыт):', {
        ...dataToSend,
        password: '***'
      });

      // Отправляем обновленные данные через API
      await personService.update(id, dataToSend);

      setSuccess('Данные пользователя успешно обновлены');

      // Возвращаемся на страницу пользователя через 2 секунды
      setTimeout(() => {
        navigate(`/users/${id}`);
      }, 2000);

    } catch (err) {
      console.error('Error updating user:', err);

      if (err.message && err.message.includes('Пароль обязателен')) {
        setError(err.message);
      } else {
        const errorDetail = err.response?.data?.detail;

        if (typeof errorDetail === 'string') {
          if (errorDetail.includes('уже существует') || errorDetail.includes('already exists')) {
            setError('Пользователь с таким логином уже существует');
          } else {
            setError(errorDetail);
          }
        } else {
          setError('Ошибка обновления данных пользователя');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.')) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      // Используем personService.delete(id) который вызывает ручку DELETE /persons/{person_id}
      await personService.delete(id);
      alert('Пользователь успешно удален');
      navigate('/users');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Неизвестная ошибка';
      setError('Ошибка удаления пользователя: ' + errorMsg);
      console.error('Error deleting user:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!isAdmin) {
    return (
      <div className="access-denied">
        <h2>Доступ запрещен</h2>
        <p>Только администраторы могут редактировать пользователей</p>
      </div>
    );
  }

  return (
    <div className="user-edit-page">
      <div className="page-header">
        <h1>Редактирование пользователя #{id}</h1>
        <div className="action-buttons">
          <button onClick={() => navigate(`/users/${id}`)} className="btn btn-outline">
            ← Назад к профилю
          </button>
          <button
            onClick={handleDeleteUser}
            className="btn btn-danger"
            disabled={deleting}
          >
            {deleting ? (
              <>
                <span className="spinner"></span>
                Удаление...
              </>
            ) : '🗑️ Удалить пользователя'}
          </button>
        </div>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Основная информация</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">Имя *</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Имя пользователя"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="last_name">Фамилия *</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Фамилия пользователя"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="login">Логин *</label>
                <input
                  type="text"
                  id="login"
                  name="login"
                  value={form.login}
                  onChange={handleChange}
                  placeholder="Уникальный логин"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="organization">Организация</label>
                <input
                  type="text"
                  id="organization"
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="Название организации"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Безопасность и пароль</h3>

            <div className="form-group">
              <label htmlFor="password">
                {currentPassword ? 'Новый пароль' : 'Пароль *'}
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder={currentPassword ? "Введите новый пароль (оставьте пустым, чтобы не менять)" : "Введите пароль"}
              />
              <small className="form-hint">
                {currentPassword
                  ? "Минимум 6 символов. Оставьте пустым, чтобы не менять пароль"
                  : "Пароль обязателен для обновления профиля. Минимум 6 символов"}
              </small>
            </div>

            {form.password.trim() !== '' && (
              <div className="form-group">
                <label htmlFor="confirm_password">Подтверждение нового пароля *</label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="Подтвердите новый пароль"
                  required={form.password.trim() !== ''}
                />
                {form.password !== form.confirm_password && form.confirm_password && (
                  <span className="field-error" style={{color: 'red', fontSize: '0.85em'}}>
                    Пароли не совпадают
                  </span>
                )}
              </div>
            )}

            {!currentPassword && (
              <div className="info-message" style={{
                backgroundColor: '#f0f8ff',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #d1ecf1',
                marginBottom: '15px'
              }}>
                <p style={{ margin: 0, fontSize: '0.9em' }}>
                  <strong>Примечание:</strong> При сохранении вам будет предложено ввести текущий пароль пользователя,
                  так как он необходим для обновления профиля.
                </p>
              </div>
            )}
          </div>

          <div className="form-section">
            <h3>Настройки доступа</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="role_id">Роль пользователя *</label>
                <select
                  id="role_id"
                  name="role_id"
                  value={form.role_id}
                  onChange={handleChange}
                  required
                  className="form-control"
                >
                  <option value="">Выберите роль</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <p style={{color: 'red', whiteSpace: 'pre-wrap'}}>{error}</p>
            </div>
          )}

          {success && (
            <div className="success-message">
              <p style={{color: 'green'}}>{success}</p>
              <p>Перенаправление на страницу пользователя...</p>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/users/${id}`)}
              disabled={saving}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner"></span>
                  Сохранение...
                </>
              ) : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserEditPage;