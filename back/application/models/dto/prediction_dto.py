from pydantic import BaseModel
from typing import (
    Deque, Dict, List, Optional, Sequence, Set, Tuple, Union
)

class PredictionDTO(BaseModel):
    """ DTO для добавления и получения нового прогноза """
    id: int
    prop_value: float
    category: str
    ml_model_id: int
    rolling_type: str
    person_id: int

class PredictionCreateDTO(BaseModel):
    """ DTO для добавления и получения нового прогноза """
    prop_value: float
    category: str
    ml_model_id: int
    rolling_type: str
    person_id: int
