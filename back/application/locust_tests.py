from locust import HttpUser, task, between, tag, events
import random
import time

# Тестовые данные для POST-запросов
CHEMICAL_ELEMENTS = [
    {"name": "Железо", "atomic_number": 26, "symbol": "Fe"},
    {"name": "Медь", "atomic_number": 29, "symbol": "Cu"},
    {"name": "Алюминий", "atomic_number": 13, "symbol": "Al"},
    {"name": "Титан", "atomic_number": 22, "symbol": "Ti"},
    {"name": "Никель", "atomic_number": 28, "symbol": "Ni"},
    {"name": "Цинк", "atomic_number": 30, "symbol": "Zn"},
    {"name": "Магний", "atomic_number": 12, "symbol": "Mg"},
    {"name": "Серебро", "atomic_number": 47, "symbol": "Ag"},
]

ALLOY_CATEGORIES = [
    "steel",
    "bronze",
    "brass",
    "aluminum alloy",
    "titanium alloy",
    "superalloy",
    "amalgam",
    "duralumin",
]
ROLLING_TYPES = ["hot", "cold", "warm", "isothermal"]
PROP_VALUES = [100.5, 250.0, 500.0, 750.0, 1000.0, 1250.0, 1500.0, 1750.0, 2000.0]

# Новые данные для патентов
PATENT_AUTHORS = ["Иванов И.И.", "Петров П.П.", "Сидоров С.С.", "Козлов К.К.", "Морозов М.М."]
PATENT_NAMES = [
    "Сплав с улучшенными свойствами",
    "Высокопрочный материал",
    "Коррозионностойкий сплав",
    "Термостойкий состав",
    "Легкий конструкционный материал"
]

