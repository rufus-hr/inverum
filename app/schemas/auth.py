from pydantic import BaseModel                                                                                                                            
                  
class LoginRequest(BaseModel):
    tenant_slug: str
    provider: str
    provider_id: str
    password: str | None = None

class TokenResponse(BaseModel):                                                                                                                           
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshRequest(BaseModel):                                                                                                                           
    refresh_token: str
