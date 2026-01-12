from application.config import Base, get_engine, SessionLocal
from application.models.dao import *
from predictions_db import (
    populate_chemical_elements,
    populate_roles,
    populate_models,
    populate_patents,
    populate_persons,
    populate_alloys,
    populate_predictions
)


def create_database():
    """Создание всех таблиц в базе данных"""
    print("Создание таблиц в базе данных...")

    # Получаем движок
    engine = get_engine()

    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)
    print("Таблицы успешно созданы!")

    # Заполняем данными
    print("\nЗаполнение базы данных тестовыми данными...")
    db = SessionLocal()

    try:
        populate_chemical_elements(db)
        print("✓ Химические элементы добавлены")

        populate_roles(db)
        print("✓ Роли добавлены")

        populate_models(db)
        print("✓ ML модели добавлены")

        populate_patents(db)
        print("✓ Патенты добавлены")

        populate_persons(db)
        print("✓ Пользователи добавлены")

        populate_alloys(db)
        print("✓ Сплавов добавлено")

        populate_predictions(db)
        print("✓ Прогнозы добавлены")

        print("\nБаза данных успешно создана и заполнена!")

    except Exception as e:
        print(f"Ошибка при заполнении базы данных: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_database()mai