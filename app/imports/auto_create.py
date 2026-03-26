
import uuid
from sqlalchemy.orm import Session
from app.models.location import Location




def get_or_create_pending_location(                                                                                                                       
      db: Session,                                                                                                                                          
      tenant_id: uuid.UUID,                                                                                                                                 
      import_job_id: uuid.UUID,                                                                                                                             
      name: str,                                                                                                                                          
      parent_id: uuid.UUID | None = None,                                                                                                                   
  ) -> Location:
    query = db.query(Location).filter(
        Location.tenant_id == tenant_id,
        Location.name == name,
        Location.parent_id == parent_id,
        Location.deleted_at.is_(None),
    ).first()

    if query is None:
        new_location = Location(
            tenant_id = tenant_id,
            name = name,
            parent_id = parent_id,
            import_job_id=import_job_id,
            is_active = False,
        )
        db.add(new_location)
        return new_location
    else:
        return query
