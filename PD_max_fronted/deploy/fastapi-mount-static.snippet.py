# If port 80 goes straight to FastAPI/Uvicorn (no Nginx), /project3 will always return JSON 404.
# Add in main.py: usually LAST (after all API routes), so nothing shadows /project3.
# Directory must exist on server: /var/www/html/project3 (same as deploy.ps1)

from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = "/var/www/html/project3"

app.mount(
    "/project3",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="project3_spa",
)

# Notes:
# - html=True serves index.html for directory requests (SPA).
# - API paths like /ai-detection stay on other routes.
# - Restart API after editing: sudo systemctl restart your-service
