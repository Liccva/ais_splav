from sqlalchemy.orm import Session
from typing import List, Optional, Type
from application.models.dao import *
import functools
import traceback
from typing import TypeVar, Any

T = TypeVar('T')

def dbexception(db_func):
    """Функция-декоратор для перехвата исключений БД."""
    @functools.wraps(db_func)
    def decorated_func(db: Session, *args, **kwargs) -> Any:
        try:
            result = db_func(db, *args, **kwargs)
            if should_commit(db_func):
                db.commit()
            return result
        except Exception:
            print(f"Exception in {db_func.__name__}: {traceback.format_exc()}")
            db.rollback()
            # ВСЕ функции сервиса при ошибке возвращают None,
            # чтобы роут мог понять "неудача"
            return None

    def should_commit(func) -> bool:
        return func.__name__.startswith(("create", "update", "delete", "add"))

    return decorated_func


@dbexception
def create_alloy(db: Session, prop_value: float, category: str, rolling_type: str, patent_id: int) -> Alloy:
    alloy = Alloy(
        prop_value=prop_value,
        category=category,
        rolling_type=rolling_type,
        patent_id=patent_id,
    )
    db.add(alloy)
    db.flush()
    db.refresh(alloy)
    return alloy


#@dbexception
def add_element_to_alloy(db: Session, alloy_id: int, element_id: int, percentage: float):
    """Добавляет связь между сплавом и химическим элементом с указанием процентного содержания"""

    # Проверяем существование сплава и элемента через ORM
    alloy = db.query(Alloy).filter(Alloy.id == alloy_id).first()
    if not alloy:
        raise ValueError(f"Alloy with id {alloy_id} not found")

    element = db.query(ChemicalElement).filter(ChemicalElement.id == element_id).first()
    if not element:
        raise ValueError(f"Element with id {element_id} not found")

    # Проверяем валидность процента
    if percentage <= 0 or percentage > 100:
        raise ValueError("Percentage must be between 0 and 100")

    # Проверяем существование связи через ORM
    existing = db.execute(
        alloy_element_association.select().where(
            (alloy_element_association.c.alloy_id == alloy_id) &
            (alloy_element_association.c.element_id == element_id)
        )
    ).first()

    if existing:
        raise ValueError("This element is already added to the alloy")

    # Создаем новую связь
    try:
        stmt = alloy_element_association.insert().values(
            alloy_id=alloy_id,
            element_id=element_id,
            percentage=percentage
        )

        db.execute(stmt)
        db.commit()

        # Возвращаем созданную запись
        new_record = db.execute(
            alloy_element_association.select().where(
                (alloy_element_association.c.alloy_id == alloy_id) &
                (alloy_element_association.c.element_id == element_id)
            )
        ).first()

        return new_record

    except Exception as e:
        db.rollback()
        # Преобразуем ЛЮБУЮ ошибку БД в ValueError
        raise ValueError(f"Database error: {str(e)}")

def add_element_to_alloy(db: Session, alloy_id: int, element_id: int, percentage: float):
    """Добавляет связь между сплавом и химическим элементом с указанием процентного содержания"""

    # Проверяем существование сплава и элемента через ORM
    alloy = db.query(Alloy).filter(Alloy.id == alloy_id).first()
    if not alloy:
        raise ValueError(f"Alloy with id {alloy_id} not found")

    element = db.query(ChemicalElement).filter(ChemicalElement.id == element_id).first()
    if not element:
        raise ValueError(f"Element with id {element_id} not found")

    # Проверяем валидность процента
    if percentage <= 0 or percentage > 100:
        raise ValueError("Percentage must be between 0 and 100")

    # Проверяем существование связи через ORM
    existing = db.execute(
        alloy_element_association.select().where(
            (alloy_element_association.c.alloy_id == alloy_id) &
            (alloy_element_association.c.element_id == element_id)
        )
    ).first()

    if existing:
        raise ValueError("This element is already added to the alloy")

    # Создаем новую связь
    try:
        stmt = alloy_element_association.insert().values(
            alloy_id=alloy_id,
            element_id=element_id,
            percentage=percentage
        )

        db.execute(stmt)
        db.commit()

        # Возвращаем созданную запись
        new_record = db.execute(
            alloy_element_association.select().where(
                (alloy_element_association.c.alloy_id == alloy_id) &
                (alloy_element_association.c.element_id == element_id)
            )
        ).first()

        return new_record

    except Exception as e:
        db.rollback()
        # Преобразуем ЛЮБУЮ ошибку БД в ValueError
        raise ValueError(f"Database error: {str(e)}")


