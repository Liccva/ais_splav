from configparser import RawConfigParser, ExtendedInterpolation
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from functools import lru_cache

"""
    Данный модуль отвечает за конфигурирование приложения
"""

# Читаем файл конфигурации приложения
app_config = RawConfigParser(interpolation=ExtendedInterpolation())
app_config.read('application.ini')

db_config = app_config['Database']

# Базовый класс для моделей ДО создания движка
Base = declarative_base()


@lru_cache()
def get_engine():
    """
    Создает движок SQLAlchemy с оптимизированным пулом соединений для MariaDB
    Используем lru_cache для создания движка один раз на процесс
    """
    db_url = db_config['database_url']
    db_sync = db_config.getboolean('database_sync', fallback=False)

    print(f"Creating MariaDB engine with URL: {db_url.split('@')[1] if '@' in db_url else db_url}")

    # Параметры пула для MariaDB
    pool_kwargs = {
        'pool_size': 20,  # Размер пула на процесс
        'max_overflow': 40,  # Максимальное переполнение на процесс
        'pool_timeout': 60,  # Таймаут до 60 секунд
        'pool_recycle': 1800,  # Переподключаемся каждые 30 минут
        'pool_pre_ping': True,  # Проверяем соединение перед использованием
        'echo': False,  # Отключаем логи SQL
        'echo_pool': False,  # Отключаем логи пула
        'connect_args': {
            'connect_timeout': 30,
        }
    }

    # Если есть параметры в конфиге, используем их
    try:
        if 'pool_size' in db_config:
            pool_kwargs['pool_size'] = int(db_config['pool_size'])
        if 'max_overflow' in db_config:
            pool_kwargs['max_overflow'] = int(db_config['max_overflow'])
    except Exception as e:
        print(f"Warning: Could not parse pool config: {e}")

    print(f"Pool settings: pool_size={pool_kwargs['pool_size']}, "
          f"max_overflow={pool_kwargs['max_overflow']}")

    # Создаем движок
    engine = create_engine(db_url, **pool_kwargs)

    if db_sync:
        # Создаем таблицы если нужно
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified")

    return engine


# Создаем глобальный движок
engine = get_engine()


def get_session_fabric():
    """
    Создает фабрику сессий SQLAlchemy (кэшируется)
    """
    return sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
        expire_on_commit=False,
    )


# Инициализируем фабрику сессий
SessionLocal = get_session_fabric()


def get_db():
    """
    Dependency для получения сессии БД
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()