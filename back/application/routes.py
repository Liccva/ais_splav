from fastapi import APIRouter, HTTPException, Depends, status
from starlette.responses import RedirectResponse
from application.models.dto import *
from application.services import repository_service as service
from sqlalchemy.orm import Session
from application.config import SessionLocal
from typing import List
from pydantic import BaseModel
from fastapi import Body
from application.services.ml_inference import MLInference

"""

    Данный модуль отвечает за маршрутизацию доступных API URI (endpoints) сервера

"""

router = APIRouter(prefix='/api', tags=['Metal Alloys API'])

def get_db() -> Session:
    """
    Context manager для безопасной работы с БД
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@router.get('/')
async def root():
    """ Переадресация на страницу Swagger """
    return RedirectResponse(url='/docs', status_code=307)

# Chemical Elements Routes
@router.get('/elements/', response_model=List[ChemicalElementDTO])
async def get_all_elements(db: Session = Depends(get_db)):
    """Получить все химические элементы"""
    try:
        elements = service.get_all_elements(db)
        if not elements:
            raise HTTPException(status_code=404, detail="No elements found")
        return elements
    except Exception as e:
        # НЕ закрываем сессию здесь - это сделает FastAPI
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get('/elements/{element_id}', response_model=ChemicalElementDTO)
async def get_element_by_id(element_id: int, db: Session = Depends(get_db)):
    """Получить химический элемент по ID"""
    element = service.get_element_by_id(db, element_id)
    if element is None:
        raise HTTPException(status_code=404, detail="Element not found")
    return element


@router.post('/elements/', status_code=201)
async def create_element(element: ChemicalElementCreateDTO, db: Session = Depends(get_db)):
    """Создать новый химический элемент"""
    try:
        # 1. Проверяем существование
        existing_element = service.get_element_by_symbol(db, element.symbol)
        if existing_element:
            # Для нагрузочных тестов обычно достаточно 409
            raise HTTPException(
                status_code=409,
                detail=f"Element with symbol '{element.symbol}' already exists"
            )

        # 2. Пытаемся создать
        result = service.create_chemical_element(
            db,
            name=element.name,
            atomic_number=element.atomic_number,
            symbol=element.symbol,
        )

        # 3. Проверяем результат
        if result is None:
            # Повторная проверка на случай гонки
            final_check = service.get_element_by_symbol(db, element.symbol)
            if final_check:
                raise HTTPException(
                    status_code=409,
                    detail=f"Element with symbol '{element.symbol}' already exists"
                )
            # Если всё равно None – считаем это ошибкой БД
            raise HTTPException(
                status_code=500,
                detail="Failed to create element due to database error",
            )

        # 4. Успешное создание
        return {
            "message": "Chemical element created successfully",
            "id": result.id,
            "symbol": result.symbol,
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Unexpected error in create_element: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)[:100]}",
        )



# Alloys Routes
@router.get('/alloys/', response_model=List[AlloyDTO])
async def get_all_alloys(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Получить все сплавы"""
    alloys = service.get_all_alloys(db, skip, limit)
    # БЫЛО:
    # if not alloys:
    #     raise HTTPException(status_code=404, detail="No alloys found")
    # return alloys

    # СТАЛО: всегда 200 и список (возможно пустой)
    return alloys or []


@router.get('/alloys/{alloy_id}', response_model=AlloyDTO)
async def get_alloy_by_id(alloy_id: int, db: Session = Depends(get_db)):
    """Получить сплав по ID"""
    alloy = service.get_alloy_by_id(db, alloy_id)
    if alloy is None:
        raise HTTPException(status_code=404, detail="Alloy not found")
    return alloy

@router.post('/alloys/', status_code=201)
async def create_alloy(alloy: AlloyCreateDTO, db: Session = Depends(get_db)):
    """Создать новый сплав"""
    result = service.create_alloy(
        db,
        prop_value=alloy.prop_value,
        category=alloy.category,
        rolling_type=alloy.rolling_type,
        patent_id=alloy.patent_id
    )
    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Can't create alloy",
        )
    return result

@router.put('/alloys/{alloy_id}', response_model=AlloyDTO)
async def update_alloy(alloy_id: int, alloy: AlloyUpdateDTO, db: Session = Depends(get_db)):
    """Обновить сплав"""
    result = service.update_alloy(
        db,
        alloy_id,
        prop_value=alloy.prop_value,
        category=alloy.category,
        rolling_type=alloy.rolling_type,
        patent_id=alloy.patent_id,
    )

    # После декоратора result либо Alloy, либо None
    if result is None:
        raise HTTPException(status_code=404, detail="Alloy not found or update failed")

    return result

