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

CHEMICAL_ELEMENTS = [
    {"symbol": "Fe"}, {"symbol": "Cu"}, {"symbol": "Al"},
    {"symbol": "Ti"}, {"symbol": "Ni"}, {"symbol": "Zn"},
    {"symbol": "Mg"}, {"symbol": "Ag"}
]

class GetPutOnlyUser(HttpUser):
    """
    ТОЛЬКО GET + PUT тесты для API металлических сплавов
    """
    wait_time = between(0.5, 2)  # Быстрее для GET/PUT нагрузки

    def on_start(self):
        """Инициализация пользователя"""
        self.client.get("/docs", name="GET /docs")
        print(f"GET+PUT User started: {self.host}")

    # ========== ELEMENTS: только GET ==========
    @tag("get_elements")
    @task(15)
    def get_all_elements(self):
        """GET /api/elements/"""
        with self.client.get(
            "/api/elements/",
            name="GET /api/elements/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    @tag("get_element")
    @task(10)
    def get_element_by_id(self):
        """GET /api/elements/{id}"""
        element_id = random.randint(1, 100)
        with self.client.get(
            f"/api/elements/{element_id}",
            name="GET /api/elements/{id}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    # ========== ALLOYS: GET + PUT ==========
    @tag("get_alloys")
    @task(20)
    def get_all_alloys(self):
        """GET /api/alloys/ (пагинация)"""
        skip = random.randint(0, 100)
        limit = random.randint(10, 200)
        with self.client.get(
            f"/api/alloys/?skip={skip}&limit={limit}",
            name="GET /api/alloys/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    @tag("get_alloy")
    @task(12)
    def get_alloy_by_id(self):
        """GET /api/alloys/{id}"""
        alloy_id = random.randint(1, 200)
        with self.client.get(
            f"/api/alloys/{alloy_id}",
            name="GET /api/alloys/{id}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")



    @tag("search_alloys")
    @task(6)
    def search_alloys_category(self):
        """GET /api/alloys/category/{category}"""
        category = random.choice(ALLOY_CATEGORIES)
        with self.client.get(
            f"/api/alloys/category/{category}",
            name="GET /api/alloys/category/{cat}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    # ========== PATENTS: только GET ==========
    @tag("get_patents")
    @task(10)
    def get_all_patents(self):
        """GET /api/patents/"""
        skip = random.randint(0, 50)
        limit = random.randint(5, 100)
        with self.client.get(
            f"/api/patents/?skip={skip}&limit={limit}",
            name="GET /api/patents/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    @tag("get_patent")
    @task(5)
    def get_patent_by_id(self):
        """GET /api/patents/{id}"""
        patent_id = random.randint(1, 50)
        with self.client.get(
            f"/api/patents/{patent_id}",
            name="GET /api/patents/{id}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    # ========== PREDICTIONS: только GET ==========
    @tag("get_predictions")
    @task(12)
    def get_all_predictions(self):
        """GET /api/predictions/"""
        skip = random.randint(0, 100)
        limit = random.randint(10, 200)
        with self.client.get(
            f"/api/predictions/?skip={skip}&limit={limit}",
            name="GET /api/predictions/",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    @tag("get_prediction")
    @task(6)
    def get_prediction_by_id(self):
        """GET /api/predictions/{id}"""
        prediction_id = random.randint(1, 100)
        with self.client.get(
            f"/api/predictions/{prediction_id}",
            name="GET /api/predictions/{id}",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    # ========== STRESS & VOLUME ==========
    @tag("stress")
    @task(25)
    def stress_alloy_get(self):
        """Stress: GET /api/alloys/{id}"""
        alloy_id = random.randint(1, 500)
        with self.client.get(
            f"/api/alloys/{alloy_id}",
            name="Stress GET alloy",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 404]:
                response.success()

    @tag("volume")
    @task(10)
    def volume_alloys(self):
        """Volume: GET /api/alloys/?limit=500"""
        with self.client.get(
            "/api/alloys/?skip=0&limit=500",
            name="Volume GET alloys",
            catch_response=True,
        ) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() > 3.0:
                    response.failure(f"Slow: {response.elapsed.total_seconds()}s")
                else:
                    response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    # ========== PING TESTS ==========
    @tag("ping")
    @task(5)
    def ping_elements(self):
        """HEAD /api/elements/"""
        with self.client.request(
            "HEAD", "/api/elements/",
            name="HEAD elements",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 405]:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")

    @tag("ping")
    @task(5)
    def ping_alloys(self):
        """HEAD /api/alloys/"""
        with self.client.request(
            "HEAD", "/api/alloys/",
            name="HEAD alloys",
            catch_response=True,
        ) as response:
            if response.status_code in [200, 405]:
                response.success()
            else:
                response.failure(f"Status: {response.status_code}")


# Логирование
@events.request.add_listener
def log_handler(request_type, name, response_time, response_length, exception, context, **kwargs):
    if exception:
        print(f"❌ {name}: {exception}")
    elif response_time > 2000:  # >2s
        print(f"🐌 SLOW {name}: {response_time:.0f}ms")

if __name__ == "__main__":
    import os
    print("Запуск: locust -f locust_get_put.py")
