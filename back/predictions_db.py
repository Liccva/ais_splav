from application.config import SessionLocal
from application.services.repository_service import *
import random
from decimal import Decimal
import hashlib
import string

# Тестовые данные
CATEGORIES = ['Сталь конструкционная', 'Сталь инструментальная', 'Чугун', 'Алюминиевый сплав', 'Медный сплав']
ROLLING_TYPES = ['Горячая', 'Холодная', 'Прессование', 'Волочение']
PATENT_AUTHORS = ['Иванов А.И.', 'Петров С.В.', 'Сидорова М.К.', 'Кузнецов Д.П.']
PATENT_NAMES = ['Способ производства высокопрочной стали',
                'Улучшенный состав нержавеющей стали',
                'Метод термообработки алюминиевых сплавов',
                'Инновационный состав медного сплава']
ORGANIZATIONS = ['Металлургический институт', 'Центр исследований сплавов',
                 'Технологический университет', 'Промышленный комбинат']

# Все химические элементы (первые 30 элементов периодической таблицы)
CHEMICAL_ELEMENTS = [
    ('Водород', 1, 'H'), ('Гелий', 2, 'He'), ('Литий', 3, 'Li'),
    ('Бериллий', 4, 'Be'), ('Бор', 5, 'B'), ('Углерод', 6, 'C'),
    ('Азот', 7, 'N'), ('Кислород', 8, 'O'), ('Фтор', 9, 'F'),
    ('Неон', 10, 'Ne'), ('Натрий', 11, 'Na'), ('Магний', 12, 'Mg'),
    ('Алюминий', 13, 'Al'), ('Кремний', 14, 'Si'), ('Фосфор', 15, 'P'),
    ('Сера', 16, 'S'), ('Хлор', 17, 'Cl'), ('Аргон', 18, 'Ar'),
    ('Калий', 19, 'K'), ('Кальций', 20, 'Ca'), ('Скандий', 21, 'Sc'),
    ('Титан', 22, 'Ti'), ('Ванадий', 23, 'V'), ('Хром', 24, 'Cr'),
    ('Марганец', 25, 'Mn'), ('Железо', 26, 'Fe'), ('Кобальт', 27, 'Co'),
    ('Никель', 28, 'Ni'), ('Медь', 29, 'Cu'), ('Цинк', 30, 'Zn')
]

ROLES = [
    ('исследователь', 'Научный сотрудник, проводящий исследования'),
    ('гость', 'Временный пользователь с ограниченными правами'),
    ('администратор', 'Администратор системы с полными правами')
]

ML_MODELS = [
    ('Random Forest', 'Ансамблевый алгоритм на основе деревьев решений'),
    ('Gradient Boosting', 'Градиентный бустинг')
]

# Простые пароли для тестовых пользователей
DEFAULT_PASSWORD = "password123"  # В реальном приложении используйте хеширование!


def hash_password(password: str) -> str:
    """Хеширование пароля для хранения в БД"""
    # В реальном приложении используйте bcrypt или подобное
    # Здесь просто для примера - MD5 (НЕ безопасно для продакшена!)
    return hashlib.md5(password.encode()).hexdigest()


def populate_chemical_elements(db: Session) -> None:
    """Заполнение таблицы химических элементов"""
    for name, atomic_number, symbol in CHEMICAL_ELEMENTS:
        existing_element = get_element_by_symbol(db, symbol)
        if not existing_element:
            element = create_chemical_element(db, name=name, atomic_number=atomic_number, symbol=symbol)
            if element:
                print(f"  Создан элемент: {symbol} - {name}")
            else:
                print(f"  Элемент {symbol} уже существует")


def populate_roles(db: Session) -> None:
    """Заполнение таблицы ролей"""
    for name, description in ROLES:
        existing_role = get_role_by_name(db, name)
        if not existing_role:
            role = create_role(db, name=name, description=description)
            if role:
                print(f"  Создана роль: {name}")
            else:
                print(f"  Роль {name} уже существует")