# @dbexception
def remove_element_from_alloy(db: Session, alloy_id: int, element_id: int):
    """Удаляет связь между сплавом и химическим элементом"""

    # Проверяем существование сплава и элемента через ORM
    alloy = db.query(Alloy).filter(Alloy.id == alloy_id).first()
    if not alloy:
        raise ValueError(f"Alloy with id {alloy_id} not found")

    element = db.query(ChemicalElement).filter(ChemicalElement.id == element_id).first()
    if not element:
        raise ValueError(f"Element with id {element_id} not found")

    # Проверяем существование связи
    existing = db.execute(
        alloy_element_association.select().where(
            (alloy_element_association.c.alloy_id == alloy_id) &
            (alloy_element_association.c.element_id == element_id)
        )
    ).first()

    if not existing:
        raise ValueError(f"Element {element_id} is not associated with alloy {alloy_id}")

    # Удаляем связь
    try:
        stmt = alloy_element_association.delete().where(
            (alloy_element_association.c.alloy_id == alloy_id) &
            (alloy_element_association.c.element_id == element_id)
        )

        result = db.execute(stmt)
        db.commit()

        if result.rowcount == 0:
            # На случай, если запись была удалена параллельным процессом
            raise ValueError(f"Association not found or already deleted")

    except Exception as e:
        db.rollback()
        # Преобразуем ЛЮБУЮ ошибку БД в ValueError
        raise ValueError(f"Database error: {str(e)}")



def add_element_to_prediction(db: Session, prediction_id: int, element_id: int, percentage: float):
    """Добавляет связь между прогнозом и химическим элементом с указанием процентного содержания"""
    # Проверяем существование сплава и элемента через ORM
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise ValueError(f"Prediction with id {prediction_id} not found")

    element = db.query(ChemicalElement).filter(ChemicalElement.id == element_id).first()
    if not element:
        raise ValueError(f"Element with id {element_id} not found")

    # Проверяем валидность процента
    if percentage <= 0 or percentage > 100:
        raise ValueError("Percentage must be between 0 and 100")

    # Проверяем существование связи через ORM
    existing = db.execute(
        prediction_element_association.select().where(
            (prediction_element_association.c.prediction_id == prediction_id) &
            (prediction_element_association.c.element_id == element_id)
        )
    ).first()

    if existing:
        raise ValueError("This element is already added to the prediction")

    # Создаем новую связь
    try:
        stmt = prediction_element_association.insert().values(
            prediction_id=prediction_id,
            element_id=element_id,
            percentage=percentage
        )

        db.execute(stmt)
        db.commit()

        # Исправляем запрос для получения созданной записи:
        new_record = db.execute(
            prediction_element_association.select().where(
                (prediction_element_association.c.prediction_id == prediction_id) &  # ← исправлено
                (prediction_element_association.c.element_id == element_id)
            )
        ).first()

        return new_record

    except Exception as e:
        db.rollback()
        raise ValueError(f"Database error: {str(e)}")

