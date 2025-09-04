import base64
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from .models import MarkdownRequest, ConversionResponse
from .pdf_service import create_pdf_from_markdown


router = APIRouter()


@router.get("/")
async def root():
    return {"message": "Markdown to PDF Converter API"}


@router.post("/convert", response_model=ConversionResponse)
async def convert_markdown_to_pdf(request: MarkdownRequest):
    try:
        settings = request.dict()
        
        pdf_bytes = create_pdf_from_markdown(request.content, settings)
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        
        return ConversionResponse(
            pdf_base64=pdf_base64,
            success=True,
            message="PDF successfully created"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error when converting markdown to pdf: {str(e)}")


@router.get("/health")
async def health_check():
    return {"status": "healthy"}
