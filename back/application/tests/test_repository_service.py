# test_repository_service.py
import os
import sys
import unittest
from decimal import Decimal
from application.services.repository_service import *

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from application.config import SessionLocal


class TestRepositoryServiceCRUD(unittest.TestCase):

    def setUp(self):
        self.session = SessionLocal()
        self.setup_test_data()

    def setup_test_data(self):
        """Создание базовых тестовых данных"""
        try:
            # Создаем ML модели
            self.rf_model = create_model(self.session, name='RF Test', description='Ансамблевый алгоритм')
            self.nn_model = create_model(self.session, name='NN Test', description='Нейронная сеть')

            # Создаем роли
            self.researcher_role = create_role(self.session, name='research', description='Научный сотрудник')
            self.engineer_role = create_role(self.session, name='engineer', description='Инженер')

            # Создаем химические элементы с КОРОТКИМИ символами и именами
            self.fe_element = create_chemical_element(self.session, name='Железо', atomic_number=26, symbol='Fe')
            self.c_element = create_chemical_element(self.session, name='Углерод', atomic_number=6, symbol='C')
            self.si_element = create_chemical_element(self.session, name='Кремний', atomic_number=14, symbol='Si')

            # Создаем патенты
            self.patent1 = create_patent(
                self.session,
                authors_name='Иванов А.И.',
                patent_name='Патент 1',
                description='Описание патента 1'
            )
            self.patent2 = create_patent(
                self.session,
                authors_name='Петров Б.В.',
                patent_name='Патент 2',
                description='Описание патента 2'
            )

            # Создаем пользователей
            self.person1 = create_person(
                self.session,
                first_name='Тест',
                last_name='Пользователь1',
                role_id=self.researcher_role.id,
                organization='Организация 1'
            )
            self.person2 = create_person(
                self.session,
                first_name='Тест',
                last_name='Пользователь2',
                role_id=self.engineer_role.id,
                organization='Организация 2'
            )

        except Exception as e:
            self.session.rollback()
            raise


    def test_chemical_element_crud(self):
        """Тестирование CRUD операций для ChemicalElement"""
        existing_elements = get_all_elements(self.session)

        import time
        unique_id = int(time.time() * 1000)
        # Используем короткие символы и имена (максимум 2 символа для symbol, 12 для name)
        unique_symbol = f"T{unique_id % 10}"  # максимум 2 символа
        unique_name = f"Э{unique_id % 100}"  # максимум 3 символа

        new_element = create_chemical_element(
            self.session,
            name=unique_name,
            atomic_number=200 + unique_id % 100,
            symbol=unique_symbol
        )

        self.assertIsNotNone(new_element, f"Не удалось создать элемент с символом {unique_symbol}")

        if new_element:
            self.assertEqual(new_element.name, unique_name)
            self.assertEqual(new_element.symbol, unique_symbol)

            element_by_id = get_element_by_id(self.session, new_element.id)
            self.assertEqual(element_by_id.id, new_element.id)

            element_by_symbol = get_element_by_symbol(self.session, unique_symbol)
            self.assertEqual(element_by_symbol.symbol, unique_symbol)

            all_elements = get_all_elements(self.session)
            self.assertGreater(len(all_elements), len(existing_elements))

            element_ids = [elem.id for elem in all_elements]
            self.assertIn(new_element.id, element_ids)

    def test_chemical_element_duplicate_handling(self):
        """Тестирование обработки дублирующихся элементов"""
        import time
        unique_id = int(time.time() * 1000)

        # Используем короткие символы и имена
        element1 = create_chemical_element(
            self.session,
            name='ТестЭлем',  # 8 символов
            atomic_number=800 + unique_id % 100,
            symbol='D1'  # Короткий символ (2 символа)
        )
        self.assertIsNotNone(element1)

        # Пытаемся создать элемент с тем же символом - должен вернуть существующий
        element2 = create_chemical_element(
            self.session,
            name='ДругоеИмя',  # 8 символов
            atomic_number=900 + unique_id,
            symbol='D1'  # Тот же символ
        )

        self.assertEqual(element2.id, element1.id)
        self.assertEqual(element2.name, 'ТестЭлем')  # Имя должно остаться исходным

    def test_role_crud(self):
        """Тестирование CRUD операций для Role"""
        import time
        unique_id = int(time.time() * 1000)

        new_role = create_role(
            self.session,
            name=f'admin_{unique_id}',
            description='Администратор системы'
        )
        self.assertIsNotNone(new_role)
        self.assertEqual(new_role.name, f'admin_{unique_id}')

        role_by_id = get_role_by_id(self.session, new_role.id)
        self.assertEqual(role_by_id.id, new_role.id)

        role_by_name = get_role_by_name(self.session, f'admin_{unique_id}')
        self.assertEqual(role_by_name.name, f'admin_{unique_id}')

        all_roles = get_all_roles(self.session)
        self.assertGreater(len(all_roles), 0)

        duplicate_role = create_role(
            self.session,
            name=f'admin_{unique_id}',
            description='Другое описание'
        )
        self.assertEqual(duplicate_role.id, new_role.id)

    def test_model_crud(self):
        """Тестирование CRUD операций для Model"""
        import time
        unique_id = int(time.time() * 1000)

        new_model = create_model(
            self.session,
            name=f'SVM{unique_id}',
            description='Support Vector Machine'
        )
        self.assertIsNotNone(new_model)
        self.assertEqual(new_model.name, f'SVM{unique_id}')

        model_by_id = get_model_by_id(self.session, new_model.id)
        self.assertEqual(model_by_id.id, new_model.id)

        model_by_name = get_model_by_name(self.session, f'SVM{unique_id}')
        self.assertEqual(model_by_name.name, f'SVM{unique_id}')

        all_models = get_all_models(self.session)
        self.assertGreater(len(all_models), 0)

        duplicate_model = create_model(
            self.session,
            name=f'SVM{unique_id}',
            description='Другое описание'
        )
        self.assertEqual(duplicate_model.id, new_model.id)

    def test_patent_crud(self):
        """Тестирование CRUD операций для Patent"""
        import time
        unique_id = int(time.time() * 1000)

        new_patent = create_patent(
            self.session,
            authors_name='Сидоров В.Г.',
            patent_name=f'Патент{unique_id}',
            description='Описание патента'
        )
        self.assertIsNotNone(new_patent)
        self.assertEqual(new_patent.patent_name, f'Патент{unique_id}')

        patent_by_id = get_patent_by_id(self.session, new_patent.id)
        self.assertEqual(patent_by_id.id, new_patent.id)

        patent_by_name = get_patent_by_name(self.session, f'Патент{unique_id}')
        self.assertEqual(patent_by_name.patent_name, f'Патент{unique_id}')

        all_patents = get_all_patents(self.session)
        self.assertGreater(len(all_patents), 0)

        updated_patent = update_patent(
            self.session,
            new_patent.id,
            description='Обновленное описание'
        )
        self.assertEqual(updated_patent.description, 'Обновленное описание')

    def test_person_crud(self):
        """Тестирование CRUD операций для Person"""
        import time
        unique_id = int(time.time() * 1000)

        new_person = create_person(
            self.session,
            first_name=f'Имя{unique_id}',
            last_name='Фамилия',
            role_id=self.researcher_role.id,
            organization='Организация'
        )
        self.assertIsNotNone(new_person)
        self.assertEqual(new_person.first_name, f'Имя{unique_id}')

        person_by_id = get_person_by_id(self.session, new_person.id)
        self.assertEqual(person_by_id.id, new_person.id)

        persons_by_role = get_persons_by_role(self.session, self.researcher_role.id)
        self.assertGreater(len(persons_by_role), 0)

        all_persons = get_all_persons(self.session)
        self.assertGreater(len(all_persons), 0)

    def test_alloy_crud(self):
        """Тестирование CRUD операций для Alloy"""
        element_percentages = {
            self.fe_element.id: 95.5,
            self.c_element.id: 2.5,
            self.si_element.id: 2.0
        }

        new_alloy = create_alloy_with_elements(
            self.session,
            prop_value=50.0,
            category='Сталь',
            rolling_type='Горячая',
            patent_id=self.patent1.id,
            element_percentages=element_percentages
        )
        self.assertIsNotNone(new_alloy)
        self.assertEqual(new_alloy.category, 'Сталь')

        alloy_by_id = get_alloy_by_id(self.session, new_alloy.id)
        self.assertEqual(alloy_by_id.id, new_alloy.id)

        alloys_by_patent = get_alloys_by_patent(self.session, self.patent1.id)
        self.assertGreater(len(alloys_by_patent), 0)

        all_alloys = get_all_alloys(self.session)
        self.assertGreater(len(all_alloys), 0)

        alloys_with_details = get_alloys_with_details(self.session)
        self.assertGreater(len(alloys_with_details), 0)

        searched_alloys = search_alloys_by_category(self.session, 'Сталь')
        self.assertGreater(len(searched_alloys), 0)

        elements_with_percentages = get_alloy_elements_with_percentages(self.session, new_alloy.id)
        self.assertEqual(len(elements_with_percentages), 3)

        updated_alloy = update_alloy(
            self.session,
            new_alloy.id,
            category='Обновленная сталь',
            prop_value=55.0
        )
        self.assertEqual(updated_alloy.category, 'Обновленная сталь')
        self.assertEqual(updated_alloy.prop_value, 55.0)

        alloys_count = get_alloys_count(self.session)
        self.assertGreater(alloys_count, 0)

        delete_result = delete_alloy(self.session, new_alloy.id)
        self.assertTrue(delete_result)

        deleted_alloy = get_alloy_by_id(self.session, new_alloy.id)
        self.assertIsNone(deleted_alloy)

    def test_prediction_crud(self):
        """Тестирование CRUD операций для Prediction"""
        element_percentages = {
            self.fe_element.id: 98.0,
            self.c_element.id: 1.5,
            self.si_element.id: 0.5
        }

        new_prediction = create_prediction_with_elements(
            self.session,
            prop_value=45.0,
            category='Сталь',
            ml_model_id=self.rf_model.id,
            rolling_type='Холодная',
            person_id=self.person1.id,
            element_percentages=element_percentages
        )
        self.assertIsNotNone(new_prediction)
        self.assertEqual(new_prediction.category, 'Сталь')

        prediction_by_id = get_prediction_by_id(self.session, new_prediction.id)
        self.assertEqual(prediction_by_id.id, new_prediction.id)

        predictions_by_person = get_predictions_by_person(self.session, self.person1.id)
        self.assertGreater(len(predictions_by_person), 0)

        predictions_by_element = get_predictions_by_element(self.session, self.fe_element.id)
        self.assertGreater(len(predictions_by_element), 0)

        predictions_by_model = get_predictions_by_model(self.session, self.rf_model.id)
        self.assertGreater(len(predictions_by_model), 0)

        all_predictions = get_all_predictions(self.session)
        self.assertGreater(len(all_predictions), 0)

        predictions_with_details = get_predictions_with_details(self.session)
        self.assertGreater(len(predictions_with_details), 0)

    def test_add_element_to_alloy(self):
        """Тестирование добавления элемента к сплаву"""
        alloy = create_alloy(
            self.session,
            prop_value=60.0,
            category='Тестовый сплав',
            rolling_type='Прокатка',
            patent_id=self.patent1.id
        )

        add_element_to_alloy(
            self.session,
            alloy_id=alloy.id,
            element_id=self.fe_element.id,
            percentage=99.999
        )

        elements_with_percentages = get_alloy_elements_with_percentages(self.session, alloy.id)
        self.assertEqual(len(elements_with_percentages), 1)
        self.assertEqual(elements_with_percentages[0]['element'].id, self.fe_element.id)
        self.assertEqual(float(elements_with_percentages[0]['percentage']), 99.999)

    def test_add_element_to_prediction(self):
        """Тестирование добавления элемента к прогнозу"""
        prediction = create_prediction(
            self.session,
            prop_value=55.0,
            category='Прогноз',
            ml_model_id=self.nn_model.id,
            rolling_type='Прокатка',
            person_id=self.person2.id
        )

        add_element_to_prediction(
            self.session,
            prediction_id=prediction.id,
            element_id=self.c_element.id,
            percentage=2.5
        )

        self.assertEqual(len(prediction.elements), 1)
        self.assertEqual(prediction.elements[0].id, self.c_element.id)

    def test_edge_cases(self):
        """Тестирование граничных случаев"""
        non_existent_alloy = get_alloy_by_id(self.session, 99999)
        self.assertIsNone(non_existent_alloy)

        non_existent_patent = get_patent_by_id(self.session, 99999)
        self.assertIsNone(non_existent_patent)

        updated_none = update_alloy(self.session, 99999, category='Test')
        self.assertIsNone(updated_none)

        delete_result = delete_alloy(self.session, 99999)
        self.assertFalse(delete_result)

    def test_negative_prop_value(self):
        """Тестирование обработки отрицательных значений prop_value"""
        alloy = create_alloy(
            self.session,
            prop_value=-10.0,
            category='Тест',
            rolling_type='Тест',
            patent_id=self.patent1.id
        )

        self.assertEqual(alloy.prop_value, 0)

    def test_chemical_element_by_symbol(self):
        """Тестирование функции get_chemical_element_by_symbol"""
        element = get_chemical_element_by_symbol(self.session, 'Fe')
        self.assertIsNotNone(element)
        self.assertEqual(element.symbol, 'Fe')

        non_existent_element = get_chemical_element_by_symbol(self.session, 'Xy')
        self.assertIsNone(non_existent_element)


if __name__ == '__main__':
    unittest.main()