def add_element_to_alloy(db: Session, alloy_id: int, element_id: int, percentage: float):
    """Добавляет связь между сплавом и химическим элементом с указанием процентного содержания"""

    # Проверяем существование сплава и элемента через ORM
    alloy = db.query(Alloy).filter(Alloy.id == alloy_id).first()
    if not alloy:
        raise ValueError(f"Alloy with id {alloy_id} not found")

    element = db.query(ChemicalElement).filter(ChemicalElement.id == element_id).first()
    if not element:
        raise ValueError(f"Element with id {element_id} not found")

    # Проверяем валидность процента
    if percentage <= 0 or percentage > 100:
        raise ValueError("Percentage must be between 0 and 100")

    # Проверяем существование связи через ORM
    existing = db.execute(
        alloy_element_association.select().where(
            (alloy_element_association.c.alloy_id == alloy_id) &
            (alloy_element_association.c.element_id == element_id)
        )
    ).first()

    if existing:
        raise ValueError("This element is already added to the alloy")

    # Создаем новую связь
    try:
        stmt = alloy_element_association.insert().values(
            alloy_id=alloy_id,
            element_id=element_id,
            percentage=percentage
        )

        db.execute(stmt)
        db.commit()

        # Возвращаем созданную запись
        new_record = db.execute(
            alloy_element_association.select().where(
                (alloy_element_association.c.alloy_id == alloy_id) &
                (alloy_element_association.c.element_id == element_id)
            )
        ).first()

        return new_record

    except Exception as e:
        db.rollback()
        # Преобразуем ЛЮБУЮ ошибку БД в ValueError
        raise ValueError(f"Database error: {str(e)}")


#@dbexception  # Раскомментируйте если декоратор нужен
def remove_element_from_prediction(db: Session, prediction_id: int, element_id: int):
    """Удаляет связь между прогнозом и химическим элементом"""

    # 1. Проверяем существование прогноза
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if not prediction:
        raise ValueError(f"Prediction with id {prediction_id} not found")

    # 2. Проверяем существование элемента
    element = db.query(ChemicalElement).filter(ChemicalElement.id == element_id).first()
    if not element:
        raise ValueError(f"Element with id {element_id} not found")

    # 3. Проверяем существование связи в таблице ассоциации
    existing = db.execute(
        prediction_element_association.select().where(
            (prediction_element_association.c.prediction_id == prediction_id) &
            (prediction_element_association.c.element_id == element_id)
        )
    ).first()

    if not existing:
        raise ValueError(f"Element {element_id} is not associated with prediction {prediction_id}")

    # 4. Удаляем связь
    try:
        stmt = prediction_element_association.delete().where(
            (prediction_element_association.c.prediction_id == prediction_id) &
            (prediction_element_association.c.element_id == element_id)
        )

        result = db.execute(stmt)
        db.commit()

        if result.rowcount == 0:
            # На случай, если запись была удалена параллельным процессом
            raise ValueError(f"Association not found or already deleted")

        return True  # Успешное удаление

    except Exception as e:
        db.rollback()
        raise ValueError(f"Database error: {str(e)}")


@dbexception
def get_alloy_by_id(db: Session, alloy_id: int) -> Optional[Alloy]:
    return db.query(Alloy).filter(Alloy.id == alloy_id).first()

@dbexception
def get_alloys_by_patent(db: Session, patent_id: int) -> List[Type[Alloy]]:
    return db.query(Alloy).filter(Alloy.patent_id == patent_id).all()

@dbexception
def get_all_alloys(db: Session, skip: int = 0, limit: int = 100) -> List[Type[Alloy]]:
    return db.query(Alloy).offset(skip).limit(limit).all()

@dbexception
def update_alloy(db: Session, alloy_id: int, **kwargs) -> Optional[Alloy]:
    alloy = db.query(Alloy).filter(Alloy.id == alloy_id).first()
    if alloy:
        for key, value in kwargs.items():
            if hasattr(alloy, key):
                setattr(alloy, key, value)
        db.commit()
        db.refresh(alloy)
    return alloy

@dbexception
def delete_alloy(db: Session, alloy_id: int) -> bool:
    alloy = db.query(Alloy).filter(Alloy.id == alloy_id).first()
    if alloy:
        db.delete(alloy)
        db.commit()
        return True
    return False

@dbexception
def create_prediction(db: Session, prop_value: float, category: str, ml_model_id: int,
                     rolling_type: str, person_id: int) -> Prediction:
    prediction = Prediction(
        prop_value=prop_value,
        category=category,
        ml_model_id=ml_model_id,  # Теперь используем ml_model_id вместо ml_model
        rolling_type=rolling_type,
        person_id=person_id
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)
    return prediction

@dbexception
def update_prediction(db: Session, prediction_id: int, **kwargs) -> Optional[Prediction]:
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if prediction:
        for key, value in kwargs.items():
            if hasattr(prediction, key):
                setattr(prediction, key, value)
        db.commit()
        db.refresh(prediction)
    return prediction

