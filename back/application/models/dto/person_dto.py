from pydantic import BaseModel
from typing import (
    Deque, Dict, List, Optional, Sequence, Set, Tuple, Union
)

class PersonDTO(BaseModel):
    """ DTO для вывода пользователя """
    id: int
    first_name: str
    last_name: str
    role_id: int
    organization: Optional[str]
    login: str
    password: str

class PersonCreateDTO(BaseModel):
    """ DTO для добавления нового пользователя """
    first_name: str
    last_name: str
    role_id: int
    organization: Optional[str]
    login: str
    password: str