def populate_models(db: Session) -> None:
    """Заполнение таблицы ML моделей"""
    for name, description in ML_MODELS:
        existing_model = get_model_by_name(db, name)
        if not existing_model:
            model = create_model(db, name=name, description=description)
            if model:
                print(f"  Создана модель: {name}")
            else:
                print(f"  Модель {name} уже существует")


def populate_patents(db: Session) -> None:
    """Заполнение таблицы патентов"""
    for i in range(len(PATENT_NAMES)):
        patent = create_patent(
            db,
            authors_name=PATENT_AUTHORS[i % len(PATENT_AUTHORS)],
            patent_name=PATENT_NAMES[i],
            description=f"Описание патента для {PATENT_NAMES[i]}"
        )
        if patent:
            print(f"  Создан патент: {PATENT_NAMES[i]}")

def generate_random_login(length=8):
    """Генерирует случайный логин указанной длины"""
    # Используем буквы и цифры
    characters = string.ascii_lowercase + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

def populate_persons(db: Session) -> None:
    """Заполнение таблицы пользователей"""
    first_names = ['Алексей', 'Сергей', 'Мария', 'Дмитрий', 'Ольга', 'Иван']
    last_names = ['Иванов', 'Петров', 'Сидорова', 'Кузнецов', 'Васильева', 'Николаев']

    # Пароли для тестовых пользователей (в реальном приложении используйте хеширование!)
    passwords = ['alex123', 'sergey456', 'maria789', 'dmitry012', 'olga345', 'ivan678']

    roles = get_all_roles(db)
    if not roles:
        print("Ошибка: нет ролей для создания пользователей")
        return

    for i in range(8):
        # Создаем пароль для пользователя (в реальном приложении хешируйте!)
        password_hash = hash_password(passwords[i % len(passwords)])

        # Создаем пользователя через репозиторий (не напрямую)
        # Но сначала нужно создать функцию create_person_with_password в repository_service
        # Или используем существующую и добавляем пароль

        # ВАЖНО: обновите функцию create_person в repository_service.py
        person = create_person(
            db,
            first_name=random.choice(first_names),
            last_name=random.choice(last_names),
            role_id=roles[i % len(roles)].id,
            organization=random.choice(ORGANIZATIONS),
            login=generate_random_login(),
            password=password_hash  # Добавляем пароль
        )
        if person:
            print(f"  Создан пользователь: {person.first_name} {person.last_name}")


def populate_alloys(db: Session) -> None:
    """Заполнение таблицы сплавов"""
    elements = get_all_elements(db)
    patents = get_all_patents(db)

    if not elements:
        print("Ошибка: нет элементов для создания сплавов")
        return

    if not patents:
        print("Ошибка: нет патентов для создания сплавов")
        return

    # Основные металлы для сплавов
    main_metals = [elem for elem in elements if elem.symbol in ['Fe', 'Al', 'Cu', 'Mg', 'Ti']]
    alloying_elements = [elem for elem in elements if elem.symbol in ['C', 'Si', 'Mn', 'Cr', 'Ni', 'Zn']]

    if not main_metals:
        print("Ошибка: нет основных металлов для сплавов")
        return

    if not alloying_elements:
        print("Ошибка: нет легирующих элементов для сплавов")
        return

    alloys_created = 0
    for i in range(15):
        # Выбираем основной металл
        main_metal = random.choice(main_metals)

        # Создаем словарь элемент->процент
        element_percentages = {main_metal.id: float(round(random.uniform(85.0, 98.0), 2))}

        # Добавляем 1-3 легирующих элемента
        num_alloying = random.randint(1, 3)
        selected_alloying = random.sample(alloying_elements, min(num_alloying, len(alloying_elements)))

        remaining_percentage = 100.0 - list(element_percentages.values())[0]
        for j, element in enumerate(selected_alloying):
            if j == len(selected_alloying) - 1:
                # Последний элемент получает весь остаток
                percentage = remaining_percentage
            else:
                percentage = float(round(random.uniform(0.1, remaining_percentage * 0.7), 2))
                remaining_percentage -= percentage
            percentage = min(percentage, 99.999)
            element_percentages[element.id] = percentage

        # Создаем сплав с элементами
        try:
            alloy = create_alloy_with_elements(
                db,
                prop_value=float(round(random.uniform(10.0, 100.0), 1)),
                category=random.choice(CATEGORIES),
                rolling_type=random.choice(ROLLING_TYPES),
                patent_id=patents[i % len(patents)].id,
                element_percentages=element_percentages
            )
            if alloy:
                alloys_created += 1
                print(f"  Создан сплав #{alloy.id}")
        except Exception as e:
            print(f"  Ошибка при создании сплава: {e}")

    return alloys_created