@dbexception
def delete_prediction(db: Session, prediction_id: int) -> bool:
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if prediction:
        db.delete(prediction)
        db.commit()
        return True
    return False

@dbexception
def get_prediction_by_id(db: Session, prediction_id: int) -> Optional[Prediction]:
    return db.query(Prediction).filter(Prediction.id == prediction_id).first()

@dbexception
def get_predictions_by_person(db: Session, person_id: int) -> List[Type[Prediction]]:
    return db.query(Prediction).filter(Prediction.person_id == person_id).all()

@dbexception
def get_predictions_by_element(db: Session, element_id: int) -> List[Type[Prediction]]:
    """Получение прогнозов по химическому элементу через ассоциативную таблицу"""
    return db.query(Prediction).join(
        prediction_element_association
    ).filter(
        prediction_element_association.c.element_id == element_id
    ).all()

@dbexception
def get_all_predictions(db: Session, skip: int = 0, limit: int = 100) -> List[Type[Prediction]]:
    return db.query(Prediction).offset(skip).limit(limit).all()

@dbexception
def create_patent(db: Session, authors_name: str, patent_name: str, description: str = None) -> Patent:
    patent = Patent(
        authors_name=authors_name,
        patent_name=patent_name,
        description=description
    )
    db.add(patent)
    db.commit()
    db.refresh(patent)
    return patent

@dbexception
def delete_patent(db: Session, patent_id: int) -> bool:
    patent = db.query(Patent).filter(Patent.id == patent_id).first()
    if patent:
        db.delete(patent)
        db.commit()
        return True
    return False
@dbexception
def get_patent_by_id(db: Session, patent_id: int) -> Optional[Patent]:
    return db.query(Patent).filter(Patent.id == patent_id).first()

@dbexception
def get_patent_by_name(db: Session, patent_name: str) -> Optional[Patent]:
    return db.query(Patent).filter(Patent.patent_name == patent_name).first()

@dbexception
def get_all_patents(db: Session, skip: int = 0, limit: int = 100) -> List[Type[Patent]]:
    return db.query(Patent).offset(skip).limit(limit).all()

@dbexception
def update_patent(db: Session, patent_id: int, **kwargs) -> Optional[Patent]:
    patent = db.query(Patent).filter(Patent.id == patent_id).first()
    if patent:
        for key, value in kwargs.items():
            if hasattr(patent, key):
                setattr(patent, key, value)
        db.commit()
        db.refresh(patent)
    return patent


@dbexception
def create_chemical_element(db: Session, name: str, atomic_number: int, symbol: str) -> Optional[ChemicalElement]:
    """Создание химического элемента с проверкой на уникальность"""
    try:
        # ВАЖНО: сначала проверяем существование
        existing_element = db.query(ChemicalElement).filter(ChemicalElement.symbol == symbol).first()
        if existing_element:
            # Возвращаем None, а не существующий элемент!
            return None

        # Создаем новый элемент
        element = ChemicalElement(
            name=name,
            atomic_number=atomic_number,
            symbol=symbol
        )
        db.add(element)
        # Не делаем commit здесь - это сделает декоратор @dbexception
        return element

    except Exception as e:
        print(f"Error in create_chemical_element: {e}")
        # Если это ошибка дубликата от БД
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return None
        # Другие ошибки - пропускаем дальше
        raise

@dbexception
def get_element_by_id(db: Session, element_id: int) -> Optional[ChemicalElement]:
    return db.query(ChemicalElement).filter(ChemicalElement.id == element_id).first()

@dbexception
def get_element_by_symbol(db: Session, symbol: str) -> Optional[ChemicalElement]:
    return db.query(ChemicalElement).filter(ChemicalElement.symbol == symbol).first()

@dbexception
def get_all_elements(db: Session) -> List[Type[ChemicalElement]]:
    return db.query(ChemicalElement).all()


@dbexception
def create_role(db: Session, name: str, description: str = None) -> Optional[Role]:
    """Создание роли с проверкой на уникальность"""
    try:
        # Проверяем, существует ли уже роль с таким именем
        existing_role = db.query(Role).filter(Role.name == name).first()
        if existing_role:
            return existing_role  # Возвращаем существующую роль вместо создания новой

        role = Role(
            name=name,
            description=description
        )
        db.add(role)
        db.commit()
        db.refresh(role)
        return role
    except Exception:
        db.rollback()
        return None

