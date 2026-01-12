from sqlalchemy import Column, ForeignKey, Boolean, Integer, Numeric, String, Text, DateTime, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship

Base = declarative_base()

# Ассоциативная таблица с процентным содержанием
alloy_element_association = Table(
    'alloy_element_association',
    Base.metadata,
    Column('alloy_id', Integer, ForeignKey('alloy.id'), primary_key=True),
    Column('element_id', Integer, ForeignKey('chemical_element.id'), primary_key=True),
    Column('percentage', Numeric(5, 3), nullable=False)  # Процентное содержание элемента в сплаве
)

# Ассоциативная таблица для prediction-element
prediction_element_association = Table(
    'prediction_element_association',
    Base.metadata,
    Column('prediction_id', Integer, ForeignKey('prediction.id'), primary_key=True),
    Column('element_id', Integer, ForeignKey('chemical_element.id'), primary_key=True),
    Column('percentage', Numeric(5, 3), nullable=False)  # Процентное содержание элемента в прогнозе
)


class Alloy(Base):
    __tablename__ = "alloy"

    id = Column(Integer, primary_key=True)
    _prop_value = Column('prop_value', Numeric, nullable=False)
    category = Column(String(100))
    rolling_type = Column(String(50))

    patent_id = Column(Integer, ForeignKey('patent.id'), nullable=False)
    patent = relationship('Patent', back_populates="alloys")

    # Связь многие-ко-многим с ChemicalElement через ассоциативную таблицу
    elements = relationship('ChemicalElement',
                            secondary=alloy_element_association,
                            back_populates="alloys")

    @hybrid_property
    def prop_value(self):
        return self._prop_value

    @prop_value.setter
    def prop_value(self, value):
        if value is not None and value < 0:
            self._prop_value = 0
        else:
            self._prop_value = value

    @prop_value.expression
    def prop_value(cls):
        return cls._prop_value

    def __repr__(self):
        return f"<Alloy(id={self.id}, prop_value={self.prop_value})>"


class Patent(Base):
    __tablename__ = "patent"

    id = Column(Integer, primary_key=True)
    authors_name = Column(String(100), nullable=False)
    patent_name = Column(String(100), nullable=False)
    description = Column(String(200))
    alloys = relationship('Alloy', back_populates='patent')

    def __repr__(self):
        return f"<Patent(id={self.id}, name='{self.patent_name}')>"


class ChemicalElement(Base):
    """Химический элемент"""
    __tablename__ = "chemical_element"

    id = Column(Integer, primary_key=True)
    name = Column(String(12), nullable=False)
    atomic_number = Column(Integer, nullable=False)
    symbol = Column(String(2), nullable=False)

    # Связи многие-ко-многим через ассоциативные таблицы
    alloys = relationship('Alloy',
                          secondary=alloy_element_association,
                          back_populates="elements")

    predictions = relationship('Prediction',
                               secondary=prediction_element_association,
                               back_populates="elements")

    def __repr__(self):
        return f"<ChemicalElement(id={self.id}, name='{self.name}', symbol='{self.symbol}')>"


class Role(Base):
    """Таблица ролей пользователей"""
    __tablename__ = "role"

    id = Column(Integer, primary_key=True)
    name = Column(String(20), nullable=False, unique=True)
    description = Column(String(100))

    persons = relationship('Person', back_populates='role')

    def __repr__(self):
        return f"<Role(id={self.id}, name='{self.name}')>"


class Model(Base):
    """Таблица ML моделей"""
    __tablename__ = "model"

    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(200))

    # Связь один-ко-многим с Prediction
    predictions = relationship('Prediction', back_populates='model')

    def __repr__(self):
        return f"<Model(id={self.id}, name='{self.name}')>"


class Person(Base):
    """Пользователь"""
    __tablename__ = "person"

    id = Column(Integer, primary_key=True)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    role_id = Column(Integer, ForeignKey('role.id'), nullable=False)
    organization = Column(String(200))
    login = Column(String(20), nullable=False)
    password = Column(String(50), nullable=False)

    role = relationship('Role', back_populates='persons')
    predictions = relationship('Prediction', back_populates='person')

    def __repr__(self):
        return f"<Person(id={self.id}, name='{self.first_name} {self.last_name}')>"


class Prediction(Base):
    """Прогноз"""
    __tablename__ = "prediction"

    id = Column(Integer, primary_key=True)
    _prop_value = Column('prop_value', Numeric, nullable=False)
    category = Column(String(100))
    ml_model_id = Column(Integer, ForeignKey('model.id'), nullable=False)
    model = relationship('Model', back_populates="predictions")
    rolling_type = Column(String(50))

    person_id = Column(Integer, ForeignKey('person.id'), nullable=False)
    person = relationship('Person', back_populates="predictions")

    # Связь многие-ко-многим с ChemicalElement через ассоциативную таблицу
    elements = relationship('ChemicalElement',
                            secondary=prediction_element_association,
                            back_populates="predictions")

    @hybrid_property
    def prop_value(self):
        return self._prop_value

    @prop_value.setter
    def prop_value(self, value):
        if value is not None and value < 0:
            self._prop_value = 0
        else:
            self._prop_value = value

    @prop_value.expression
    def prop_value(cls):
        return cls._prop_value

    def __repr__(self):
        return f"<Prediction(id={self.id}, prop_value={self.prop_value})>"

