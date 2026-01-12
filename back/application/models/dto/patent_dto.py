from pydantic import BaseModel
from typing import (
    Deque, Dict, List, Optional, Sequence, Set, Tuple, Union
)

class PatentDTO(BaseModel):
    """ DTO для добавления, получения нового патента """
    id: int
    authors_name: str
    patent_name: str
    description: Optional[str]


class PatentCreateDTO(BaseModel):
    """ DTO для добавления, получения нового патента """
    authors_name: str
    patent_name: str
    description: Optional[str]