@router.delete('/alloys/{alloy_id}', status_code=200)
async def delete_alloy(alloy_id: int, db: Session = Depends(get_db)):
    """Удалить сплав"""
    if not service.delete_alloy(db, alloy_id):
        raise HTTPException(status_code=404, detail="Alloy not found")
    return {"message": "Alloy deleted successfully"}

@router.get('/alloys/patent/{patent_id}', response_model=List[AlloyDTO])
async def get_alloys_by_patent(patent_id: int, db: Session = Depends(get_db)):
    """Получить сплавы по патенту"""
    alloys = service.get_alloys_by_patent(db, patent_id)
    if not alloys:
        raise HTTPException(status_code=404, detail="No alloys found for this patent")
    return alloys

@router.get('/alloys/category/{category}', response_model=List[AlloyDTO])
async def search_alloys_by_category(category: str, db: Session = Depends(get_db)):
    """Поиск сплавов по категории"""
    alloys = service.search_alloys_by_category(db, category)
    if not alloys:
        raise HTTPException(status_code=404, detail="No alloys found in this category")
    return alloys

# Alloy-Element Association Routes
@router.post('/alloys/{alloy_id}/elements/{element_id}', status_code=201, response_model=AlloyElementAssociationDTO)
async def add_element_to_alloy(
        alloy_id: int,
        element_id: int,
        percentage: float,
        db: Session = Depends(get_db)
):
    """Добавить элемент к сплаву с процентным содержанием"""
    try:
        result = service.add_element_to_alloy(
            db,
            alloy_id,
            element_id,
            percentage
        )

        return AlloyElementAssociationDTO(
            alloy_id=result.alloy_id,
            element_id=result.element_id,
            percentage=result.percentage
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Unexpected error type: {type(e).__name__}, message: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete('/alloys/{alloy_id}/elements/{element_id}', status_code=204)
async def remove_element_from_alloy(
        alloy_id: int,
        element_id: int,
        db: Session = Depends(get_db)
):
    """Удалить элемент из сплава"""
    try:
        service.remove_element_from_alloy(db, alloy_id, element_id)
        return None  # 204 No Content
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Unexpected error type: {type(e).__name__}, message: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get('/alloys/{alloy_id}/elements', response_model=List[AlloyElementResponseDTO])
async def get_alloy_elements(alloy_id: int, db: Session = Depends(get_db)):
    """Получить элементы сплава с процентным содержанием"""
    try:
        elements = service.get_alloy_elements_with_percentages(db, alloy_id)
        if not elements:
            raise HTTPException(status_code=404, detail="No elements found for this alloy")
        return elements
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Predictions Routes
@router.get('/predictions/', response_model=List[PredictionDTO])
async def get_all_predictions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Получить все прогнозы"""
    predictions = service.get_all_predictions(db, skip, limit)
    # БЫЛО:
    # if not predictions:
    #     raise HTTPException(status_code=404, detail="No predictions found")
    # return predictions

    # СТАЛО:
    return predictions or []


@router.get('/predictions/{prediction_id}', response_model=PredictionDTO)
async def get_prediction_by_id(prediction_id: int, db: Session = Depends(get_db)):
    """Получить прогноз по ID"""
    prediction = service.get_prediction_by_id(db, prediction_id)
    if prediction is None:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return prediction

@router.post('/predictions/', status_code=201)
async def create_prediction(prediction: PredictionCreateDTO, db: Session = Depends(get_db)):
    """Создать новый прогноз"""
    result = service.create_prediction(
        db,
        prop_value=prediction.prop_value,
        category=prediction.category,
        ml_model_id=prediction.ml_model_id,
        rolling_type=prediction.rolling_type,
        person_id=prediction.person_id
    )
    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Can't create prediction",
        )
    return {"message": "Prediction created successfully"}

@router.put('/predictions/by_id/{prediction_id}', response_model=PredictionCreateDTO)
async def update_prediction(prediction_id: int, prediction: PredictionCreateDTO, db: Session = Depends(get_db)):
    """Обновить предсказание"""
    result = service.update_prediction(
        db,
        prediction_id,
        prop_value=prediction.prop_value,
        category=prediction.category,
        ml_model_id=prediction.ml_model_id,
        rolling_type=prediction.rolling_type
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return result

@router.delete('/predictions/{prediction_id}', status_code=200,  responses={
        404: {"description": "Prediction not found"}
    })
async def delete_prediction(prediction_id: int, db: Session = Depends(get_db)):
    """Удалить прогноз"""
    if not service.delete_prediction(db, prediction_id):
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {"message": "Prediction deleted successfully"}

@router.post('/predictions/{prediction_id}/elements/{element_id}/percentage', status_code=201, response_model=PredictionElementAssociationDTO)
async def add_element_to_prediction(
        prediction_id: int,
        element_id: int,
        percentage: float,
        db: Session = Depends(get_db)
):
    """Добавить элемент к прогнозу с процентным содержанием"""
    try:
        result = service.add_element_to_prediction(
            db,
            prediction_id,
            element_id,
            percentage
        )

        # Исправляем здесь:
        return PredictionElementAssociationDTO(
            prediction_id=result.prediction_id,  # ← prediction_id вместо alloy_id
            element_id=result.element_id,
            percentage=result.percentage
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Unexpected error type: {type(e).__name__}, message: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete('/predictions/{prediction_id}/elements/{element_id}', status_code=200)
async def remove_element_from_prediction(
        prediction_id: int,
        element_id: int,
        db: Session = Depends(get_db)
):
    """Удалить элемент из прогноза"""
    try:
        service.remove_element_from_prediction(db, prediction_id, element_id)
        return {"message": f"Element {element_id} successfully removed from prediction {prediction_id}"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        print(f"Unexpected error type: {type(e).__name__}, message: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get('/predictions/{prediction_id}/elements', response_model=List[PredictionElementAssociationDTO])
async def get_prediction_elements(prediction_id: int, db: Session = Depends(get_db)):
    """Получить элементы сплава с процентным содержанием"""
    try:
        elements = service.get_prediction_elements_with_percentages(db, prediction_id)
        if not elements:
            raise HTTPException(status_code=404, detail="No elements found for this prediction")
        return elements
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get('/predictions/person/{person_id}', response_model=List[PredictionDTO])
async def get_predictions_by_person(person_id: int, db: Session = Depends(get_db)):
    """Получить прогнозы по пользователю"""
    predictions = service.get_predictions_by_person(db, person_id)
    if not predictions:
        raise HTTPException(status_code=404, detail="No predictions found for this person")
    return predictions



@router.get('/predictions/element/{element_id}', response_model=List[PredictionDTO])
async def get_predictions_by_element(element_id: int, db: Session = Depends(get_db)):
    """Получить прогнозы по химическому элементу"""
    predictions = service.get_predictions_by_element(db, element_id)
    if not predictions:
        raise HTTPException(status_code=404, detail="No predictions found for this element")
    return predictions

# Patents Routes
@router.get('/patents/', response_model=List[PatentDTO])
async def get_all_patents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Получить все патенты"""
    patents = service.get_all_patents(db, skip, limit)
    # БЫЛО:
    # if not patents:
    #     raise HTTPException(status_code=404, detail="No patents found")
    # return patents

    # СТАЛО:
    return patents or []


@router.get('/patents/{patent_id}', response_model=PatentDTO)
async def get_patent_by_id(patent_id: int, db: Session = Depends(get_db)):
    """Получить патент по ID"""
    patent = service.get_patent_by_id(db, patent_id)
    if patent is None:
        raise HTTPException(status_code=404, detail="Patent not found")
    return patent

@router.post('/patents/', status_code=201)
async def create_patent(patent: PatentCreateDTO, db: Session = Depends(get_db)):
    """Создать новый патент"""
    result = service.create_patent(
        db,
        authors_name=patent.authors_name,
        patent_name=patent.patent_name,
        description=patent.description
    )
    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Can't create patent",
        )
    return {"message": "Patent created successfully"}

