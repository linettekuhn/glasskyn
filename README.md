# Glasskyn

Glasskyn is a mobile skincare companion app built with React Native, TypeScript, FastAPI, and PostgreSQL, featuring a LangChain agent, RAG-based ingredient safety analysis, and a computer vision pipeline for product scanning.

It helps users track cosmetic expiry dates, understand ingredient safety, and manage personalized skincare routines through AI-powered chat and OCR-driven scanning.

## Download and Visuals

Available now in the [App Store](https://apps.apple.com/us/app/glasskyn/id6804337287)!

<img width="2551" height="1745" alt="glasskyn" src="https://github.com/user-attachments/assets/507b588a-4c85-442a-8561-3fda4e9d68d5" />


## Features

- Multi-step scan flow: capture front/back labels and auto-extract product name, brand, category, PAO (expiry) date, and expiration date
- Barcode lookup via Open Beauty Facts, with LLM fallback when a product isn't found
- Expiry tracking: computed expiry dates (opened date + PAO), expiry badges on product cards, dedicated expiring-products screen with replace/delete actions
- Ingredient safety analysis powered by a RAG pipeline over a ChromaDB vector store, with safety data compiled from EWG Skin Deep, INCIDecoder, and the Cosmetic Ingredient Review (CIR)
- AI chat assistant for ingredient questions, product lookups, routine generation/modification, and safety summaries
- Skin profile onboarding and personalized routine builder (manual, template-based, or AI-generated) with checklist AM/PM steps
- Home dashboard: daily greeting, affirmation, routine-status card, water intake card, expiring products, quick entry to scanner/chat
- Water intake tracking: goal calculated from user metrics, month-view calendar, hydration reminders
- Notifications: morning/night routine reminders, water and expiry alerts, per-user timezone scheduling, push via device tokens

## CV & Agent Pipelines

### CV Pipeline

The computer vision pipeline uses Google Cloud Vision API for OCR and a fine-tuned ResNet-50 PyTorch model for product category classification, with an image-fusion refinement step that combines signal from both front and back label captures. It extracts structured data (PAO months, expiration date, product category, name, brand) from user-captured product photos and feeds the results into the scan flow for user confirmation.

#### Architecture

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

    F --> F1["Regex PAO + expiration date parse"]
    F --> F2["Keyword category (fallback)"]
    F --> F3["Barcode lookup → LLM fallback"]

    F1 --> G["ScanResult<br/>category_method: ml_classifier"]
    F2 --> G
    F3 --> G

    G --> H["Confirm Screen<br/>(user reviews/edits)"]
```

#### How it works

1. **Capture** — user photographs the front and back labels via the Expo camera; images upload directly to S3 via presigned URLs.
2. **Process** — the backend downloads both images and runs OCR (Google Cloud Vision) and the ResNet-50 classifier concurrently via `asyncio.gather`.
3. **Classify** — the classifier predicts `skincare`, `makeup`, or `haircare`, refined with an image-fusion step when both front and back captures are available. Predictions above a 0.7 confidence threshold are accepted (`category_method: "ml_classifier"`); below threshold, the pipeline falls back to keyword matching on the OCR text. When both images are available, the higher-confidence result wins.
4. **Extract** — regex parses the PAO (Period After Opening) value and expiration date from OCR text (e.g. `12M`, `6 months`); a barcode scan attempts an Open Beauty Facts lookup for product name and brand, falling back to an LLM extraction from OCR text if that fails.
5. **Confirm** — the combined result (category, PAO, expiration date, name, brand) is persisted in PostgreSQL and returned to the frontend for user review before saving.

#### Model details

- Fine-tuned ResNet-50 for three-class classification, trained on Open Beauty Facts product images (~200 category tags mapped to 3 classes)
- Training pipeline uses weighted sampling, label smoothing, and early stopping
- Built with: PyTorch, TorchVision, Pillow, scikit-learn, HuggingFace Datasets

---

### Agent Pipeline

Glasskyn uses a LangChain agent to power its chat assistant. The agent runs a ReAct loop (Reason + Act) to decide which tools to call based on the user's question, then synthesizes a response from the tool results.

#### Tools

| Tool | Description | Backed by |
|------|-------------|-----------|
| `lookup_ingredient_safety` | Look up safety scores, risks, and benefits for cosmetic ingredients | ChromaDB (ingredient safety embeddings) |
| `query_user_products` | Query the user's saved products, filterable by type or category | PostgreSQL (`products` table) |
| `summarize_safety` | Convert raw ingredient data into a plain-language safety summary | GPT-4o-mini |
| `generate_routine` | Auto-generate an AM/PM routine from the user's saved products and skin profile | PostgreSQL + GPT-4o-mini |
| `recommend_products` | Suggest product types or specific products based on skin profile and goals | ChromaDB + PostgreSQL |
| `modify_routine` | Adjust an existing routine's steps based on user feedback | PostgreSQL (`routines` table) |

#### Ingredient Safety Dataset

The `lookup_ingredient_safety` tool draws from a curated dataset of 55 ingredients (`backend/data/ingredients/dataset.json`), each tagged with its source(s):

- EWG Skin Deep (44 ingredients)
- INCIDecoder (23 ingredients)
- CIR / Cosmetic Ingredient Review (46 ingredients)

Each record includes data availability, irritancy, comedogenicity, known risks, and regulatory status fields, compiled from the sources listed above.

#### Flow

```mermaid
flowchart TD
    A["User message"] --> B["Agent (GPT-4o-mini)"]
    B --> C{"Which tool?"}
    C -->|"Ingredient question"| D["lookup_ingredient_safety"]
    C -->|"Product question"| E["query_user_products"]
    C -->|"Summary request"| F["summarize_safety"]
    C -->|"Routine request"| G2["generate_routine / modify_routine"]
    C -->|"Product recommendation"| G3["recommend_products"]
    C -->|"General question"| G["Direct response"]
    D --> H["ChromaDB"]
    E --> I["PostgreSQL"]
    F --> J["GPT-4o-mini"]
    G2 --> I
    G3 --> H
    D --> K["Agent synthesizes response"]
    E --> K
    F --> K
    G --> K
    G2 --> K
    G3 --> K
    K --> L["Response + persisted to chat_messages"]
```

#### Conversation & personalization

- Each message carries a `session_id`; the backend loads prior messages from `chat_messages` and passes them to the agent as context, so it can reference earlier tool calls and responses.
- Context is managed with a sliding window plus a running summary, keeping long conversations within token limits without losing earlier context.
- All new messages (user, assistant, tool calls, tool results) are persisted after each turn.
- The agent's system prompt is dynamically built from the user's skin profile (type, concerns, goals, sensitivity), letting it personalize answers without an extra tool call.

#### Key files

| File | Purpose |
|------|---------|
| `app/services/agent.py` | Agent factory, system prompt, skin profile injection |
| `app/services/agent_tools.py` | Tool definitions (LangChain `@tool` decorators) |
| `app/routers/chat.py` | Chat API endpoints (POST /chat, GET messages, DELETE session) |
| `app/models/chat.py` | `ChatMessage` model (conversation persistence) |
| `app/schemas/chat.py` | Pydantic request/response schemas |

---

## Built With

- **Frontend:** React Native, Expo SDK 54, expo-router, expo-camera, expo-notifications, expo-secure-store
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, APScheduler (reminders)
- **Storage:** AWS S3 (presigned URLs)
- **Email:** AWS SES (password reset codes)
- **CV/ML:** PyTorch, TorchVision, Google Cloud Vision API, scikit-learn
- **Agent:** LangChain, LangGraph, ChromaDB, OpenAI GPT-4o-mini
- **Deployment:** Docker, CI/CD
