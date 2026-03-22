import jwt                                                                                                                                                
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session                                                                                                                        
from app.core.config import settings
                                                                                                                                                          
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
                                                                                                                                                          
def get_current_tenant(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])                                                                            
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")                                                                                      

    tenant_id = payload.get("tenant_id")                                                                                                                          
    return tenant_id
