import subprocess
import sys
import uvicorn

def dev():
	subprocess.run(["poetry", "install"],check=True)
	uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