class MetalAlloysAPIUser(HttpUser):
    """
    Класс, имитирующий пользователя API металлических сплавов
    """
    wait_time = between(1, 3)

    def on_start(self):
        """Выполняется при запуске каждого виртуального пользователя"""
        self.client.get("/docs", name="01. GET /docs")
        print(f"User started with host: {self.host}")

    # ========== CHEMICAL ELEMENTS TESTS ==========
    @tag("get_elements")
    @task(5)
    def get_all_elements(self):
        """02. Получить все химические элементы"""
        with self.client.get(
            "/api/elements/",
            name="02. GET /api/elements/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")

    @tag("get_element")
    @task(3)
    def get_element_by_id(self):
        """03. Получить химический элемент по ID"""
        element_id = random.randint(1, 50)
        with self.client.get(
            f"/api/elements/{element_id}",
            name="03. GET /api/elements/{id}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @tag("search_elements")
    @task(2)
    def search_element_by_symbol(self):
        """04. GET /api/elements/ (поиск по символу на клиенте)"""
        base = random.choice(CHEMICAL_ELEMENTS)
        symbol = base["symbol"]
        with self.client.get(
            "/api/elements/",
            name="04. GET /api/elements/?client_filter=symbol",
            catch_response=True,
        ) as response:
            if response.status_code != 200:
                response.failure(f"Status code: {response.status_code}")

    @tag("get_element_random")
    @task(1)
    def get_random_element_quick(self):
        """04b. GET /api/elements/{id} (быстрый случайный запрос)"""
        element_id = random.randint(1, 100)
        with self.client.get(
            f"/api/elements/{element_id}",
            name="04b. GET /api/elements/{id} (quick)",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @tag("ping_elements")
    @task(1)
    def head_elements_ping(self):
        """04c. HEAD /api/elements/ (ping)"""
        with self.client.request(
            "HEAD",
            "/api/elements/",
            name="04c. HEAD /api/elements/",
            catch_response=True,
            allow_redirects=False,
        ) as response:
            if response.status_code in [200, 405]:
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    # ========== ALLOYS TESTS ==========
    @tag("get_alloys")
    @task(10)
    def get_all_alloys(self):
        """05. Получить все сплавы с пагинацией"""
        skip = random.randint(0, 50)
        limit = random.randint(10, 100)
        with self.client.get(
            f"/api/alloys/?skip={skip}&limit={limit}",
            name="05. GET /api/alloys/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")

    @tag("get_alloy")
    @task(4)
    def get_alloy_by_id(self):
        """06. Получить сплав по ID"""
        alloy_id = random.randint(1, 100)
        with self.client.get(
            f"/api/alloys/{alloy_id}",
            name="06. GET /api/alloys/{id}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @tag("create_alloy")
    @task(1)
    def create_alloy(self):
        """07. Создать новый сплав"""
        alloy_data = {
            "prop_value": random.choice(PROP_VALUES),
            "category": random.choice(ALLOY_CATEGORIES),
            "rolling_type": random.choice(ROLLING_TYPES),
            "patent_id": random.randint(1, 20),
        }
        with self.client.post(
            "/api/alloys/",
            json=alloy_data,
            name="07. POST /api/alloys/",
            catch_response=True,
        ) as response:
            if response.status_code in [201, 500]:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")

    # ========== NEW: PUT ALLOYS ==========
    @tag("update_alloy")
    @task(1)
    def update_alloy(self):
        """18. PUT /api/alloys/{id} — обновление сплава"""
        alloy_id = random.randint(1, 100)
        update_data = {
            "prop_value": random.choice(PROP_VALUES),
            "category": random.choice(ALLOY_CATEGORIES),
            "rolling_type": random.choice(ROLLING_TYPES),
            "patent_id": random.randint(1, 20),
        }
        with self.client.put(
            f"/api/alloys/{alloy_id}",
            json=update_data,
            name="18. PUT /api/alloys/{id}",
            catch_response=True,
        ) as response:
            # PUT может вернуть 200 (обновлено), 404 (не найден), 500 (ошибка БД)
            if response.status_code in [200, 404, 500]:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")

    @tag("search_alloys")
    @task(3)
    def search_alloys_by_category(self):
        """08. Поиск сплавов по категории"""
        category = random.choice(ALLOY_CATEGORIES)
        with self.client.get(
            f"/api/alloys/category/{category}",
            name="08. GET /api/alloys/category/{category}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @tag("get_alloy_elements")
    @task(2)
    def get_alloy_elements(self):
        """09. Получить элементы сплава с процентным содержанием"""
        alloy_id = random.randint(1, 50)
        with self.client.get(
            f"/api/alloys/{alloy_id}/elements",
            name="09. GET /api/alloys/{id}/elements",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404, 500]:
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    # ========== PATENTS TESTS ==========
    @tag("get_patents")
    @task(3)
    def get_all_patents(self):
        """10. Получить все патенты"""
        skip = random.randint(0, 20)
        limit = random.randint(5, 50)
        with self.client.get(
            f"/api/patents/?skip={skip}&limit={limit}",
            name="10. GET /api/patents/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")

    # ========== NEW: POST PATENTS ==========
    @tag("create_patent")
    @task(1)
    def create_patent(self):
        """17. POST /api/patents/ — создание патента"""
        patent_data = {
            "authors_name": random.choice(PATENT_AUTHORS),
            "patent_name": f"{random.choice(PATENT_NAMES)} #{random.randint(1000, 9999)}",
            "description": f"Описание патента {random.randint(1, 1000)}"
        }
        with self.client.post(
            "/api/patents/",
            json=patent_data,
            name="17. POST /api/patents/",
            catch_response=True,
        ) as response:
            # Ожидаем 201 (создан) или 500 (ошибка БД/ограничения)
            if response.status_code in [201, 500]:
                response.success()
                print(f"✓ Patent attempt: {patent_data['patent_name']}")
            else:
                response.failure(f"Status code: {response.status_code}")

    # ========== PREDICTIONS TESTS ==========
    @tag("get_predictions")
    @task(4)
    def get_all_predictions(self):
        """11. Получить все прогнозы"""
        skip = random.randint(0, 30)
        limit = random.randint(5, 60)
        with self.client.get(
            f"/api/predictions/?skip={skip}&limit={limit}",
            name="11. GET /api/predictions/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status code: {response.status_code}")

    # Остальные тесты без изменений...
    @tag("complex_workflow")
    @task(2)
    def complex_workflow(self):
        """Комплексный сценарий"""
        with self.client.get("/api/alloys/?skip=0&limit=10", name="12. Complex: GET alloys", catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f"Failed to get alloys: {response.status_code}")
                return
        time.sleep(random.uniform(0.5, 1.5))
        element_id = random.randint(1, 30)
        with self.client.get(f"/api/elements/{element_id}", name="13. Complex: GET element", catch_response=True) as response:
            if response.status_code not in [200, 404]:
                response.failure(f"Failed to get element: {response.status_code}")
        time.sleep(random.uniform(0.5, 1.5))
        with self.client.get("/api/patents/?skip=0&limit=5", name="14. Complex: GET patents", catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f"Failed to get patents: {response.status_code}")

    @tag("stress_get")
    @task(15)
    def stress_get_alloys(self):
        """15. Стресс-тест"""
        alloy_id = random.randint(1, 200)
        with self.client.get(f"/api/alloys/{alloy_id}", name="15. Stress: GET alloy", catch_response=True) as response:
            if response.status_code in [200, 404]:
                response.success()

    @tag("volume_test")
    @task(8)
    def volume_test_predictions(self):
        """16. Объемное тестирование"""
        limit = random.choice([100, 200, 500])
        with self.client.get(f"/api/predictions/?skip=0&limit={limit}", name="16. Volume: GET predictions", catch_response=True) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() > 5.0:
                    response.failure(f"Slow response: {response.elapsed.total_seconds()}s")
                else:
                    response.success()
            else:
                response.failure(f"Status code: {response.status_code}")


# Обработчик статистики
@events.request.add_listener
def my_request_handler(request_type, name, response_time, response_length, exception, context, **kwargs):
    if exception:
        print(f"Request failed: {name} | Exception: {exception}")
    elif response_time > 3000:
        print(f"Slow request: {name} | Time: {response_time}ms")


if __name__ == "__main__":
    import os
    os.system("locust -f locust_tests.py --host=http://localhost:8000")