def populate_predictions(db: Session) -> None:
    """Заполнение таблицы прогнозов"""
    alloys = get_all_alloys(db, limit=1000)  # Берем все сплавы
    persons = get_all_persons(db, limit=1000)
    models = get_all_models(db)

    if not alloys:
        print("Ошибка: нет сплавов для создания прогнозов")
        return False

    if not persons:
        print("Ошибка: нет пользователей для создания прогнозов")
        return False

    if not models:
        print("Ошибка: нет моделей для создания прогнозов")
        return False

    predictions_created = 0
    for i in range(min(25, len(alloys))):  # Не больше чем сплавов
        base_alloy = alloys[i]

        # Получаем элементы базового сплава с процентами
        base_elements = get_alloy_elements_with_percentages(db, base_alloy.id)
        element_percentages = {}
        for elem in base_elements:
            # Преобразуем Decimal в float для вычислений
            percentage = float(elem['percentage'])
            element_percentages[elem['element_id']] = percentage

        # Немного изменяем проценты для прогноза
        adjusted_percentages = {}
        for elem_id, percentage in element_percentages.items():
            # Изменяем процент на ±5%
            adjusted_percentage = max(0.1, round(percentage * random.uniform(0.95, 1.05), 2))
            adjusted_percentage = min(adjusted_percentage, 99.999)
            adjusted_percentages[elem_id] = adjusted_percentage

        # Нормализуем проценты чтобы сумма была 100
        total = sum(adjusted_percentages.values())
        if abs(total - 100.0) > 0.01:  # Проверяем с небольшой погрешностью
            for elem_id in adjusted_percentages:
                adjusted_percentages[elem_id] = round(adjusted_percentages[elem_id] * 100.0 / total, 2)

        base_value = float(base_alloy.prop_value)
        calculated_value = float(round(base_value * random.uniform(0.8, 1.2), 1))

        # Создаем прогноз с элементами
        try:
            prediction = create_prediction_with_elements(
                db,
                prop_value=calculated_value,
                category=base_alloy.category,
                ml_model_id=models[i % len(models)].id,  # Используем ID модели
                rolling_type=base_alloy.rolling_type,
                person_id=persons[i % len(persons)].id,
                element_percentages=adjusted_percentages
            )
            if prediction:
                predictions_created += 1
                print(f"  Создан прогноз #{prediction.id}")
        except Exception as e:
            print(f"  Ошибка при создании прогноза: {e}")

    return predictions_created


if __name__ == "__main__":
    print("=" * 60)
    print("Начало заполнения базы данных")
    print("=" * 60)

    with SessionLocal() as session:
        try:
            print("\n1. Заполнение химических элементов...")
            populate_chemical_elements(session)

            print("\n2. Заполнение ролей...")
            populate_roles(session)

            print("\n3. Заполнение ML моделей...")
            populate_models(session)

            print("\n4. Заполнение патентов...")
            populate_patents(session)

            print("\n5. Заполнение пользователей...")
            populate_persons(session)

            print("\n6. Заполнение сплавов...")
            alloys_count = populate_alloys(session)
            print(f"   Создано сплавов: {alloys_count}")

            print("\n7. Заполнение прогнозов...")
            predictions_count = populate_predictions(session)
            print(f"   Создано прогнозов: {predictions_count}")

            print("\n" + "=" * 60)
            print("База данных успешно заполнена!")
            print("=" * 60)

        except Exception as e:
            print(f"\n✗ Критическая ошибка: {e}")
            import traceback

            traceback.print_exc()
            session.rollback()