import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Home = () => {
  const { isAdmin, isResearcher } = useAuth();

  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Информационная подсистема</h1>
        <p>
          Информационная подсистема для хранения данных о металлических сплавах и
          прогнозирования их физических свойств
        </p>

        <div className="cta-buttons">
          <Link to="/alloys" className="btn btn-primary">
            Сплавы
          </Link>
          <Link to="/predictions" className="btn btn-secondary">
            Прогнозы
          </Link>
        </div>
      </div>

      <div className="features-section">
        <h2>Возможности</h2>

        <div className="features-grid">
          <div className="feature-card">
            <h3>Сплавы</h3>
            <p>Работа с данными о металлических сплавах</p>
            <Link to="/alloys" className="btn btn-outline">
              Перейти
            </Link>
          </div>

         {(isAdmin || isResearcher) && ( <div className="feature-card">
            <h3>Прогнозирование</h3>
            <p>Прогнозирования предела прочности</p>
            <Link to="/predictions/new" className="btn btn-outline">
              Создать прогноз
            </Link>
          </div>)}

          <div className="feature-card">
            <h3>Патенты</h3>
            <p>Патентная информация о сплавах</p>
            <Link to="/patents" className="btn btn-outline">
              Перейти
            </Link>
          </div>

          {isAdmin && (
  <>
    <div className="feature-card">
      <h3>Пользователи</h3>
      <p>Управление пользователями</p>
      <Link to="/users" className="btn btn-outline">
        Перейти
      </Link>
    </div>

    <div className="feature-card">
      <h3>Админ-панель</h3>
      <p>Управление АИС</p>
      <Link to="/admin" className="btn btn-outline">
        Перейти
      </Link>
    </div>
  </>
)}
        </div>
      </div>
    </div>
  );
};

export default Home;
