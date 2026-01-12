import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import { patentService, alloyService, predictionService } from "./services/api";
import LoadingSpinner from "./components/common/LoadingSpinner";

import Header from "./components/layout/Header";
import Sidebar from "./components/layout/Sidebar";
import Footer from "./components/layout/Footer";

import Home from "./pages/Home";

import Login from "./components/auth/Login";
import Register from "./components/auth/Register";

import Dashboard from "./pages/Dashboard";

import AlloysPage from "./pages/AlloysPage";
import AlloyNewPage from "./pages/AlloyNewPage";
import AlloyEditPage from "./pages/AlloyEditPage";
import AlloyDetailsPage from "./pages/AlloyDetailsPage";

import PatentsPage from "./pages/PatentsPage";
import PatentNewPage from "./pages/PatentNewPage";
import PatentEditPage from "./pages/PatentEditPage";
import PatentDetailsPage from "./pages/PatentDetailsPage";

import PredictionsPage from "./pages/PredictionsPage";
import PredictionNewPage from "./pages/PredictionNewPage";
import PredictionEditPage from "./pages/PredictionEditPage";
import PredictionDetailsPage from "./pages/PredictionDetailsPage";

import UsersListPage from "./pages/UsersListPage";
import UserDetailsPage from "./pages/UserDetailsPage";
import UserEditPage from "./pages/UserEditPage";

import MyProfilePage from "./pages/MyProfilePage";
import ProfileEditPage from "./pages/ProfileEditPage";

import ReportsPage from "./pages/ReportsPage";
import AdminPanel from "./pages/AdminPanel";

import "./styles/main.css";

const normalizeLogin = (s) => String(s || "").trim().toLowerCase();

const splitAuthorsNorm = (authorsName) =>
  String(authorsName || "")
    .split(",")
    .map((x) => normalizeLogin(x))
    .filter(Boolean);

const roleLower = (role) => String(role || "").trim().toLowerCase();
const isGuestRoleName = (role) => {
  const r = roleLower(role);
  return r === "guest" || r === "гость";
};

// --- Экран "нет прав" для невошедшего ---
const AuthWall = ({ message }) => {
  return (
    <div className="info-message">
      <p>{message}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <Link to="/login" className="btn btn-primary">
          Войти
        </Link>
        <Link to="/register" className="btn btn-outline">
          Регистрация
        </Link>
      </div>
    </div>
  );
};

// --- Обёртка: если user нет — показываем AuthWall вместо контента ---
const RequireUser = ({ message, children }) => {
  const { user } = useAuth();
  if (!user) return <AuthWall message={message} />;
  return children;
};

// --- Public auth pages: если уже залогинен (включая guest), уводим на главную ---
const PublicAuthPage = ({ children }) => {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return children;
};

// --- Глобальный gate: guest может ходить только по белому списку URL ---
const GuestGate = ({ children }) => {
  const { user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const currentRole = role ?? user?.role;
  const isGuest = isGuestRoleName(currentRole);

  useEffect(() => {
    if (!isGuest) return;

    const p = location.pathname;

    const allowed =
      p === "/" ||
      p === "/alloys" ||
      p === "/patents" ||
      /^\/alloys\/\d+\/?$/.test(p) ||
      /^\/patents\/\d+\/?$/.test(p);

    if (!allowed) {
      navigate("/", { replace: true });
    }
  }, [isGuest, location.pathname, navigate]);

  return children;
};

// --- Guard: редактирование патента только автору (для researcher) или admin ---
const PatentEditGuard = ({ children }) => {
  const { id } = useParams();
  const { user, isAdmin, isResearcher } = useAuth();

  const myLogin = useMemo(() => normalizeLogin(user?.login), [user?.login]);

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setChecking(true);

        if (isAdmin) {
          if (!cancelled) {
            setAllowed(true);
            setChecking(false);
          }
          return;
        }

        if (!isResearcher) {
          if (!cancelled) {
            setAllowed(false);
            setChecking(false);
          }
          return;
        }

        const res = await patentService.getById(id);
        const patent = res.data || {};
        const authors = splitAuthorsNorm(patent.authors_name);

        if (!cancelled) {
          setAllowed(authors.includes(myLogin));
          setChecking(false);
        }
      } catch (e) {
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [id, isAdmin, isResearcher, myLogin]);

  if (checking) return <LoadingSpinner />;

  return allowed ? children : <Navigate to="/patents" replace />;
};

// --- Guard: редактирование сплава только “по своему патенту” (для researcher) или admin ---
const AlloyEditGuard = ({ children }) => {
  const { id } = useParams();
  const { user, isAdmin, isResearcher } = useAuth();

  const myLogin = useMemo(() => normalizeLogin(user?.login), [user?.login]);

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setChecking(true);

        if (isAdmin) {
          if (!cancelled) {
            setAllowed(true);
            setChecking(false);
          }
          return;
        }

        if (!isResearcher) {
          if (!cancelled) {
            setAllowed(false);
            setChecking(false);
          }
          return;
        }

        const alloyRes = await alloyService.getById(id);
        const alloy = alloyRes.data || {};
        const patentId = alloy.patent_id;

        if (!patentId) {
          if (!cancelled) {
            setAllowed(false);
            setChecking(false);
          }
          return;
        }

        const patentRes = await patentService.getById(patentId);
        const patent = patentRes.data || {};
        const authors = splitAuthorsNorm(patent.authors_name);

        if (!cancelled) {
          setAllowed(authors.includes(myLogin));
          setChecking(false);
        }
      } catch (e) {
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [id, isAdmin, isResearcher, myLogin]);

  if (checking) return <LoadingSpinner />;

  return allowed ? children : <Navigate to="/alloys" replace />;
};

