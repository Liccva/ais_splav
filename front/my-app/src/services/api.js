import axios from "axios";

const API_BASE = 'http://192.168.56.104/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Добавляем перехватчик для авторизации (если нужно)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------------- Elements ----------------
export const elementService = {
  getAll: () => api.get("/api/elements/"),
  getById: (id) => api.get(`/api/elements/${id}`),
  create: (data) => api.post("/api/elements/", data),
  getBySymbol: (symbol) => api.get(`/api/elements/symbol/${symbol}`),
};

// ---------------- Patents ----------------
export const patentService = {
  getAll: (skip = 0, limit = 100) => api.get("/api/patents/", { params: { skip, limit } }),
  getById: (id) => api.get(`/api/patents/${id}`),
  create: (data) => api.post("/api/patents/", data),
  update: (id, data) => api.put(`/api/patents/${id}`, data),
  delete: (id) => api.delete(`/api/patents/${id}`),
  getAlloysByPatent: (patentId) => api.get(`/api/alloys/patent/${patentId}`),
};

// ---------------- Alloys ----------------
export const alloyService = {
  getAll: (skip = 0, limit = 100) => api.get("/api/alloys/", { params: { skip, limit } }),
  getById: (id) => api.get(`/api/alloys/${id}`),
  create: (data) => api.post("/api/alloys/", data),
  update: (id, data) => api.put(`/api/alloys/${id}`, data),
  delete: (id) => api.delete(`/api/alloys/${id}`),

  getElements: (alloyId) => api.get(`/api/alloys/${alloyId}/elements`),

  addElement: (alloyId, elementId, percentage) =>
    api.post(`/api/alloys/${alloyId}/elements/${elementId}`, null, { params: { percentage } }),

  // Алиас (на всякий случай)
  removeElementFromAlloy: (alloyId, elementId) => api.delete(`/api/alloys/${alloyId}/elements/${elementId}`),
  removeElement: (alloyId, elementId) => api.delete(`/api/alloys/${alloyId}/elements/${elementId}`),

  searchByCategory: (category) => api.get(`/api/alloys/category/${category}`),
  getByPatent: (patentId) => api.get(`/api/alloys/patent/${patentId}`),

  createWithElements: async (alloyData, elements = []) => {
    const createRes = await api.post("/api/alloys/", alloyData);
    const created = createRes.data;

    if (!created || created.id == null) {
      throw new Error("Backend не вернул id созданного сплава");
    }

    const alloyId = created.id;

    const items = (elements || [])
      .filter((el) => el && el.element_id != null)
      .map((el) => ({
        element_id: parseInt(el.element_id, 10),
        percentage: parseFloat(el.percentage),
      }))
      .filter((el) => Number.isFinite(el.element_id) && Number.isFinite(el.percentage));

    for (const el of items) {
      await api.post(`/api/alloys/${alloyId}/elements/${el.element_id}`, null, {
        params: { percentage: el.percentage },
      });
    }

    return created;
  },
};

// ---------------- Models ----------------
export const modelService = {
  getAll: () => api.get("/api/models/"),
  getById: (id) => api.get(`/api/models/${id}`),
  create: (data) => api.post("/api/models/", data),
  delete: (id) => api.delete(`/api/models/${id}`),
  getPredictions: (modelId) => api.get(`/api/models/${modelId}/predictions`),
};

