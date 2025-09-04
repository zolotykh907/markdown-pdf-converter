from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes import router

app = FastAPI(
    title="Markdown to PDF Converter",
    description='Сервис для конвертации Markdown файлов в PDF.',
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(app, host="0.0.0.0", port=8000)