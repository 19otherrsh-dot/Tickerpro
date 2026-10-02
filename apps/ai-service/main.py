from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import os
import openai
from ingest import process_and_ingest, get_db_connection

app = FastAPI(title="TickerPro AI Service")

# Note: We are using openai 0.28.0 for simplicity here.
openai.api_key = os.getenv("OPENAI_API_KEY", "ollama")
if os.getenv("OPENAI_API_BASE"):
    openai.api_base = os.getenv("OPENAI_API_BASE")

class MessagePayload(BaseModel):
    role: str
    content: str

class SentimentRequest(BaseModel):
    messages: List[MessagePayload]

class SuggestReplyRequest(BaseModel):
    messages: List[MessagePayload]
    agent_context: str = ""

@app.post("/sentiment")
async def analyze_sentiment(req: SentimentRequest):
    if not openai.api_key:
        # Fallback if no key is provided during dev
        return {"sentiment": "NEUTRAL", "score": 0.0}

    try:
        conversation_text = "\n".join([f"{m.role}: {m.content}" for m in req.messages[-5:]])
        prompt = f"""
Analyze the sentiment of the customer in the following conversation.
Return a JSON object with 'sentiment' (one of: POSITIVE, NEUTRAL, NEGATIVE, CHURN_RISK) and 'score' (float between -1.0 and 1.0).

Conversation:
{conversation_text}
"""
        response = openai.ChatCompletion.create(
            model="llama3",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        import json
        result = json.loads(response.choices[0].message.content)
        return {"sentiment": result.get("sentiment", "NEUTRAL"), "score": result.get("score", 0.0)}
    except Exception as e:
        print(f"Error in sentiment analysis: {e}")
        return {"sentiment": "NEUTRAL", "score": 0.0}

@app.post("/suggest-reply")
async def suggest_reply(req: SuggestReplyRequest):
    if not openai.api_key:
        return {"suggestions": ["Hello, how can I help you today?", "Please wait while I check on that.", "Is there anything else?"]}

    try:
        conversation_text = "\n".join([f"{m.role}: {m.content}" for m in req.messages[-10:]])
        prompt = f"""
You are a helpful customer support AI for TickerPro. Based on the conversation history below, suggest 3 concise, professional replies the agent could send.

Agent Context/Instructions: {req.agent_context}

Conversation:
{conversation_text}

Provide exactly 3 suggestions separated by "|||".
"""
        response = openai.ChatCompletion.create(
            model="llama3",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        content = response.choices[0].message.content
        suggestions = [s.strip() for s in content.split("|||") if s.strip()]
        # Fallback to lines if splitting by ||| fails
        if len(suggestions) < 2:
             suggestions = [s.strip().lstrip("-123. ") for s in content.split("\n") if s.strip()]
        
        return {"suggestions": suggestions[:3]}
    except Exception as e:
        print(f"Error suggesting replies: {e}")
        return {"suggestions": ["Sorry, I am having trouble generating suggestions right now."]}

class IngestRequest(BaseModel):
    kb_id: str
    url: Optional[str] = None
    content: Optional[str] = None

@app.post("/ingest")
async def ingest_kb(req: IngestRequest, background_tasks: BackgroundTasks):
    if not req.url and not req.content:
        raise HTTPException(status_code=400, detail="Must provide url or content")
    
    background_tasks.add_task(process_and_ingest, req.kb_id, req.url, req.content)
    return {"message": "Ingestion started in background"}

class AskRequest(BaseModel):
    workspace_id: str
    question: str

@app.post("/ask")
async def ask_question(req: AskRequest):
    if not openai.api_key:
        return {"answer": "I'm sorry, my AI is currently disconnected.", "sources": []}

    try:
        # 1. Embed the question
        res = openai.Embedding.create(
            input=req.question,
            model="nomic-embed-text"
        )
        query_embedding = res['data'][0]['embedding']
        embedding_str = f"[{','.join(map(str, query_embedding))}]"

        # 2. Vector search in PostgreSQL (pgvector cosine distance <=>)
        # We only search within knowledge bases belonging to this workspace
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """
            SELECT c.content, c.embedding <=> %s::vector AS distance
            FROM document_chunks c
            JOIN knowledge_bases kb ON c.knowledge_base_id = kb.id
            WHERE kb.workspace_id = %s AND kb.status = 'COMPLETED'
            ORDER BY distance ASC
            LIMIT 5
            """,
            (embedding_str, req.workspace_id)
        )
        results = cursor.fetchall()
        cursor.close()
        conn.close()

        if not results:
            return {"answer": "I don't have enough context to answer that question.", "sources": []}

        # 3. Construct prompt with retrieved chunks
        context_text = "\n\n---\n\n".join([row[0] for row in results])
        
        prompt = f"""
You are a helpful customer support AI for TickerPro. 
Use ONLY the following context to answer the user's question. If the context does not contain the answer, say "I don't know based on my current knowledge base." Do NOT make up an answer.

Context:
{context_text}

Question:
{req.question}

Answer concisely:
"""
        chat_res = openai.ChatCompletion.create(
            model="llama3",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )

        answer = chat_res.choices[0].message.content
        return {"answer": answer, "sources": [row[0][:100] + "..." for row in results]}

    except Exception as e:
        print(f"Error answering question: {e}")
        return {"answer": "I encountered an error trying to answer your question.", "sources": []}
