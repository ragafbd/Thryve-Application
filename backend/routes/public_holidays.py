"""
Public Holidays Management Routes
Admin can manage public holidays, members can view them
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid

# Router
router = APIRouter(prefix="/api/holidays", tags=["Public Holidays"])

# Security
security = HTTPBearer()

# Database reference - will be set by init
db = None
_get_current_user_func = None
_check_permission_func = None

def init_router(database, auth_func, perm_func):
    """Initialize router with database and auth functions"""
    global db, _get_current_user_func, _check_permission_func
    db = database
    _get_current_user_func = auth_func
    _check_permission_func = perm_func

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Wrapper that calls the actual auth function"""
    if _get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _get_current_user_func(credentials)

def check_permission(user: dict, permission: str):
    """Wrapper for permission check"""
    return _check_permission_func(user, permission)


# Models
class PublicHoliday(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD format
    name: str
    description: Optional[str] = ""
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: Optional[str] = None

class PublicHolidayCreate(BaseModel):
    date: str  # YYYY-MM-DD format
    name: str
    description: Optional[str] = ""

class PublicHolidayUpdate(BaseModel):
    date: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# Default Indian public holidays for 2025-2026
DEFAULT_HOLIDAYS = [
    # 2025 Holidays
    {"date": "2025-01-26", "name": "Republic Day", "description": "National holiday celebrating the Constitution"},
    {"date": "2025-03-14", "name": "Holi", "description": "Festival of colors"},
    {"date": "2025-04-14", "name": "Ambedkar Jayanti", "description": "Birth anniversary of Dr. B.R. Ambedkar"},
    {"date": "2025-04-18", "name": "Good Friday", "description": "Christian observance"},
    {"date": "2025-05-01", "name": "May Day", "description": "International Workers' Day"},
    {"date": "2025-08-15", "name": "Independence Day", "description": "National independence day"},
    {"date": "2025-08-16", "name": "Janmashtami", "description": "Birth of Lord Krishna"},
    {"date": "2025-10-02", "name": "Gandhi Jayanti", "description": "Birth anniversary of Mahatma Gandhi"},
    {"date": "2025-10-02", "name": "Dussehra", "description": "Victory of good over evil"},
    {"date": "2025-10-20", "name": "Diwali", "description": "Festival of lights"},
    {"date": "2025-10-21", "name": "Diwali Holiday", "description": "Day after Diwali"},
    {"date": "2025-11-05", "name": "Guru Nanak Jayanti", "description": "Birth of Guru Nanak"},
    {"date": "2025-12-25", "name": "Christmas", "description": "Christian holiday"},
    # 2026 Holidays
    {"date": "2026-01-26", "name": "Republic Day", "description": "National holiday celebrating the Constitution"},
    {"date": "2026-03-10", "name": "Holi", "description": "Festival of colors"},
    {"date": "2026-04-03", "name": "Good Friday", "description": "Christian observance"},
    {"date": "2026-04-14", "name": "Ambedkar Jayanti", "description": "Birth anniversary of Dr. B.R. Ambedkar"},
    {"date": "2026-05-01", "name": "May Day", "description": "International Workers' Day"},
    {"date": "2026-08-15", "name": "Independence Day", "description": "National independence day"},
    {"date": "2026-09-04", "name": "Janmashtami", "description": "Birth of Lord Krishna"},
    {"date": "2026-10-02", "name": "Gandhi Jayanti", "description": "Birth anniversary of Mahatma Gandhi"},
    {"date": "2026-10-20", "name": "Dussehra", "description": "Victory of good over evil"},
    {"date": "2026-11-08", "name": "Diwali", "description": "Festival of lights"},
    {"date": "2026-11-09", "name": "Diwali Holiday", "description": "Day after Diwali"},
    {"date": "2026-11-25", "name": "Guru Nanak Jayanti", "description": "Birth of Guru Nanak"},
    {"date": "2026-12-25", "name": "Christmas", "description": "Christian holiday"},
]


# ==================== API ROUTES ====================

@router.get("")
async def get_holidays(year: Optional[int] = None, active_only: bool = True):
    """Get all public holidays, optionally filtered by year"""
    query = {}
    if active_only:
        query["is_active"] = True
    if year:
        query["date"] = {"$regex": f"^{year}"}
    
    holidays = await db.public_holidays.find(query, {"_id": 0}).sort("date", 1).to_list(500)
    return holidays


@router.get("/dates")
async def get_holiday_dates(year: Optional[int] = None):
    """Get just the dates of holidays (for frontend calendar blocking)"""
    query = {"is_active": True}
    if year:
        query["date"] = {"$regex": f"^{year}"}
    
    holidays = await db.public_holidays.find(query, {"_id": 0, "date": 1}).to_list(500)
    return [h["date"] for h in holidays]


@router.post("")
async def create_holiday(holiday_data: PublicHolidayCreate, current_user: dict = Depends(get_current_user)):
    """Create a new public holiday (admin only)"""
    check_permission(current_user, "all")
    
    # Validate date format
    try:
        datetime.strptime(holiday_data.date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    # Check if holiday already exists on this date
    existing = await db.public_holidays.find_one({"date": holiday_data.date, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail=f"A holiday already exists on {holiday_data.date}: {existing['name']}")
    
    holiday = PublicHoliday(
        **holiday_data.model_dump(),
        created_by=current_user.get("id")
    )
    
    await db.public_holidays.insert_one(holiday.model_dump())
    return holiday.model_dump()


@router.put("/{holiday_id}")
async def update_holiday(holiday_id: str, holiday_data: PublicHolidayUpdate, current_user: dict = Depends(get_current_user)):
    """Update a public holiday (admin only)"""
    check_permission(current_user, "all")
    
    existing = await db.public_holidays.find_one({"id": holiday_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    update_dict = {k: v for k, v in holiday_data.model_dump().items() if v is not None}
    
    # Validate date if provided
    if "date" in update_dict:
        try:
            datetime.strptime(update_dict["date"], "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    if update_dict:
        await db.public_holidays.update_one({"id": holiday_id}, {"$set": update_dict})
    
    updated = await db.public_holidays.find_one({"id": holiday_id}, {"_id": 0})
    return updated


@router.delete("/{holiday_id}")
async def delete_holiday(holiday_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a public holiday (admin only)"""
    check_permission(current_user, "all")
    
    result = await db.public_holidays.delete_one({"id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Holiday not found")
    
    return {"message": "Holiday deleted successfully"}


# ==================== SEED DEFAULT DATA ====================

async def seed_default_holidays(database=None):
    """Seed default Indian public holidays if not exist"""
    _db = database if database is not None else db
    
    # Check if any holidays exist
    count = await _db.public_holidays.count_documents({})
    if count == 0:
        for holiday_data in DEFAULT_HOLIDAYS:
            holiday = PublicHoliday(**holiday_data)
            await _db.public_holidays.insert_one(holiday.model_dump())
        print(f"Seeded {len(DEFAULT_HOLIDAYS)} default public holidays")


# Helper function to check if a date is a public holiday
async def is_public_holiday(date_str: str, database=None) -> bool:
    """Check if a given date is a public holiday"""
    _db = database if database is not None else db
    holiday = await _db.public_holidays.find_one({"date": date_str, "is_active": True})
    return holiday is not None
