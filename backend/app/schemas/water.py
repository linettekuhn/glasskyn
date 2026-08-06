from datetime import date

from pydantic import BaseModel


class WaterIntakeIn(BaseModel):
    date: date
    ml: int


class WaterIntakeOut(BaseModel):
    date: date
    ml: int

    model_config = {"from_attributes": True}
