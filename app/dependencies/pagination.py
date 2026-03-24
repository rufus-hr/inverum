from fastapi import HTTPException

class PaginationParams:
    def __init__(self, page: int = 1, limit: int = 30):
        if page < 1: 
            raise HTTPException(status_code=400, detail="Invalid page number, must be 1 or greater")
        if limit < 1:
            raise HTTPException(status_code=400, detail="Invalid limit, must be 1 or greater")
        if limit >500:
            raise HTTPException(status_code=400, detail="Invalid limit, must 500 or less")
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit
