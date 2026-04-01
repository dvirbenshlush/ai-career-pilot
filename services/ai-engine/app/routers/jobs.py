from fastapi import APIRouter
router = APIRouter()

@router.get("/")
def jobs_root():
    return {"message": "Job Hunter API - coming soon"}
