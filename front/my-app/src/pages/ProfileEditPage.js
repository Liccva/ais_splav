import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { personService } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const ProfileEditPage = () => {
  const { user, isAdmin, updateUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    organization: '',
    login: '',
    role_id: '',
    password: '',
    confirm_password: ''
  });

  // Храним текущий пароль отдельно
  const [currentPassword, setCurrentPassword] = useState('');

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      // Пытаемся получить текущий пароль (если он есть в контексте)
      const userPassword = user.password || '';

      setForm({
        first_name: user.first_name || user.firstName || '',
        last_name: user.last_name || user.lastName || '',
        organization: user.organization || '',
        login: user.login || '',
        role_id: user.role_id?.toString() || '2',
        password: '', // Поле для нового пароля
        confirm_password: '' // Подтверждение нового пароля
      });

      setCurrentPassword(userPassword);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));

    // Очищаем ошибку для этого поля при изменении
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Обязательные поля
    if (!form.first_name.trim()) newErrors.first_name = 'Имя обязательно';
    if (!form.last_name.trim()) newErrors.last_name = 'Фамилия обязательна';
    if (!form.login.trim()) newErrors.login = 'Логин обязателен';

    // Если введен новый пароль, то проверяем его
    if (form.password.trim() !== '') {
      if (form.password.length < 6) {
        newErrors.password = 'Пароль должен быть не менее 6 символов';
      }
      if (form.password !== form.confirm_password) {
        newErrors.confirm_password = 'Пароли не совпадают';
      }
    }

    // Если введено подтверждение пароля, но нет пароля
    if (form.confirm_password.trim() !== '' && form.password.trim() === '') {
      newErrors.password = 'Введите пароль';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setError('Пожалуйста, исправьте ошибки в форме');
      return;
    }

    setSaving(true);

    try {
      // Для не-админов используем текущую роль
      const roleIdToSend = isAdmin ? parseInt(form.role_id) : user?.role_id;

      // Подготовка данных для отправки
      const dataToSend = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        organization: form.organization.trim() || '',
        login: form.login.trim(),
        role_id: roleIdToSend
      };

      // Определяем, какой пароль отправлять
      if (form.password.trim() !== '') {
        // Если ввели новый пароль - используем его
        dataToSend.password = form.password.trim();
        console.log('Используем новый пароль');
      } else if (currentPassword) {
        // Если не вводили новый пароль, но есть текущий - используем текущий
        dataToSend.password = currentPassword;
        console.log('Используем текущий пароль из контекста');
      } else {
        // Если нет ни нового, ни текущего пароля - запросим у пользователя
        const passwordFromUser = prompt(
          'Поле "пароль" обязательно. Введите текущий пароль или новый:'
        );
        if (!passwordFromUser) {
          setError('Поле "пароль" обязательно для обновления профиля');
          setSaving(false);
          return;
        }
        dataToSend.password = passwordFromUser;
        console.log('Используем пароль из prompt');
      }

      console.log('Отправляемые данные:', { ...dataToSend, password: '***' });

      await personService.update(user.id, dataToSend);

      // Обновляем пользователя в контексте
      const updatedUserData = {
        ...user,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        firstName: form.first_name.trim(),
        lastName: form.last_name.trim(),
        organization: form.organization.trim(),
        login: form.login.trim(),
        role_id: roleIdToSend
      };

      // Если пароль был изменен, обновляем его в контексте (осторожно!)
      if (form.password.trim() !== '') {
        updatedUserData.password = form.password.trim();
      }

      updateUser(updatedUserData);

      setSuccess('Профиль успешно обновлен');

      // Возвращаемся на страницу профиля через 2 секунды
      setTimeout(() => {
        navigate('/profile');
      }, 2000);

    } catch (err) {
      console.error('Ошибка при обновлении профиля:', err);

      if (err.response?.data?.detail) {
        const errorDetail = err.response.data.detail;

        if (typeof errorDetail === 'string') {
          // Если это ошибка о пароле
          if (errorDetail.includes('password') || errorDetail.includes('парол')) {
            // Предлагаем пользователю ввести пароль
            const passwordFromUser = prompt(
              'Для обновления профиля требуется пароль. Введите ваш текущий пароль:'
            );
            if (passwordFromUser) {
              // Сохраняем пароль в состояние и пытаемся снова
              setCurrentPassword(passwordFromUser);
              // Можно автоматически отправить форму заново или показать сообщение
              setError('Пожалуйста, нажмите "Сохранить изменения" еще раз');
            }
          } else {
            setError(errorDetail);
          }
        }
        else if (Array.isArray(errorDetail)) {
          const errorMessages = errorDetail.map(error => {
            const field = error.loc?.slice(-1)[0] || 'поле';
            return `${field}: ${error.msg}`;
          }).join(', ');
          setError(`Ошибки валидации: ${errorMessages}`);
        }
        else if (typeof errorDetail === 'object') {
          setError(errorDetail.msg || JSON.stringify(errorDetail));
        }
        else {
          setError('Ошибка обновления профиля');
        }
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Ошибка обновления профиля');
      }
    } finally {
      setSaving(false);
    }
  };

  // Альтернативный вариант: сделать пароль всегда видимым, но с подсказкой
  const renderPasswordField = () => {
    return (
      <div className="form-group">
        <label htmlFor="password">Пароль *</label>
        <input
          type="password"
          id="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder={currentPassword ? "Введите новый пароль (оставьте пустым, чтобы не менять)" : "Введите пароль"}
          className={errors.password ? 'error' : ''}
          required={!currentPassword}
        />
        {errors.password && (
          <span className="field-error">{errors.password}</span>
        )}
        <small className="form-hint">
          {currentPassword
            ? "Оставьте пустым, чтобы не менять пароль. Если хотите изменить - введите новый пароль"
            : "Поле обязательно. Введите ваш пароль"}
        </small>
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="profile-edit-page">
      <div className="page-header">
        <h1>Редактирование профиля</h1>
        <button onClick={() => navigate('/profile')} className="btn btn-outline">
          ← Назад к профилю
        </button>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Личная информация</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">Имя *</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  placeholder="Ваше имя"
                  className={errors.first_name ? 'error' : ''}
                  required
                />
                {errors.first_name && (
                  <span className="field-error">{errors.first_name}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="last_name">Фамилия *</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  placeholder="Ваша фамилия"
                  className={errors.last_name ? 'error' : ''}
                  required
                />
                {errors.last_name && (
                  <span className="field-error">{errors.last_name}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login">Логин *</label>
              <input
                type="text"
                id="login"
                name="login"
                value={form.login}
                onChange={handleChange}
                placeholder="Ваш логин"
                className={errors.login ? 'error' : ''}
                required
              />
              {errors.login && (
                <span className="field-error">{errors.login}</span>
              )}
              <small className="form-hint">Используется для входа в систему</small>
            </div>

            {renderPasswordField()}

            {form.password.trim() !== '' && (
              <div className="form-group">
                <label htmlFor="confirm_password">Подтверждение пароля *</label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="Подтвердите новый пароль"
                  className={errors.confirm_password ? 'error' : ''}
                  required={form.password.trim() !== ''}
                />
                {errors.confirm_password && (
                  <span className="field-error">{errors.confirm_password}</span>
                )}
                <small className="form-hint">Подтвердите новый пароль</small>
              </div>
            )}

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

            {/* Только для админа - изменение роли */}
            {isAdmin && (
              <div className="form-group">
                <label htmlFor="role_id">Роль пользователя *</label>
                <select
                  id="role_id"
                  name="role_id"
                  value={form.role_id}
                  onChange={handleChange}
                  className="form-control"
                  required
                >
                  <option value="3">Администратор</option>
                  <option value="1">Исследователь</option>
                  <option value="2">Гость</option>
                </select>
                <small className="form-hint">Только администраторы могут изменять роли</small>
              </div>
            )}
          </div>

          {error && (
            <div className="error-message">
              <p style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{error}</p>
            </div>
          )}

          {success && (
            <div className="success-message">
              <p style={{ color: 'green' }}>{success}</p>
              <p>Перенаправление на страницу профиля...</p>
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/profile')}
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

export default ProfileEditPage;