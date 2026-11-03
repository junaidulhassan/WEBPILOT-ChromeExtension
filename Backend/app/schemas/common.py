from typing import Annotated

from pydantic import BaseModel, StringConstraints

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class OptionItem(BaseModel):
    id: str
    label: str


class OptionsResponse(BaseModel):
    options: list[OptionItem]
    current: str


class CurrentSelectionResponse(BaseModel):
    current: str