@router.delete('/patents/{patent_id}', status_code=200,  responses={
        404: {"description": "Рatent not found"}
    })
async def delete_patent(patent_id: int, db: Session = Depends(get_db)):
    """Удалить патент"""
    if not service.delete_patent(db, patent_id):
        raise HTTPException(status_code=404, detail="Patent not found")
    return {"message": "Patent deleted successfully"}

@router.put('/patents/{patent_id}', response_model=PatentDTO)
async def update_patent(patent_id: int, patent: PatentCreateDTO, db: Session = Depends(get_db)):
    """Обновить патент"""
    result = service.update_patent(
        db,
        patent_id,
        authors_name=patent.authors_name,
        patent_name=patent.patent_name,
        description=patent.description
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Patent not found")
    return result

# Persons Routes
@router.get('/persons/', response_model=List[PersonDTO])
async def get_all_persons(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Получить всех пользователей"""
    persons = service.get_all_persons(db, skip, limit)
    if not persons:
        raise HTTPException(status_code=404, detail="No persons found")
    return persons

@router.get('/persons/id/{person_id}', response_model=PersonDTO)
async def get_person_by_id(person_id: int, db: Session = Depends(get_db)):
    """Получить пользователя по ID"""
    person = service.get_person_by_id(db, person_id)
    if person is None:
        raise HTTPException(status_code=404, detail="Person not found")
    return person

@router.get('/persons/login/{login}',  responses={
        409: {"description": "Person not found"}
    }, response_model=PersonDTO)
async def get_person_by_login(login: str, db: Session = Depends(get_db)):
    """Получить пользователя по логину"""
    person = service.get_person_by_login(db, login)
    if person is None:
        raise HTTPException(status_code=409, detail="Person not found")
    return person

@router.get('/persons/login_password/{login}',  responses={
        409: {"description": "Person not found"}
    })
async def get_password_by_login(login: str, db: Session = Depends(get_db)):
    """Получить пароль по логину"""
    person = service.get_person_by_login(db, login)
    if person is None:
        raise HTTPException(status_code=409, detail="Person not found")
    return person.password

@router.get('/persons/login_id/{login}',  responses={
        409: {"description": "Person not found"}
    })
async def get_id_by_login(login: str, db: Session = Depends(get_db)):
    """Получить id по логину"""
    person = service.get_person_by_login(db, login)
    if person is None:
        raise HTTPException(status_code=409, detail="Person not found")
    return person.id

@router.post('/persons/', status_code=status.HTTP_201_CREATED)
async def create_person(person: PersonCreateDTO, db: Session = Depends(get_db)):
    """Создать пользователя"""
    # 1. Проверяем существование пользователя с таким логином
    existing_person = service.get_person_by_login(db, person.login)
    if existing_person:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Person already exists"
        )

    # 2. Пытаемся создать
    result = service.create_person(
        db,
        first_name=person.first_name,
        last_name=person.last_name,
        role_id=person.role_id,
        organization=person.organization,
        login=person.login,
        password=person.password,
    )

    # 3. Обрабатываем результат
    if result is None:
        raise HTTPException(status_code=500, detail="Can't create person")

    return {"message": "Person created successfully"}



@router.put('/persons/{person_id}', response_model=PersonDTO,
            status_code=status.HTTP_200_OK,
            responses={
                404: {"description": "Person not found"},
                409: {"description": "Login already exists"}})  # Используйте PersonDTO для ответа
async def update_person(
        person_id: int,
        person: PersonCreateDTO,  # Используйте отдельный DTO для обновления
        db: Session = Depends(get_db)
):
    """Обновить пользователя"""

    # 1. Проверяем существование пользователя
    existing_person = service.get_person_by_id(db, person_id)
    if existing_person is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Person not found"
        )

    # 2. Обновляем пользователя
    result = service.update_person(
        db,
        person_id,
        **person.dict(exclude_unset=True)  # Только переданные поля
    )

    # 3. Обрабатываем результат
    if result is None:
        # result может быть None по двум причинам:
        # 1. Пользователь не найден (уже проверили выше)
        # 2. Логин уже существует
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,  # 409 Conflict для дубликата логина
            detail="Login already exists"
        )

    return result


@router.delete('/persons/{person_id}', status_code=200)
async def delete_person(person_id: int, db: Session = Depends(get_db)):
    """Удалить пользователя"""
    if not service.delete_person(db, person_id):
        raise HTTPException(status_code=404, detail="Person not found")
    return {"message": "Person deleted successfully"}


@router.get('/persons/role/{role_id}', response_model=List[PersonDTO])
async def get_persons_by_role(role_id: int, db: Session = Depends(get_db)):
    """Получить пользователей по роли"""
    persons = service.get_persons_by_role(db, role_id)
    if not persons:
        raise HTTPException(status_code=404, detail="No persons found for this role")
    return persons

# Roles Routes
@router.get('/roles/', response_model=List[RoleDTO])
async def get_all_roles(db: Session = Depends(get_db)):
    """Получить все роли"""
    roles = service.get_all_roles(db)
    if not roles:
        raise HTTPException(status_code=404, detail="No roles found")
    return roles

@router.get('/roles/{role_id}', response_model=RoleDTO)
async def get_role_by_id(role_id: int, db: Session = Depends(get_db)):
    """Получить роль по ID"""
    role = service.get_role_by_id(db, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    return role

@router.post('/roles/', status_code=201)
async def create_role(role: RoleCreateDTO, db: Session = Depends(get_db)):
    """Создать новую роль"""
    result = service.create_role(
        db,
        name=role.name,
        description=role.description
    )
    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Can't create role",
        )
    return {"message": "Role created successfully"}

@router.delete('/roles/{role_id}', status_code=200,  responses={
        404: {"description": "Role not found"}
    })
async def delete_role(role_id: int, db: Session = Depends(get_db)):
    """Удалить роль"""
    if not service.delete_role(db, role_id):
        raise HTTPException(status_code=404, detail="Role not found")
    return {"message": "Role deleted successfully"}

# Models Routes
@router.get('/models/', response_model=List[ModelDTO])
async def get_all_models(db: Session = Depends(get_db)):
    """Получить все ML модели"""
    models = service.get_all_models(db)
    if not models:
        raise HTTPException(status_code=404, detail="No models found")
    return models

@router.get('/models/{model_id}', response_model=ModelDTO)
async def get_model_by_id(model_id: int, db: Session = Depends(get_db)):
    """Получить ML модель по ID"""
    model = service.get_model_by_id(db, model_id)
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return model

@router.post('/models/', status_code=201)
async def create_model(model: ModelCreateDTO, db: Session = Depends(get_db)):
    """Создать новую ML модель"""
    result = service.create_model(
        db,
        name=model.name,
        description=model.description
    )
    if result is None:
        raise HTTPException(
            status_code=500,
            detail="Can't create model",
        )
    return {"message": "Model created successfully"}

@router.delete('/models/{model_id}', status_code=200,  responses={
        404: {"description": "Model not found"}
    })
async def delete_model(model_id: int, db: Session = Depends(get_db)):
    """Удалить модель"""
    if not service.delete_model(db, model_id):
        raise HTTPException(status_code=404, detail="Model not found")
    return {"message": "Model deleted successfully"}


@router.get('/models/{model_id}/predictions', response_model=List[PredictionDTO])
async def get_predictions_by_model(model_id: int, db: Session = Depends(get_db)):
    """Получить прогнозы по ML модели"""
    predictions = service.get_predictions_by_model(db, model_id)
    if not predictions:
        raise HTTPException(status_code=404, detail="No predictions found for this model")
    return predictions


# --- Elements: get by symbol (совпадает с elementService.getBySymbol в api.js) ---
@router.get('/elements/symbol/{symbol}', response_model=ChemicalElementDTO)
async def get_element_by_symbol(symbol: str, db: Session = Depends(get_db)):
    element = service.get_element_by_symbol(db, symbol)
    if element is None:
        raise HTTPException(status_code=404, detail="Element not found")
    return element


# --- Admin: массовая выдача роли организации ---
class GrantRoleToOrganizationDTO(BaseModel):
    organization: str
    role_id: int

@router.post('/admin/grant_role', status_code=200)
async def grant_role_to_organization(
    payload: GrantRoleToOrganizationDTO = Body(...),
    db: Session = Depends(get_db),
):
    # Берём всех пользователей и фильтруем по organization прямо здесь (без новых функций в service)
    persons = service.get_all_persons(db, skip=0, limit=100000)

    org = (payload.organization or "").strip()
    if not org:
        raise HTTPException(status_code=422, detail="organization is required")

    updated = 0
    for p in persons:
        if (getattr(p, "organization", "") or "").strip() != org:
            continue

        # service.update_person у тебя уже используется как **person.dict(...) в update_person роуте,
        # поэтому передаём только role_id (как kwargs).
        service.update_person(db, p.id, role_id=payload.role_id)
        updated += 1

    if updated == 0:
        raise HTTPException(status_code=404, detail="No persons found for this organization")

    return {"message": "Role granted successfully", "updated": updated, "organization": org, "role_id": payload.role_id}

# --- ML ---
ml_infer = MLInference()

class MLPredictElementDTO(BaseModel):
    element_id: int
    percentage: float

class MLPredictRequestDTO(BaseModel):
    ml_model_id: int
    category: str
    rolling_type: str
    size: float | None = None
    elements: list[MLPredictElementDTO] = []

@router.post("/ml/predict", status_code=200)
async def ml_predict(payload: MLPredictRequestDTO, db: Session = Depends(get_db)):
    all_elements = service.get_all_elements(db)
    id_to_symbol = {int(e.id): str(e.symbol).lower() for e in (all_elements or [])}

    composition = {}
    for it in payload.elements:
        sym = id_to_symbol.get(int(it.element_id))
        if not sym:
            continue
        composition[sym] = float(it.percentage)

    try:
        value = ml_infer.predict(
            ml_model_id=payload.ml_model_id,
            category=payload.category,
            rolling_type=payload.rolling_type,
            size=payload.size,
            composition_by_symbol=composition,
        )
        return {"prop_value": value}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML error: {str(e)}")
