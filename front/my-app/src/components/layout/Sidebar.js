import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Sidebar = () => {
  const { role } = useAuth();

  const menuItems = [
    { path: "/dashboard", label: "Дашборд", roles: ["researcher", "admin"] },
    { path: "/profile", label: "Мой профиль", roles: ["researcher", "admin", "user"] },
    { path: "/users", label: "Пользователи", roles: ["admin"] },
    { path: "/alloys", label: "Сплавы", roles: ["researcher", "admin", "guest"] },
    { path: "/predictions", label: "Прогнозирование", roles: ["researcher", "admin"] },
    { path: "/patents", label: "Патенты", roles: ["researcher", "admin", "guest"] },

    // ВАЖНО: отчёты доступны администратору и исследователю
    { path: "/reports", label: "Отчеты",  roles: ["admin", "researcher"] },
  ];

  // Админ-панель только для admin
  if (role === "admin") {
    menuItems.push({ path: "/admin", label: "Админ-панель", icon: "⚡", roles: ["admin"] });
  }

  return (
    <div className="sidebar">


      <nav className="sidebar-nav">
        <ul>
          {menuItems
            .filter((item) => item.roles.includes(role))
            .map((item) => (
              <li key={item.path}>
                <NavLink to={item.path} className={({ isActive }) => (isActive ? "active" : "")}>
                  <span className="icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
        </ul>
      </nav>


    </div>
  );
};

export default Sidebar;
