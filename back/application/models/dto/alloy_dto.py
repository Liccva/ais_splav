from pydantic import BaseModel
from typing import (
    Deque, Dict, List, Optional, Sequence, Set, Tuple, Union
)

class AlloyDTO(BaseModel):
    """ DTO для получения информации о сплаве """
    id: int
    prop_value: float
    category: str
    rolling_type: str
    patent_id: int


class AlloyCreateDTO(BaseModel):
    """ DTO для создания сплавa """
    prop_value: float
    category: str
    rolling_type: str
    patent_id: int

class AlloyUpdateDTO(BaseModel):
    """ DTO для изменения сплавa """
    prop_value: float
    category: str
    rolling_type: str
    patent_id: int

