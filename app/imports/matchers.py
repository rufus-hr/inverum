"""
ModelMatcher — fuzzy matching of asset model names via pg_trgm.
Interface is AI-ready: find_candidates(name) -> list[Match].
Future: LLM can implement same interface for smarter matching.
"""

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
        """
        Return up to `limit` asset_configurations ordered by similarity desc.
        Empty list if no match above threshold.
        """
        # TODO: implement
        # Hints:
        #   - use db.execute(text(...)) with pg_trgm similarity()
        #   - SQL: SELECT id, name, similarity(name, :q) AS sim
        #           FROM asset_configurations
        #           WHERE similarity(name, :q) > :threshold
        #           ORDER BY sim DESC LIMIT :limit
        raise NotImplementedError


matcher = ModelMatcher()
