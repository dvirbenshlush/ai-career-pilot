from fastapi import APIRouter
router = APIRouter()

@router.get("/")
def interview_root():
    return {"message": "Interview Coach API - coming soon"}
