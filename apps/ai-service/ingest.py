import os
import openai
import psycopg2
from bs4 import BeautifulSoup
import requests
from langchain.text_splitter import RecursiveCharacterTextSplitter

openai.api_key = os.getenv("OPENAI_API_KEY", "ollama")
if os.getenv("OPENAI_API_BASE"):
    openai.api_base = os.getenv("OPENAI_API_BASE")
DATABASE_URL = os.getenv("DATABASE_URL")

# Same env vars as the Node AI gateway (apps/api/src/services/ai-gateway.ts).
CHAT_MODEL = os.getenv("OPENAI_MODEL", "llama3")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")
# Must match document_chunks.embedding vector(768).
EMBEDDING_DIMENSIONS = 768

def embed(text: str) -> str:
    """Embed text and return it in pgvector's '[0.1,0.2,...]' literal format."""
    params = {"input": text, "model": EMBEDDING_MODEL}
    # Only OpenAI's text-embedding-3-* models support (and need) an explicit size.
    if EMBEDDING_MODEL.startswith("text-embedding-3"):
        params["dimensions"] = EMBEDDING_DIMENSIONS
    vector = openai.Embedding.create(**params)['data'][0]['embedding']
    if len(vector) != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"{EMBEDDING_MODEL} returned {len(vector)} dims; expected {EMBEDDING_DIMENSIONS}"
        )
    return f"[{','.join(map(str, vector))}]"

def get_db_connection():
    # If the app runs locally, it connects to postgres://postgres:postgres@localhost:5432/tickerpro
    return psycopg2.connect(DATABASE_URL)

def process_and_ingest(kb_id: str, url: str = None, content: str = None):
    try:
        text = ""
        if url:
            # Fetch and scrape URL
            res = requests.get(url, timeout=10)
            res.raise_for_status()
            soup = BeautifulSoup(res.text, "html.parser")
            # Remove scripts and styles
            for script in soup(["script", "style"]):
                script.extract()
            text = soup.get_text(separator="\n", strip=True)
        elif content:
            text = content
        else:
            raise ValueError("Must provide url or content")

        # Chunk the text using LangChain
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
            length_function=len,
        )
        chunks = text_splitter.split_text(text)

        conn = get_db_connection()
        cursor = conn.cursor()

        # Embed each chunk and insert into database
        for chunk in chunks:
            embedding_str = embed(chunk)

            cursor.execute(
                """
                INSERT INTO document_chunks (id, content, embedding, knowledge_base_id)
                VALUES (gen_random_uuid(), %s, %s::vector, %s)
                """,
                (chunk, embedding_str, kb_id)
            )

        # Update KB status to COMPLETED
        cursor.execute(
            """
            UPDATE knowledge_bases
            SET status = 'COMPLETED'
            WHERE id = %s
            """,
            (kb_id,)
        )
        
        conn.commit()
        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"Error ingesting KB {kb_id}: {e}")
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE knowledge_bases SET status = 'FAILED' WHERE id = %s", (kb_id,))
            conn.commit()
            cursor.close()
            conn.close()
        except:
            pass
        return False
