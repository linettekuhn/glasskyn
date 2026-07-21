🛠️ ShelfLove is a work-in-progress mobile app that lets you scan and track the expiry dates of your cosmetics, with more features coming soon.

# ShelfLove CV Pipeline

The computer vision pipeline uses Google Cloud Vision API for OCR and a fine-tuned ResNet-50 PyTorch model for product category classification.
It extracts structured data (PAO months, product category, name, brand) from user-captured product photos and feeds the results into the scan flow for user confirmation.

---

## Architecture

```mermaid
flowchart TD
    A["Expo Camera<br/>(front + back)"] --> B["S3 Bucket<br/>(presigned URLs)"]
    B --> C["FastAPI Backend"]

    subgraph Concurrent["asyncio.gather"]
        D["Google Vision OCR"]
        E["ResNet-50 Classifier"]
    end

    C --> D
    C --> E

    D --> F["Extraction Logic"]
    E --> F

    F --> F1["Regex PAO parse"]
    F --> F2["Keyword category (fallback)"]
    F --> F3["Barcode lookup → LLM fallback"]

    F1 --> G["ScanResult<br/>category_method: ml_classifier"]
    F2 --> G
    F3 --> G

    G --> H["Confirm Screen<br/>(user reviews/edits)"]
```

---

## Usage

The CV pipeline is triggered automatically when the user completes the multi-step scan flow. Here's how it works:

1. **Capture photos**
   - The user photographs the front and back labels of their product using the Expo camera.
   - Images are uploaded directly to S3 via presigned URLs.

2. **Process images**
   - The backend downloads both images from S3.
   - OCR runs on both images via Google Cloud Vision API (concurrently).
   - The ML classifier runs on both images via the fine-tuned ResNet-50 (concurrently with OCR).

3. **Classify the product category**
   - The classifier predicts one of three categories: `skincare`, `makeup`, or `haircare`.
   - Predictions above a confidence threshold are accepted and category_method is set to "ml_classifier".
   - Below that threshold, the pipeline falls back to keyword-based classification from the OCR text.
   - When both front and back images are available, the classifier result with the highest confidence is used.

4. **Extract structured data**
   - Regex patterns extract the PAO (Period After Opening) value from OCR text (e.g. `12M`, `6 months`).
   - Barcode scan attempts an Open Beauty Facts API lookup for product name and brand.
   - If barcode lookup fails, an LLM fallback extracts name and brand from the OCR text.

5. **Return combined result to the scan flow**
   - The extraction result (category, PAO, name, brand) is persisted in PostgreSQL and returned to the frontend.
   - The user reviews and confirms the data on the confirmation screen before saving the product.

---

## Features

- Fine-tuned ResNet-50 for three-class cosmetic product classification (skincare, makeup, haircare)
- Dataset built from Open Beauty Facts product images (~200 category tags mapped to 3 classes)
- Training pipeline with weighted sampling, label smoothing, and early stopping
- ML classifier runs concurrently with OCR via `asyncio.gather` for minimal latency
- Confidence threshold (0.7) gates predictions; falls back to keyword matching when uncertain
- Best-of-two inference when both front and back images are available (picks highest confidence)

---

## Built With

- Inference: PyTorch, TorchVision, Pillow
- Training: PyTorch, scikit-learn, HuggingFace Datasets (Open Beauty Facts)
- OCR: Google Cloud Vision API
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Storage: AWS S3 (presigned URLs)
- Agent: LangChain, LangGraph, OpenAI GPT-4o-mini

---

## Agent Architecture

ShelfLove uses a LangChain agent to power the chat assistant. The agent uses a ReAct loop (Reason + Act) to decide which tools to call based on the user's question, then synthesizes a response from the tool results.

### Tools

| Tool | Description | Backed by |
|------|-------------|-----------|
| `lookup_ingredient_safety` | Look up safety scores, risks, and benefits for cosmetic ingredients | ChromaDB (ingredient safety embeddings) |
| `query_user_products` | Query the user's saved products, filterable by type or category | PostgreSQL (`products` table) |
| `summarize_safety` | Convert raw ingredient data into a plain-language safety summary | GPT-4o-mini |

### Flow

```mermaid
flowchart TD
    A["User message"] --> B["Agent (GPT-4o-mini)"]
    B --> C{"Which tool?"}
    C -->|"Ingredient question"| D["lookup_ingredient_safety"]
    C -->|"Product question"| E["query_user_products"]
    C -->|"Summary request"| F["summarize_safety"]
    C -->|"General question"| G["Direct response"]
    D --> H["ChromaDB"]
    E --> I["PostgreSQL"]
    F --> J["GPT-4o-mini"]
    D --> K["Agent synthesizes response"]
    E --> K
    F --> K
    G --> K
    K --> L["Response + persisted to chat_messages"]
```

### Multi-turn conversations

The agent maintains conversation history across messages:
1. User sends a message with a `session_id`
2. Backend loads previous messages for that session from `chat_messages`
3. History is passed to the agent as context
4. Agent can reference earlier tool calls and responses
5. All new messages (user, assistant, tool calls, tool results) are persisted

### Skin profile personalization

The agent's system prompt is dynamically built with the user's skin profile (skin type, concerns, goals, sensitivity). This lets the agent personalize responses without needing a tool call.

### Key files

| File | Purpose |
|------|---------|
| `app/services/agent.py` | Agent factory, system prompt, skin profile injection |
| `app/services/agent_tools.py` | Tool definitions (LangChain `@tool` decorators) |
| `app/routers/chat.py` | Chat API endpoints (POST /chat, GET messages, DELETE session) |
| `app/models/chat.py` | `ChatMessage` model (conversation persistence) |
| `app/schemas/chat.py` | Pydantic request/response schemas |
