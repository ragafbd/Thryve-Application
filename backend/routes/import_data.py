"""
Data Import Routes
One-time bulk import of client data from Excel
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/import", tags=["Import"])
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
    if _get_current_user_func is None:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await _get_current_user_func(credentials)

def check_permission(user: dict, permission: str):
    return _check_permission_func(user, permission)


class ImportRequest(BaseModel):
    """Bulk import request"""
    clients: List[dict]


class ImportResult(BaseModel):
    """Import result"""
    success_count: int
    error_count: int
    errors: List[dict]


@router.post("/clients", response_model=ImportResult)
async def import_clients(
    request: ImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Bulk import clients from Excel data"""
    check_permission(current_user, "create_invoice")
    
    success_count = 0
    errors = []
    
    # Get default plan
    default_plan = await db.plan_types.find_one({}, {"_id": 0})
    if not default_plan:
        # Create a default plan type
        default_plan = {
            "id": str(uuid.uuid4()),
            "name": "Open Desk",
            "category": "open_desk",
            "capacity": 1,
            "default_rate": 5000,
            "meeting_room_credits": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.plan_types.insert_one(default_plan)
    
    default_plan_id = default_plan["id"]
    default_plan_name = default_plan["name"]
    
    for client_data in request.clients:
        try:
            row_num = client_data.pop("_rowNum", "?")
            company_name = client_data.get("company_name", "").strip()
            
            if not company_name:
                errors.append({"row": row_num, "error": "Company name is required"})
                continue
            
            # Check if company already exists
            existing = await db.companies.find_one({"company_name": company_name})
            if existing:
                errors.append({"row": row_num, "error": f"Company '{company_name}' already exists"})
                continue
            
            # Parse numeric fields
            total_seats = 1
            rate_per_seat = 0
            security_deposit = 0
            lock_in_months = 11
            
            try:
                if client_data.get("total_seats"):
                    val = client_data["total_seats"]
                    if isinstance(val, (int, float)):
                        total_seats = int(val)
                    elif isinstance(val, str) and not val.startswith("="):
                        total_seats = int(float(val))
                
                if client_data.get("rate_per_seat"):
                    val = client_data["rate_per_seat"]
                    if isinstance(val, (int, float)):
                        rate_per_seat = float(val)
                    elif isinstance(val, str) and not val.startswith("="):
                        rate_per_seat = float(val.replace(",", "").replace("₹", ""))
                
                if client_data.get("security_deposit"):
                    val = client_data["security_deposit"]
                    if isinstance(val, (int, float)):
                        security_deposit = float(val)
                    elif isinstance(val, str) and not val.startswith("="):
                        security_deposit = float(val.replace(",", "").replace("₹", ""))
                
                if client_data.get("lock_in_months"):
                    val = client_data["lock_in_months"]
                    if isinstance(val, (int, float)):
                        lock_in_months = int(val)
                    elif isinstance(val, str) and not val.startswith("="):
                        lock_in_months = int(float(val))
                        
            except (ValueError, TypeError) as e:
                errors.append({"row": row_num, "error": f"Invalid number format: {str(e)}"})
                continue
            
            # Parse dates - handle datetime objects
            start_date = ""
            if client_data.get("start_date"):
                sd = client_data["start_date"]
                if hasattr(sd, 'strftime'):
                    start_date = sd.strftime("%Y-%m-%d")
                elif isinstance(sd, str) and not sd.startswith("="):
                    start_date = sd
            
            end_date = ""
            if client_data.get("end_date"):
                ed = client_data["end_date"]
                if hasattr(ed, 'strftime'):
                    end_date = ed.strftime("%Y-%m-%d")
                elif isinstance(ed, str) and not ed.startswith("="):
                    end_date = ed
            
            # Parse setup charges (can be text like "Not applicable")
            setup_charges = ""
            if client_data.get("setup_charges"):
                sc = client_data["setup_charges"]
                if isinstance(sc, (int, float)):
                    setup_charges = str(int(sc))
                else:
                    setup_charges = str(sc)
            
            # Calculate total rate
            total_rate = total_seats * rate_per_seat
            
            # Clean Aadhar number (remove .0 if present)
            signatory_aadhar = str(client_data.get("signatory_aadhar", ""))
            if signatory_aadhar.endswith(".0"):
                signatory_aadhar = signatory_aadhar[:-2]
            
            # Create company document
            company = {
                "id": str(uuid.uuid4()),
                "company_name": company_name,
                "company_address": client_data.get("company_address", ""),
                "company_gstin": client_data.get("company_gstin", ""),
                "company_pan": client_data.get("signatory_pan", ""),  # Use signatory PAN as company PAN
                "company_email": "",
                "company_website": "",
                "signatory_name": client_data.get("signatory_name", ""),
                "signatory_father_name": client_data.get("signatory_father_name", ""),
                "signatory_designation": client_data.get("signatory_designation", ""),
                "signatory_aadhar": signatory_aadhar,
                "signatory_pan": client_data.get("signatory_pan", ""),
                "signatory_phone": "",
                "signatory_email": "",
                "plan_type_id": default_plan_id,
                "plan_name": default_plan_name,
                "space_description": client_data.get("space_description", ""),
                "total_seats": total_seats,
                "seats_occupied": 0,
                "rate_per_seat": rate_per_seat,
                "discount_percent": 0,
                "total_rate": total_rate,
                "meeting_room_credits": 0,
                "credits_used": 0,
                "credits_reset_date": datetime.now(timezone.utc).isoformat(),
                "security_deposit": security_deposit,
                "setup_charges": setup_charges,
                "lock_in_months": lock_in_months,
                "isp_provider": "",
                "bandwidth_speed": "",
                "isp_account_id": "",
                "start_date": start_date,
                "end_date": end_date if end_date else None,
                "status": "active",
                "termination_reason": None,
                "has_outstanding_dues": False,
                "notes": "",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "terminated_at": None,
                "created_by": current_user.get("id")
            }
            
            await db.companies.insert_one(company)
            success_count += 1
            
        except Exception as e:
            row_num = client_data.get("_rowNum", "?")
            errors.append({"row": row_num, "error": str(e)})
    
    return ImportResult(
        success_count=success_count,
        error_count=len(errors),
        errors=errors
    )
