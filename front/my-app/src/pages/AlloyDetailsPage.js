import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { alloyService, patentService, elementService } from "../services/api";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";

const AlloyDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isResearcher, user } = useAuth();

  const [alloy, setAlloy] = useState(null);
  const [elements, setElements] = useState([]);
  const [patent, setPatent] = useState(null);
  const [allElementsMap, setAllElementsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAlloyDetails();
  }, [id]);

  const fetchAlloyDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const [alloyRes, elementsRes, patenttRes, allElementsRes] = await Promise.all([
        alloyService.getById(id),
        alloyService.getElements(id),
        patentService.getAll(),
        elementService.getAll(),
      ]);

      setAlloy(alloyRes.data);

      // Маппируем все элементы для быстрого доступа по ID
      const elementMap = {};
      (allElementsRes.data || []).forEach((el) => {
        elementMap[el.id] = el;
      });
      setAllElementsMap(elementMap);

      // Обогащаем элементы символами
      const enrichedElements = (elementsRes.data || []).map((el) => ({
        ...el,
        symbol: elementMap[el.element_id]?.symbol || "?",
        name: elementMap[el.element_id]?.name || "Неизвестный элемент",
      }));
      setElements(enrichedElements);

      // Ищем патент
      const patentMap = {};
      (patenttRes.data || []).forEach((p) => {
        patentMap[p.id] = p;
      });

      if (alloyRes.data?.patent_id && patentMap[alloyRes.data.patent_id]) {
        setPatent(patentMap[alloyRes.data.patent_id]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Ошибка загрузки сплава");
      console.error("Error fetching alloy details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Вы уверены, что хотите удалить этот сплав?")) {
      return;
    }

    try {
      await alloyService.delete(id);
      alert("Сплав успешно удалён!");
      navigate("/alloys");
    } catch (err) {
      alert(err.response?.data?.detail || "Ошибка удаления сплава");
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="alloy-details-page">
        <div className="error-container">
          <h2>Ошибка</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate("/alloys")}>
            Вернуться к списку
          </button>
        </div>
      </div>
    );
  }

  if (!alloy) {
    return (
      <div className="alloy-details-page">
        <div className="not-found">
          <h2>Сплав не найден</h2>
          <button className="btn btn-primary" onClick={() => navigate("/alloys")}>
            Вернуться к списку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="alloy-details-page">
      <div className="details-header">
        <h1>Сплав #{alloy.id}</h1>
        <div className="details-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/alloys")}
          >
            Назад к списку
          </button>

          {isAdmin && (
  <>
    <button
      className="btn btn-primary"
      onClick={() => navigate(`/alloys/edit/${id}`)}
    >
      Редактировать
    </button>

    <button className="btn btn-danger" onClick={handleDelete}>
      Удалить
    </button>
  </>
)}
        </div>
      </div>

      <div className="details-card">
        <div className="details-section">
          <h2>Основная информация</h2>
          <table className="details-table">
            <tbody>
              <tr>
                <td className="label">ID:</td>
                <td>{alloy.id}</td>
              </tr>
              <tr>
                <td className="label">Значение свойства:</td>
                <td>{alloy.prop_value}</td>
              </tr>
              <tr>
                <td className="label">Категория:</td>
                <td>{alloy.category}</td>
              </tr>
              <tr>
                <td className="label">Тип прокатки:</td>
                <td>{alloy.rolling_type}</td>
              </tr>
              <tr>
                <td className="label">Патент:</td>
                <td>
                  {patent ? (
                    <>
                      <button
                        className="link-button"
                        onClick={() => navigate(`/patents/${patent.id}`)}
                      >
                        {patent.patent_name}
                      </button>
                      <span className="text-muted"> (Автор: {patent.authors_name})</span>
                    </>
                  ) : (
                    <span className="text-muted">Не указан</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {elements && elements.length > 0 && (
          <div className="details-section">
            <h2>Состав сплава</h2>
            <table className="details-table">
  <thead>
    <tr>
      <th>Элемент</th>
      <th>Символ</th>
      <th>Процент содержания</th>
    </tr>
  </thead>
  <tbody>
    {elements.map((el, idx) => (
      <tr key={idx}>
        <td>{el.name}</td>
        <td>
          <strong>{el.symbol}</strong>
        </td>
        <td>{el.percentage}%</td>
      </tr>
    ))}
  </tbody>
</table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlloyDetailsPage;
