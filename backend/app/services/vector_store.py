from __future__ import annotations

import json
import logging
from pathlib import Path

import chromadb
from chromadb.config import Settings
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

from app.core.config import (
    CHROMADB_PATH,
    EMBEDDING_MODEL,
    OPENAI_API_KEY,
    BACKEND_DIR,
)

logger = logging.getLogger(__name__)

COLLECTION_NAME = "ingredient_safety"
DATASET_PATH = BACKEND_DIR / "data" / "ingredients" / "dataset.json"

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=CHROMADB_PATH,
            settings=Settings(anonymized_telemetry=False),
        )
        logger.info("ChromaDB persistent client initialized at %s", CHROMADB_PATH)
    return _client


def _get_embedding_function() -> OpenAIEmbeddingFunction:
    return OpenAIEmbeddingFunction(
        api_key=OPENAI_API_KEY,
        model_name=EMBEDDING_MODEL,
    )


def get_collection() -> chromadb.Collection:
    global _collection
    if _collection is None:
        client = _get_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=_get_embedding_function(),
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "Collection '%s' ready (%d documents)", COLLECTION_NAME, _collection.count()
        )
    return _collection


def _build_document(record: dict) -> str:
    parts = [record["ingredient_name"]]

    if record.get("benefits"):
        parts.append("Benefits: " + ", ".join(record["benefits"]))

    if record.get("known_risks"):
        parts.append("Risks: " + ", ".join(record["known_risks"]))

    if record.get("functions"):
        parts.append("Functions: " + ", ".join(record["functions"]))

    skin = record.get("skin_type_considerations", {})
    for st in ("sensitive", "dry", "oily", "combination"):
        if st in skin:
            parts.append(f"{st.title()} skin: {skin[st]}")

    return ". ".join(parts) + "."


def _build_metadata(record: dict) -> dict:
    functions = record.get("functions", [])
    return {
        "ingredient_name": record["ingredient_name"],
        "safety_score": record.get("safety_score", 0),
        "data_availability": record.get("data_availability", "unknown"),
        "irritancy": record.get("irritancy", 0),
        "comedogenicity": record.get("comedogenicity", 0),
        "category": functions[0] if functions else "unknown",
        "known_risks_count": len(record.get("known_risks", [])),
        "known_risks": json.dumps(record.get("known_risks", [])),
        "benefits": json.dumps(record.get("benefits", [])),
    }


def upsert_ingredient(record: dict) -> None:
    collection = get_collection()
    doc_id = record["id"]
    document = _build_document(record)
    metadata = _build_metadata(record)

    collection.upsert(
        ids=[doc_id],
        documents=[document],
        metadatas=[metadata],
    )
    logger.debug("Upserted ingredient: %s", doc_id)


def upsert_all(dataset_path: Path | None = None) -> int:
    path = dataset_path or DATASET_PATH
    with open(path, encoding="utf-8") as f:
        dataset = json.load(f)

    collection = get_collection()

    ids = []
    documents = []
    metadatas = []

    for record in dataset:
        ids.append(record["id"])
        documents.append(_build_document(record))
        metadatas.append(_build_metadata(record))

    collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
    count = collection.count()
    logger.info("Upserted %d ingredients (collection total: %d)", len(ids), count)
    return len(ids)


def query_ingredients(text: str, n_results: int = 5) -> list[dict]:
    collection = get_collection()

    results = collection.query(
        query_texts=[text],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    output = []
    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for i, doc_id in enumerate(ids):
        output.append({
            "id": doc_id,
            "document": documents[i] if i < len(documents) else None,
            "metadata": metadatas[i] if i < len(metadatas) else None,
            "distance": distances[i] if i < len(distances) else None,
        })

    return output


def query_ingredients_batch(texts: list[str], n_results: int = 1) -> dict[str, list[dict]]:
    if not texts:
        return {}

    collection = get_collection()

    results = collection.query(
        query_texts=texts,
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    output: dict[str, list[dict]] = {}
    all_ids = results.get("ids", [])
    all_documents = results.get("documents", [])
    all_metadatas = results.get("metadatas", [])
    all_distances = results.get("distances", [])

    for idx, text in enumerate(texts):
        doc_ids = all_ids[idx] if idx < len(all_ids) else []
        docs = all_documents[idx] if idx < len(all_documents) else []
        metas = all_metadatas[idx] if idx < len(all_metadatas) else []
        dists = all_distances[idx] if idx < len(all_distances) else []

        entries = []
        for i, doc_id in enumerate(doc_ids):
            entries.append({
                "id": doc_id,
                "document": docs[i] if i < len(docs) else None,
                "metadata": metas[i] if i < len(metas) else None,
                "distance": dists[i] if i < len(dists) else None,
            })
        output[text] = entries

    return output


def delete_ingredient(ingredient_id: str) -> None:
    collection = get_collection()
    collection.delete(ids=[ingredient_id])
    logger.info("Deleted ingredient: %s", ingredient_id)


def reset_collection() -> None:
    global _collection
    client = _get_client()
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass
    _collection = None
    logger.info("Collection '%s' deleted", COLLECTION_NAME)
