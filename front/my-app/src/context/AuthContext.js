import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { personService, roleService } from "../services/api";

const AuthContext = createContext(null);

const ROLE = {
  ADMIN: "admin",
  RESEARCHER: "researcher",
  GUEST: "guest",
};

// id ролей в БД
const ROLE_ID = {
  ADMIN: 3,
  GUEST: 2,
  RESEARCHER: 1
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawUser = localStorage.getItem("auth_user");
    const rawRole = localStorage.getItem("auth_role");

    if (rawUser) {
      try {
        setUser(JSON.parse(rawUser));
      } catch (e) {
        console.error("Error parsing auth_user:", e);
        localStorage.removeItem("auth_user");
      }
    }

    if (rawRole) setRole(rawRole);

    setLoading(false);
  }, []);

  const isAuthenticated = !!user;

  // Функция обновления пользователя
  const updateUser = (updatedUserData) => {
    if (!user) return;

    const newUserData = {
      ...user,
      ...updatedUserData
    };

    setUser(newUserData);
    localStorage.setItem("auth_user", JSON.stringify(newUserData));

    // Обновляем роль, если она изменилась
    if (updatedUserData.role_id !== undefined) {
      let newRole = ROLE.GUEST;
      if (updatedUserData.role_id === ROLE_ID.ADMIN) {
        newRole = ROLE.ADMIN;
      } else if (updatedUserData.role_id === ROLE_ID.RESEARCHER) {
        newRole = ROLE.RESEARCHER;
      }

      if (newRole !== role) {
        setRole(newRole);
        localStorage.setItem("auth_role", newRole);
      }
    }
  };

  const login = async (loginValue, passwordValue) => {
    const personRes = await personService.getByLogin(loginValue);
    const person = personRes.data;

    const passRes = await personService.getPasswordByLogin(loginValue);
    const realPassword = passRes.data;

    if (String(realPassword) !== String(passwordValue)) {
      throw new Error("Неверный пароль");
    }

    let roleName = ROLE.GUEST;

    if (person?.role_id === ROLE_ID.ADMIN) {
      roleName = ROLE.ADMIN;
    } else if (person?.role_id === ROLE_ID.RESEARCHER) {
      roleName = ROLE.RESEARCHER;
    } else {
      try {
        const rolesRes = await roleService.getAll();
        const found = (rolesRes.data || []).find((r) => r.id === person?.role_id);

        if (found?.name === "исследователь") roleName = ROLE.RESEARCHER;
        else if (found?.name === "администратор") roleName = ROLE.ADMIN;
      } catch (_) {
        // оставляем guest
      }
    }

    setUser(person);
    setRole(roleName);

    localStorage.setItem("auth_user", JSON.stringify(person));
    localStorage.setItem("auth_role", roleName);
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_role");
  };

  const value = useMemo(
    () => ({
      user,
      role,
      isAuthenticated,
      loading,
      login,
      logout,
      updateUser, // Добавляем функцию обновления
      isAdmin: role === ROLE.ADMIN,
      isResearcher: role === ROLE.RESEARCHER,
      roleLabel:
        role === ROLE.ADMIN
          ? "администратор"
          : role === ROLE.RESEARCHER
          ? "исследователь"
          : "гость",
    }),
    [user, role, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export default useAuth;