import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Header = () => {
  const { user, logout, isAuthenticated, role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar app-header">
      <Link to="/dashboard" className="navbar-brand">
        Metal Alloys
      </Link>

      <nav className="navbar-menu">
        {isAuthenticated ? (
          <>
            <NavLink to="/" className="nav-link">
              Главная
            </NavLink>
            {role !== "guest" && (
  <NavLink to="/profile" className="nav-link">
    Профиль
  </NavLink>
)}

            <span className="nav-user">
              {user?.login || user?.firstName || user?.first_name || "Пользователь"}
            </span>
            <span className="nav-user">
              {role}
            </span>

            <button className="logout-btn" onClick={handleLogout}>
              Выйти
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="nav-link">
              Вход
            </NavLink>
            <NavLink to="/register" className="nav-link">
              Регистрация
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
};

export default Header;