@dbexception
def delete_role(db: Session, role_id: int) -> bool:
    role = db.query(Role).filter(Role.id == role_id).first()
    if role:
        db.delete(role)
        db.commit()
        return True
    return False

@dbexception
def get_role_by_id(db: Session, role_id: int) -> Optional[Role]:
    return db.query(Role).filter(Role.id == role_id).first()

@dbexception
def get_role_by_name(db: Session, name: str) -> Optional[Role]:
    return db.query(Role).filter(Role.name == name).first()

@dbexception
def get_all_roles(db: Session) -> List[Type[Role]]:
    return db.query(Role).all()

@dbexception
def get_person_by_login(db: Session, login: str) -> Optional[Person]:
    return db.query(Person).filter(Person.login == login).first()

@dbexception
def create_person(
    db: Session,
    first_name: str,
    last_name: str,
    role_id: int,
    login: str,
    password: str,
    organization: str = None,
) -> Optional[Person]:
    person = Person(
        first_name=first_name,
        last_name=last_name,
        role_id=role_id,
        organization=organization,
        login=login,
        password=password,
    )
    db.add(person)
    db.flush()
    db.refresh(person)
    return person


@dbexception
def update_person(db: Session, person_id: int, **kwargs) -> Optional[Person]:
    # 1. Находим пользователя для обновления
    person = db.query(Person).filter(Person.id == person_id).first()
    if not person:
        return None  # Пользователь не найден

    # 2. Если пытаемся изменить логин, проверяем его уникальность
    if 'login' in kwargs and kwargs['login'] != person.login:
        # Проверяем, существует ли другой пользователь с таким логином
        existing_person = db.query(Person).filter(
            Person.login == kwargs['login'],
            Person.id != person_id  # Исключаем текущего пользователя из проверки
        ).first()

        if existing_person:
            # Возвращаем специальное значение или вызываем исключение
            # Для согласованности с декоратором возвращаем None
            return None

    # 3. Обновляем поля
    for key, value in kwargs.items():
        if hasattr(person, key):
            setattr(person, key, value)

    db.commit()
    db.refresh(person)
    return person

@dbexception
def delete_person(db: Session, person_id: int) -> bool:
    person = db.query(Person).filter(Person.id == person_id).first()
    if person:
        db.delete(person)
        db.commit()
        return True
    return False

@dbexception
def get_person_by_id(db: Session, person_id: int) -> Optional[Person]:
    return db.query(Person).filter(Person.id == person_id).first()

@dbexception
def get_persons_by_role(db: Session, role_id: int) -> List[Type[Person]]:
    return db.query(Person).filter(Person.role_id == role_id).all()

@dbexception
def get_all_persons(db: Session, skip: int = 0, limit: int = 100) -> List[Type[Person]]:
    return db.query(Person).offset(skip).limit(limit).all()

@dbexception
def get_alloys_with_details(db: Session):
    return db.query(Alloy).join(Patent).all()

@dbexception
def get_predictions_with_details(db: Session):
    return db.query(Prediction).join(Person).all()

@dbexception
def search_alloys_by_category(db: Session, category: str) -> List[Type[Alloy]]:
    return db.query(Alloy).filter(Alloy.category.ilike(f"%{category}%")).all()

def get_alloys_count(db: Session) -> int:
    return db.query(Alloy).count()

def get_chemical_element_by_symbol(db: Session, symbol: str):
    return db.query(ChemicalElement).filter(ChemicalElement.symbol == symbol).first()

def create_alloy_with_elements(db: Session, prop_value: float, category: str, rolling_type: str,
                              patent_id: int, element_percentages: dict):
    """
    Создает сплав с несколькими химическими элементами
    element_percentages: словарь {element_id: percentage, ...}
    """
    # Создаем сплав
    alloy = create_alloy(
        db,
        prop_value=prop_value,
        category=category,
        rolling_type=rolling_type,
        patent_id=patent_id
    )

    # Связываем сплав с элементами и указываем процентное содержание
    for element_id, percentage in element_percentages.items():
        percentage = min(float(percentage), 99.999)
        add_element_to_alloy(
            db,
            alloy_id=alloy.id,
            element_id=element_id,
            percentage=percentage
        )

    return alloy