// --- Guard: доступ к прогнозу только владельцу (researcher) или admin ---
const PredictionAccessGuard = ({ children }) => {
  const { id } = useParams();
  const { user, isAdmin, isResearcher } = useAuth();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setChecking(true);

        if (isAdmin) {
          if (!cancelled) {
            setAllowed(true);
            setChecking(false);
          }
          return;
        }

        if (!isResearcher) {
          if (!cancelled) {
            setAllowed(true);
            setChecking(false);
          }
          return;
        }

        const res = await predictionService.getById(id);
        const prediction = res.data || {};

        const ownerId = Number(prediction?.personid ?? prediction?.person_id);
        const myId = Number(user?.id);

        if (!cancelled) {
          setAllowed(Number.isFinite(ownerId) && Number.isFinite(myId) && ownerId === myId);
          setChecking(false);
        }
      } catch (e) {
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [id, isAdmin, isResearcher, user?.id]);

  if (checking) return <LoadingSpinner />;

  return allowed ? children : <Navigate to="/predictions" replace />;
};

const NotFound = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="not-found-page">
      <h2>404 - Страница не найдена</h2>
      <p>Запрошенная страница не существует.</p>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <GuestGate>
          <div className="app-container">
            <Header />

            <div className="main-content">
              <Sidebar />

              <div className="content-area">
                <Routes>
                  {/* ---------------- PUBLIC ---------------- */}
                  <Route path="/" element={<Home />} />
                  <Route
                    path="/login"
                    element={
                      <PublicAuthPage>
                        <Login />
                      </PublicAuthPage>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <PublicAuthPage>
                        <Register />
                      </PublicAuthPage>
                    }
                  />

                  {/* Сплавы: невошедший видит "нет прав" */}
                  <Route
                    path="/alloys"
                    element={
                      <RequireUser message="У вас нет прав для просмотра сплавов.">
                        <AlloysPage />
                      </RequireUser>
                    }
                  />
                  <Route
                    path="/alloys/:id"
                    element={
                      <RequireUser message="У вас нет прав для просмотра сплавов.">
                        <AlloyDetailsPage />
                      </RequireUser>
                    }
                  />

                  {/* Патенты (сделано так же — чтобы у невошедшего были только главная/вход/регистрация) */}
                  <Route
                    path="/patents"
                    element={
                      <RequireUser message="У вас нет прав для просмотра патентов.">
                        <PatentsPage />
                      </RequireUser>
                    }
                  />
                  <Route
                    path="/patents/:id"
                    element={
                      <RequireUser message="У вас нет прав для просмотра патентов.">
                        <PatentDetailsPage />
                      </RequireUser>
                    }
                  />

                  {/* ---------------- PROTECTED ---------------- */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Profile */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <MyProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/edit"
                    element={
                      <ProtectedRoute>
                        <ProfileEditPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Alloys create/edit */}
                  <Route
                    path="/alloys/new"
                    element={
                      <ProtectedRoute>
                        <AlloyNewPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/alloys/edit/:id"
                    element={
                      <ProtectedRoute>
                        <AlloyEditGuard>
                          <AlloyEditPage />
                        </AlloyEditGuard>
                      </ProtectedRoute>
                    }
                  />

                  {/* Patents create/edit */}
                  <Route
                    path="/patents/new"
                    element={
                      <ProtectedRoute>
                        <PatentNewPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/patents/edit/:id"
                    element={
                      <ProtectedRoute>
                        <PatentEditGuard>
                          <PatentEditPage />
                        </PatentEditGuard>
                      </ProtectedRoute>
                    }
                  />

                  {/* Predictions */}
                  <Route
                    path="/predictions"
                    element={
                      <ProtectedRoute>
                        <PredictionsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/predictions/new"
                    element={
                      <ProtectedRoute>
                        <PredictionNewPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/predictions/edit/:id"
                    element={
                      <ProtectedRoute>
                        <PredictionAccessGuard>
                          <PredictionEditPage />
                        </PredictionAccessGuard>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/predictions/:id"
                    element={
                      <ProtectedRoute>
                        <PredictionAccessGuard>
                          <PredictionDetailsPage />
                        </PredictionAccessGuard>
                      </ProtectedRoute>
                    }
                  />

                  {/* Users */}
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute>
                        <UsersListPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/users/:id"
                    element={
                      <ProtectedRoute>
                        <UserDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/users/:id/edit"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <UserEditPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Reports */}
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute>
                        <ReportsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Admin */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute requiredRole="admin">
                        <AdminPanel />
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </div>

            <Footer />
          </div>
        </GuestGate>
      </Router>
    </AuthProvider>
  );
}

export default App;
