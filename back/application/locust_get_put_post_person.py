from locust import HttpUser, task, between, tag, events
import random
import time

# Тестовые данные
ALLOY_CATEGORIES = [
    "steel", "bronze", "brass", "aluminum alloy",
    "titanium alloy", "superalloy", "amalgam", "duralumin"
]
ROLLING_TYPES = ["hot", "cold", "warm", "isothermal"]
PROP_VALUES = [100.5, 250.0, 500.0, 750.0, 1000.0, 1250.0, 1500.0, 1750.0, 2000.0]

FIRST_NAMES = ["Иван", "Пётр", "Анна", "Мария", "Сергей", "Ольга"]
LAST_NAMES = ["Иванов", "Петров", "Сидоров", "Кузнецов", "Смирнов", "Попова"]
ORGANIZATIONS = ["АО МетИнвест", "НИИ Сплавов", "УЗТИ", "БГТУ", "УГНТУ"]

class GetPutPostUser(HttpUser):
    """
    GET + PUT + один POST (создание пользователя)
    """
    wait_time = between(0.5, 2)

    def on_start(self):
        self.client.get("/docs", name="GET /docs")
        print(f"GET+PUT+POST User started: {self.host}")

    # ===== ELEMENTS: GET =====
    @tag("get_elements")
    @task(12)
    def get_all_elements(self):
        with self.client.get(
            "/api/elements/",
            name="GET /api/elements/",
            catch_response=True,
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    @tag("get_element")
    @task(8)
    def get_element_by_id(self):
        element_id = random.randint(1, 100)
        with self.client.get(
            f"/api/elements/{element_id}",
            name="GET /api/elements/{id}",
            catch_response=True,
        ) as r:
            if r.status_code in [200, 404]:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    # ===== ALLOYS: GET + PUT =====
    @tag("get_alloys")
    @task(18)
    def get_all_alloys(self):
        skip = random.randint(0, 100)
        limit = random.randint(10, 200)
        with self.client.get(
            f"/api/alloys/?skip={skip}&limit={limit}",
            name="GET /api/alloys/",
            catch_response=True,
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    @tag("get_alloy")
    @task(10)
    def get_alloy_by_id(self):
        alloy_id = random.randint(1, 200)
        with self.client.get(
            f"/api/alloys/{alloy_id}",
            name="GET /api/alloys/{id}",
            catch_response=True,
        ) as r:
            if r.status_code in [200, 404]:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    @tag("search_alloys")
    @task(6)
    def search_alloys_category(self):
        category = random.choice(ALLOY_CATEGORIES)
        with self.client.get(
            f"/api/alloys/category/{category}",
            name="GET /api/alloys/category/{cat}",
            catch_response=True,
        ) as r:
            if r.status_code in [200, 404]:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    # Маленький PUT, который уже чинится в backend и не должен падать
    @tag("update_alloy")
    @task(2)
    def update_alloy(self):
        alloy_id = random.randint(1, 100)
        payload = {
            "prop_value": random.choice(PROP_VALUES),
            "category": random.choice(ALLOY_CATEGORIES),
            "rolling_type": random.choice(ROLLING_TYPES),
            "patent_id": random.randint(1, 20),
        }
        with self.client.put(
            f"/api/alloys/{alloy_id}",
            json=payload,
            name="PUT /api/alloys/{id}",
            catch_response=True,
        ) as r:
            if r.status_code in [200, 404]:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    # ===== PREDICTIONS: GET =====
    @tag("get_predictions")
    @task(10)
    def get_all_predictions(self):
        skip = random.randint(0, 100)
        limit = random.randint(10, 200)
        with self.client.get(
            f"/api/predictions/?skip={skip}&limit={limit}",
            name="GET /api/predictions/",
            catch_response=True,
        ) as r:
            if r.status_code == 200:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    # ===== PERSONS: безопасный POST =====
    @tag("create_person")
    @task(2)
    def create_person(self):
        """
        POST /api/persons/ — создание пользователя.
        Backend:
          - 201 + message при успехе
          - 409 если такой login уже есть
          - 500 при ошибке БД
        Ограничение: login VARCHAR(20), поэтому делаем короткий логин.
        """
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)

        # Короткий уникальный логин: 'lt' + 6 случайных цифр => 8 символов <= 20
        login_suffix = random.randint(100000, 999999)
        login = f"lt{login_suffix}"

        payload = {
            "first_name": first,
            "last_name": last,
            "role_id": 1,  # предполагаем, что роль с id=1 существует
            "organization": random.choice(ORGANIZATIONS),
            "login": login,
            "password": "Test1234!",
        }

        with self.client.post(
                "/api/persons/",
                json=payload,
                name="POST /api/persons/",
                catch_response=True,
        ) as r:
            # 201 — успешно создан, 409 — логин уже занят (ожидаемо под нагрузкой)
            if r.status_code in [201, 409]:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}, body={r.text}")


    # ===== PING (HEAD) =====
    @tag("ping")
    @task(5)
    def ping_elements(self):
        with self.client.request(
            "HEAD",
            "/api/elements/",
            name="HEAD /api/elements/",
            catch_response=True,
        ) as r:
            if r.status_code in [200, 405]:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

    @tag("ping")
    @task(5)
    def ping_alloys(self):
        with self.client.request(
            "HEAD",
            "/api/alloys/",
            name="HEAD /api/alloys/",
            catch_response=True,
        ) as r:
            if r.status_code in [200, 405]:
                r.success()
            else:
                r.failure(f"Status: {r.status_code}")

# Логирование медленных/упавших запросов
@events.request.add_listener
def log_handler(request_type, name, response_time, response_length, exception, context, **kwargs):
    if exception:
        print(f"❌ {name}: {exception}")
    elif response_time > 2000:
        print(f"🐌 SLOW {name}: {response_time:.0f}ms")

if __name__ == "__main__":
    print("Запуск: locust -f locust_get_put_post_person.py --host=http://localhost:8000")
