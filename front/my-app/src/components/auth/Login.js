import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuth from "../../context/AuthContext";

const Login = () => {
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    if (!loginValue.trim()) {
      newErrors.login = "Введите логин";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Введите пароль";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setErrors({});

    // Валидация перед отправкой
    if (!validateForm()) {
      setFormError("Заполните все поля");
      return;
    }

    setLoading(true);

    try {
      await login(loginValue, password);

      // Сохраняем логин в localStorage если выбрано "Запомнить меня"
      if (rememberMe) {
        localStorage.setItem('rememberedLogin', loginValue);
      } else {
        localStorage.removeItem('rememberedLogin');
      }

      navigate("/dashboard");
    } catch (err) {
      setFormError(err.message || "Ошибка входа. Проверьте логин и пароль.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e, field) => {
    const value = e.target.value;
    if (field === 'login') {
      setLoginValue(value);
    } else {
      setPassword(value);
    }

    // Очищаем ошибку при вводе
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
    if (formError) {
      setFormError("");
    }
  };

  // Автозаполнение сохраненного логина
  React.useEffect(() => {
    const remembered = localStorage.getItem('rememberedLogin');
    if (remembered) {
      setLoginValue(remembered);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="login-container">
      <div className="form-header">
        <span className="form-header-icon">🔐</span>
        <h2>Добро пожаловать!</h2>
        <p>Войдите в свой аккаунт</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="login">Логин</label>
          <input
            type="text"
            id="login"
            value={loginValue}
            onChange={(e) => handleInputChange(e, 'login')}
            placeholder="Введите ваш логин"
            required
            maxLength={50}
            className={errors.login ? "error" : ""}
            disabled={loading}
          />
          {errors.login && <div className="field-error">{errors.login}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Пароль</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => handleInputChange(e, 'password')}
            placeholder="Введите ваш пароль"
            required
            className={errors.password ? "error" : ""}
            disabled={loading}
          />
          {errors.password && <div className="field-error">{errors.password}</div>}
        </div>

        <div className="remember-me">
          <input
            type="checkbox"
            id="remember"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading}
          />
          <label htmlFor="remember">Запомнить меня</label>
        </div>

        {formError && <div className="form-error">{formError}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          data-testid="login-button"
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Вход...
            </>
          ) : (
            "Войти"
          )}
        </button>
      </form>

      <div className="form-footer">
        <p>
          Нет аккаунта?{" "}
          <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;