def create_prediction_with_elements(db: Session, prop_value: float, category: str, ml_model_id: int,
                                   rolling_type: str, person_id: int, element_percentages: dict):
    """
    Создает прогноз с несколькими химическими элементами
    element_percentages: словарь {element_id: percentage, ...}
    """
    # Создаем прогноз
    prediction = create_prediction(
        db,
        prop_value=prop_value,
        category=category,
        ml_model_id=ml_model_id,
        rolling_type=rolling_type,
        person_id=person_id
    )

    # Связываем прогноз с элементами и указываем процентное содержание
    for element_id, percentage in element_percentages.items():
        percentage = min(float(percentage), 99.999)
        add_element_to_prediction(
            db,
            prediction_id=prediction.id,
            element_id=element_id,
            percentage=percentage
        )

    return prediction

def get_alloy_elements_with_percentages(db: Session, alloy_id: int):
    """Получает элементы сплава с их процентным содержанием"""
    alloy = db.query(Alloy).filter(Alloy.id == alloy_id).first()
    if alloy:
        elements_with_percentages = []
        for element in alloy.elements:
            # Получаем процентное содержание из ассоциативной таблицы
            assoc = db.execute(
                alloy_element_association.select().where(
                    alloy_element_association.c.alloy_id == alloy_id,
                    alloy_element_association.c.element_id == element.id
                )
            ).first()
            if assoc:
                elements_with_percentages.append({
                    'element_id': element.id,  # ← ИЗМЕНИТЬ
                    'element_name': element.name,  # ← ИЗМЕНИТЬ
                    'element_symbol': element.symbol,  # ← ИЗМЕНИТЬ
                    'element_atomic_number': element.atomic_number,  # ← ИЗМЕНИТЬ
                    'percentage': float(assoc.percentage)  # Конвертируем Decimal в float
                })
        return elements_with_percentages
    return []

def get_prediction_elements_with_percentages(db: Session, prediction_id: int):
    """Получает элементы прогноза с их процентным содержанием"""
    prediction = db.query(Prediction).filter(Prediction.id == prediction_id).first()
    if prediction:
        elements_with_percentages = []
        for element in prediction.elements:
            # Получаем процентное содержание из ассоциативной таблицы
            assoc = db.execute(
                prediction_element_association.select().where(
                    prediction_element_association.c.prediction_id == prediction_id,  # ← ИСПРАВЛЕНО
                    prediction_element_association.c.element_id == element.id
                )
            ).first()
            if assoc:
                elements_with_percentages.append({
                    'prediction_id': prediction_id,  # ← исправлено для соответствия DTO
                    'element_id': element.id,
                    'percentage': float(assoc.percentage)
                })
        return elements_with_percentages
    return []


@dbexception
def create_model(db: Session, name: str, description: str = None) -> Optional[Model]:
    """Создание ML модели с проверкой на уникальность"""
    try:
        existing_model = db.query(Model).filter(Model.name == name).first()
        if existing_model:
            return existing_model

        model = Model(
            name=name,
            description=description
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model
    except Exception:
        db.rollback()
        return None

@dbexception
def delete_model(db: Session, model_id: int) -> bool:
    model = db.query(Model).filter(Model.id == model_id).first()
    if model:
        db.delete(model)
        db.commit()
        return True
    return False


@dbexception
def get_model_by_id(db: Session, model_id: int) -> Optional[Model]:
    return db.query(Model).filter(Model.id == model_id).first()


@dbexception
def get_model_by_name(db: Session, name: str) -> Optional[Model]:
    return db.query(Model).filter(Model.name == name).first()


def get_predictions_by_model(db: Session, model_id: int) -> List[Type[Prediction]]:
    return db.query(Prediction).filter(Prediction.ml_model_id == model_id).all()


@dbexception
def get_all_models(db: Session) -> List[Type[Model]]:
    return db.query(Model).all()