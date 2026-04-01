from fastapi import APIRouter, UploadFile, File, HTTPException
import PyPDF2
import docx
import io

router = APIRouter()

@router.post("/parse")
async def parse_resume(file: UploadFile = File(...)):
    content = await file.read()

    if file.content_type == "application/pdf":
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in pdf_reader.pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF parsing failed: {str(e)}")

    elif file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        try:
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"DOCX parsing failed: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    return {"text": text, "char_count": len(text), "word_count": len(text.split())}
