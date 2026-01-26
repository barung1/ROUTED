from fastapi import FastAPI

app = FastAPI(title="FastAPI Backend")

@app.get("/health")
def health():
    return {"status": "ok"}
