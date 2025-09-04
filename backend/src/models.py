from pydantic import BaseModel
from typing import Optional


class MarkdownRequest(BaseModel):
    content: str
    font_family: Optional[str] = "Inter"
    font_size: Optional[int] = 12
    line_height: Optional[float] = 1.6
    margin_top: Optional[float] = 72
    margin_bottom: Optional[float] = 72
    margin_left: Optional[float] = 72
    margin_right: Optional[float] = 72
    text_color: Optional[str] = "#000000"
    background_color: Optional[str] = "#ffffff"


class ConversionResponse(BaseModel):
    pdf_base64: str
    success: bool
    message: str
