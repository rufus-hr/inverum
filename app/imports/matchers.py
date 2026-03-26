"""
ModelMatcher — fuzzy matching of asset model names via pg_trgm.
Interface is AI-ready: find_candidates(name) -> list[Match].
Future: LLM can implement same interface for smarter matching.
"""
from sqlalchemy import text
from dataclasses import dataclass
from sqlalchemy.orm import Session


@dataclass
class Match:
    id: str           # asset_configuration.id
    name: str         # canonical name in DB
    similarity: float # 0.0 - 1.0, from pg_trgm


class ModelMatcher:
    """
    Find asset_configuration records that fuzzy-match the given model name.
    Uses pg_trgm similarity via raw SQL for performance.
    Threshold: 0.3 (configurable).
    """

    def __init__(self, threshold: float = 0.3, limit: int = 5):
        self.threshold = threshold
        self.limit = limit

    def find_candidates(self, db: Session, name: str) -> list[Match]:
       
        return_value = []

        result = db.execute(
            text("""
                    SELECT id, name, similarity(name, :q) AS sim
                    FROM asset_configurations
                    WHERE similarity(name, :q) > :threshold
                    ORDER BY sim DESC
                    LIMIT :limit
                """),
                {
                    "q": name,
                    "threshold": self.threshold,
                    "limit": self.limit,
                }
            ).all()

        for item in result:
            return_value.append(Match(id=str(item.id), name=item.name, similarity=item.sim))
        return return_value


matcher = ModelMatcher()