// ---------------- Predictions ----------------
export const predictionService = {
  getAll: (skip = 0, limit = 100) => api.get("/api/predictions/", { params: { skip, limit } }),
  getById: (id) => api.get(`/api/predictions/${id}`),
  create: (data) => api.post("/api/predictions/", data),
  update: (id, data) => api.put(`/api/predictions/by_id/${id}`, data),
  delete: (id) => api.delete(`/api/predictions/${id}`),

  getElements: (predictionId) => api.get(`/api/predictions/${predictionId}/elements`),

  addElementToPrediction: (predictionId, elementId, percentage) =>
    api.post(`/api/predictions/${predictionId}/elements/${elementId}/percentage`, null, {
      params: { percentage },
    }),

  removeElementFromPrediction: (predictionId, elementId) =>
    api.delete(`/api/predictions/${predictionId}/elements/${elementId}`),

  // Алиасы для совместимости
  addElement: (predictionId, elementId, percentage) =>
    api.post(`/api/predictions/${predictionId}/elements/${elementId}/percentage`, null, {
      params: { percentage },
    }),

  removeElement: (predictionId, elementId) =>
    api.delete(`/api/predictions/${predictionId}/elements/${elementId}`),

  createWithElements: async (predictionData, elements = []) => {
    const createRes = await api.post("/api/predictions/", predictionData);
    const created = createRes.data;

    let predictionId;
    if (created && created.id) {
      predictionId = created.id;
    } else if (createRes.headers && createRes.headers.location) {
      const match = createRes.headers.location.match(/\/predictions\/(\d+)/);
      if (match) predictionId = parseInt(match[1], 10);
    }

    if (!predictionId) {
      throw new Error("Не удалось получить ID созданного прогноза");
    }

    const items = (elements || [])
      .filter((el) => el && el.element_id != null)
      .map((el) => ({
        element_id: parseInt(el.element_id, 10),
        percentage: parseFloat(el.percentage),
      }))
      .filter((el) => Number.isFinite(el.element_id) && Number.isFinite(el.percentage));

    for (const el of items) {
      await api.post(`/api/predictions/${predictionId}/elements/${el.element_id}/percentage`, null, {
        params: { percentage: el.percentage },
      });
    }

    return { ...created, id: predictionId };
  },

  getByPerson: (personId) => api.get(`/api/predictions/person/${personId}`),
  getByElement: (elementId) => api.get(`/api/predictions/element/${elementId}`),
  getByModel: (modelId) => api.get(`/api/models/${modelId}/predictions`),
};

// ---------------- Admin ----------------
export const adminService = {
  grantRoleToOrganization: (data) => api.post("/api/admin/grant_role", data),
};

// ---------------- Persons / Users ----------------
export const personService = {
  getAll: (skip = 0, limit = 100) => api.get("/api/persons/", { params: { skip, limit } }),
  getById: (id) => api.get(`/api/persons/id/${id}`),
  getByLogin: (login) => api.get(`/api/persons/login/${encodeURIComponent(login)}`),
  getPasswordByLogin: (login) => api.get(`/api/persons/login_password/${encodeURIComponent(login)}`),
  getIdByLogin: (login) => api.get(`/api/persons/login_id/${encodeURIComponent(login)}`),
  create: (data) => api.post("/api/persons/", data),
  update: (id, data) => api.put(`/api/persons/${id}`, data),
  delete: (id) => api.delete(`/api/persons/${id}`),
  getByRole: (roleId) => api.get(`/api/persons/role/${roleId}`),
};

// ---------------- Roles ----------------
export const roleService = {
  getAll: () => api.get("/api/roles/"),
  getById: (id) => api.get(`/api/roles/${id}`),
  create: (data) => api.post("/api/roles/", data),
  delete: (id) => api.delete(`/api/roles/${id}`),
};

// ---------------- Authentication ----------------
export const authService = {
  login: async (login, password) => {
    try {
      const personRes = await personService.getByLogin(login);
      const person = personRes.data;
      if (!person) throw new Error("Пользователь не найден");

      const passwordRes = await personService.getPasswordByLogin(login);
      const storedPassword = passwordRes.data;
      if (password !== storedPassword) throw new Error("Неверный пароль");

      const roleRes = await roleService.getById(person.role_id);
      const role = roleRes.data;

      return {
        success: true,
        user: {
          id: person.id,
          login: person.login,
          firstName: person.first_name,
          lastName: person.last_name,
          role: role.name,
          organization: person.organization,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || error.message || "Ошибка аутентификации",
      };
    }
  },

  register: (data) => personService.create(data),

  logout: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return { success: true };
  },
};

// ---------------- ML ----------------
export const mlService = {
  predict: (data) => api.post("/api/ml/predict", data),
};

// ---------------- Statistics ----------------
export const statsService = {
  getAlloyCount: async () => {
    const res = await alloyService.getAll();
    return res.data?.length || 0;
  },

  getPredictionCount: async () => {
    const res = await predictionService.getAll();
    return res.data?.length || 0;
  },

  getPatentCount: async () => {
    const res = await patentService.getAll();
    return res.data?.length || 0;
  },

  getRecentAlloys: async (limit = 5) => {
    const res = await alloyService.getAll(0, limit);
    return (res.data || []).sort((a, b) => b.id - a.id);
  },

  getRecentPredictions: async (limit = 5) => {
    const res = await predictionService.getAll(0, limit);
    return (res.data || []).sort((a, b) => b.id - a.id);
  },
};

// Экспорт всех сервисов для удобства
export default {
  api,
  elementService,
  patentService,
  alloyService,
  modelService,
  predictionService,
  adminService,
  personService,
  roleService,
  authService,
  mlService,
  statsService,
};
