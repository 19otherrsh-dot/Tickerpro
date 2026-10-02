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
            response = openai.Embedding.create(
                input=chunk,
                model="nomic-embed-text"
            )
            embedding = response['data'][0]['embedding']
            
            # Note: pgvector expects string format '[0.1, 0.2, ...]'
            embedding_str = f"[{','.join(map(str, embedding))}]"

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
