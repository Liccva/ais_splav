import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { personService, roleService } from "../../services/api";

const GUEST_ROLE_NAME = "гость";

const Register = () => {
  const [roles, setRoles] = useState([]);
  const [guestRole, setGuestRole] = useState(null);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    organization: "",
    login: "",
    password: "",
    confirmPassword: "",
    role_id: "", // будет выставлен автоматически
  });

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoadingRoles(true);
        const res = await roleService.getAll();
        const all = res.data || [];
        setRoles(all);

        const guest = all.find(
          (r) => String(r?.name || "").trim().toLowerCase() === GUEST_ROLE_NAME
        );

        if (!guest?.id) {
          setGuestRole(null);
          setFormError('В системе не найдена роль "гость". Обратитесь к администратору.');
          return;
        }

        setGuestRole(guest);
        setForm((prev) => ({ ...prev, role_id: String(guest.id) }));
      } catch (err) {
        console.error("Error fetching roles:", err);
        setFormError("Не удалось загрузить список ролей");
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    if (!form.first_name.trim()) {
      newErrors.first_name = "Заполните имя";
      isValid = false;
    } else if (form.first_name.trim().length < 2) {
      newErrors.first_name = "Имя должно быть не менее 2 символов";
      isValid = false;
    }

    if (!form.last_name.trim()) {
      newErrors.last_name = "Заполните фамилию";
      isValid = false;
    } else if (form.last_name.trim().length < 2) {
      newErrors.last_name = "Фамилия должна быть не менее 2 символов";
      isValid = false;
    }

    if (!form.login.trim()) {
      newErrors.login = "Заполните логин";
      isValid = false;
    } else if (form.login.trim().length < 3) {
      newErrors.login = "Логин должен быть не менее 3 символов";
      isValid = false;
    } else if (form.login.trim().length > 20) {
      newErrors.login = "Логин должен быть не более 20 символов";
      isValid = false;
    }

    // роль должна быть установлена автоматически
    if (!guestRole?.id) {
      newErrors.role_id = 'Роль "гость" не определена';
      isValid = false;
    }

    if (!form.password) {
      newErrors.password = "Введите пароль";
      isValid = false;
    } else if (form.password.length < 6) {
      newErrors.password = "Пароль должен быть не менее 6 символов";
      isValid = false;
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = "Повторите пароль";
      isValid = false;
    }

    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      newErrors.confirmPassword = "Пароли не совпадают";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // роль на клиенте менять нельзя
    if (name === "role_id") return;

    setForm({ ...form, [name]: value });

    if (formSubmitted) {
      const newErrors = { ...errors };
      delete newErrors[name];

      if (name === "first_name") {
        if (!value.trim()) newErrors.first_name = "Заполните имя";
        else if (value.trim().length < 2) newErrors.first_name = "Имя должно быть не менее 2 символов";
      } else if (name === "last_name") {
        if (!value.trim()) newErrors.last_name = "Заполните фамилию";
        else if (value.trim().length < 2) newErrors.last_name = "Фамилия должна быть не менее 2 символов";
      } else if (name === "login") {
        if (!value.trim()) newErrors.login = "Заполните логин";
        else if (value.trim().length < 3) newErrors.login = "Логин должен быть не менее 3 символов";
        else if (value.trim().length > 20) newErrors.login = "Логин должен быть не более 20 символов";
      } else if (name === "password") {
        if (!value) newErrors.password = "Введите пароль";
        else if (value.length < 6) newErrors.password = "Пароль должен быть не менее 6 символов";
      } else if (name === "confirmPassword") {
        if (!value) newErrors.confirmPassword = "Повторите пароль";
        else if (form.password && value !== form.password) newErrors.confirmPassword = "Пароли не совпадают";
      }

      setErrors(newErrors);
    }

    if (formError) setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSubmitted(true);

    if (!validateForm()) {
      setFormError("Исправьте ошибки в форме");
      return;
    }

    setLoading(true);
    try {
      // Жёстко используем роль гостя (не берём из form.role_id)
      await personService.create({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        organization: form.organization.trim(),
        login: form.login.trim(),
        password: form.password,
        role_id: parseInt(guestRole.id, 10),
      });

      window.alert("Аккаунт успешно создан!");
      navigate("/login");
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || "Ошибка регистрации";
      setFormError(errorMsg);
      console.error("Register error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="form-header">
        <h2>Регистрация</h2>
      </div>

      <form onSubmit={handleSubmit} className="form-card" noValidate>
        <div className="form-group">
          <label htmlFor="first_name">Имя</label>
          <input
            type="text"
            id="first_name"
            name="first_name"
            placeholder="Введите имя"
            value={form.first_name}
            onChange={handleChange}
            required
            maxLength={50}
            className={errors.first_name ? "error" : ""}
            disabled={loading}
          />
          {errors.first_name && <div className="field-error">{errors.first_name}</div>}
          <div className="field-hint">Минимум 2 символа</div>
        </div>

        <div className="form-group">
          <label htmlFor="last_name">Фамилия</label>
          <input
            type="text"
            id="last_name"
            name="last_name"
            placeholder="Введите фамилию"
            value={form.last_name}
            onChange={handleChange}
            required
            maxLength={50}
            className={errors.last_name ? "error" : ""}
            disabled={loading}
          />
          {errors.last_name && <div className="field-error">{errors.last_name}</div>}
          <div className="field-hint">Минимум 2 символа</div>
        </div>

        <div className="form-group">
          <label htmlFor="organization">Организация</label>
          <input
            type="text"
            id="organization"
            name="organization"
            placeholder="Введите организацию (необязательно)"
            value={form.organization}
            onChange={handleChange}
            maxLength={100}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="login">Логин</label>
          <input
            type="text"
            id="login"
            name="login"
            placeholder="Введите логин"
            value={form.login}
            onChange={handleChange}
            required
            maxLength={20}
            minLength={3}
            className={errors.login ? "error" : ""}
            disabled={loading}
          />
          {errors.login && <div className="field-error">{errors.login}</div>}
          <div className="field-hint">От 3 до 20 символов</div>
        </div>

        {/* Роль фиксирована */}
        <div className="form-group">
          <label htmlFor="role_display">Роль</label>
          <input
            type="text"
            id="role_display"
            value={loadingRoles ? "Загрузка..." : "Гость"}
            disabled
          />
          {/* role_id остаётся в state, но на UI не меняется */}
          {errors.role_id && <div className="field-error">{errors.role_id}</div>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Пароль</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Введите пароль"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
            className={errors.password ? "error" : ""}
            disabled={loading}
          />
          {errors.password && <div className="field-error">{errors.password}</div>}
          <div className="field-hint">Минимум 6 символов</div>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Повторите пароль</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Повторите пароль"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            className={errors.confirmPassword ? "error" : ""}
            disabled={loading}
          />
          {errors.confirmPassword && (
            <div className="field-error">{errors.confirmPassword}</div>
          )}
        </div>

        {formError && <div className="form-error">{formError}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || loadingRoles || !guestRole?.id}
          data-testid="register-button"
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Регистрация...
            </>
          ) : (
            "Зарегистрироваться"
          )}
        </button>
      </form>

      <p style={{ marginTop: "20px", textAlign: "center" }}>
        Уже есть аккаунт? <a href="/login">Войти</a>
      </p>
    </div>
  );
};

export default Register;
