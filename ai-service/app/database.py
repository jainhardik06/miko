from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from loguru import logger
import os
import math

from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError

@dataclass
class TreeRecord:
    id: Any
    lat: float
    lon: float
    phash: Optional[str]
    vector: Optional[list]  # stored as list[float]


class MongoRepo:
    def __init__(self):
        self.uri = os.getenv('MONGO_URI')
        self.db_name = os.getenv('MONGO_DB', 'miko')
        self.coll_name = os.getenv('MONGO_COLLECTION', 'trees')
        self.client: Optional[MongoClient] = None
        self.db = None
        self.coll = None

    def connect(self):
        if not self.uri:
            logger.warning("MONGO_URI not set; running in degraded mode (no dedupe)")
            return
        try:
            self.client = MongoClient(self.uri)
            self.db = self.client[self.db_name]
            self.coll = self.db[self.coll_name]
            # Ensure geospatial index exists
            self.coll.create_index([('location', '2dsphere')])
            # Optional: index for phash
            self.coll.create_index([('phash', ASCENDING)])
            logger.info("Connected to Mongo and ensured indices")
        except PyMongoError as e:
            logger.error(f"Mongo connection failed: {e}")
            self.client = None
            self.db = None
            self.coll = None

    def is_connected(self) -> bool:
        return self.coll is not None

    def find_nearby(self, lat: float, lon: float, radius_m: float) -> List[TreeRecord]:
        if not self.is_connected():
            return []
        try:
            docs = list(self.coll.find({
                'location': {
                    '$near': {
                        '$geometry': { 'type': 'Point', 'coordinates': [lon, lat] },
                        '$maxDistance': radius_m
                    }
                }
            }, projection={'_id': 1, 'location': 1, 'phash': 1, 'vector': 1}).limit(100))
            out: List[TreeRecord] = []
            for d in docs:
                coord = d.get('location', {}).get('coordinates', [None, None])
                out.append(TreeRecord(
                    id=d.get('_id'),
                    lat=float(coord[1]),
                    lon=float(coord[0]),
                    phash=d.get('phash'),
                    vector=d.get('vector')
                ))
            return out
        except PyMongoError as e:
            logger.error(f"Mongo query failed: {e}")
            return []
