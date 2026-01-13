from typing import List, Dict, Any
import tiktoken
from app.config import settings


def count_tokens(text: str, model: str = "gpt-4") -> int:
    """Count tokens in text using tiktoken"""
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("cl100k_base")
    return len(encoding.encode(text))


def chunk_text(
    text: str,
    chunk_size: int = None,
    chunk_overlap: int = None,
    metadata: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """
    Split text into overlapping chunks based on token count.
    Returns list of dicts with 'content' and 'metadata'.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
    metadata = metadata or {}

    try:
        encoding = tiktoken.get_encoding("cl100k_base")
    except Exception:
        # Fallback to simple character-based chunking
        return _chunk_by_chars(text, chunk_size * 4, chunk_overlap * 4, metadata)

    tokens = encoding.encode(text)
    chunks = []

    start = 0
    chunk_index = 0

    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = encoding.decode(chunk_tokens)

        chunks.append({
            "content": chunk_text,
            "metadata": {
                **metadata,
                "chunk_index": chunk_index,
                "token_count": len(chunk_tokens),
            }
        })

        # Move start forward, accounting for overlap
        start = end - chunk_overlap if end < len(tokens) else end
        chunk_index += 1

    return chunks


def _chunk_by_chars(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
    metadata: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Fallback character-based chunking"""
    chunks = []
    start = 0
    chunk_index = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk_text = text[start:end]

        chunks.append({
            "content": chunk_text,
            "metadata": {
                **metadata,
                "chunk_index": chunk_index,
                "char_count": len(chunk_text),
            }
        })

        start = end - chunk_overlap if end < len(text) else end
        chunk_index += 1

    return chunks


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file"""
    from pypdf import PdfReader

    reader = PdfReader(file_path)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text


def extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file"""
    from docx import Document

    doc = Document(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text


def extract_text_from_html(html_content: str) -> str:
    """Extract text from HTML content"""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_content, "html.parser")
    # Remove script and style elements
    for element in soup(["script", "style", "nav", "footer", "header"]):
        element.decompose()
    return soup.get_text(separator="\n", strip=True)


def extract_text(file_path: str, content_type: str) -> str:
    """Extract text from various file formats"""
    if content_type == "application/pdf":
        return extract_text_from_pdf(file_path)
    elif content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
        return extract_text_from_docx(file_path)
    elif content_type == "text/html":
        with open(file_path, "r", encoding="utf-8") as f:
            return extract_text_from_html(f.read())
    elif content_type.startswith("text/"):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    else:
        raise ValueError(f"Unsupported content type: {content_type}")
