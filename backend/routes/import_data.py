"""
Data Import Routes
One-time bulk import of client data from Excel
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/import", tags=["Import"])
security = HTTPBearer()

db = None
_get_current_user_func = None
_check_permission_func = None


def init_router(database, auth_func, perm_func):
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
    clients: List[dict]


class ImportResult(BaseModel):
    success_count: int
    error_count: int
    errors: List[dict]


# ─── Parsing Helpers ───

def _parse_int(val, default=0):
    """Safely parse an integer from various types."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return int(val)
    if isinstance(val, str) and not val.startswith("="):
        return int(float(val))
    return default


def _parse_float(val, default=0.0):
    """Safely parse a float, stripping currency symbols."""
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    if isinstance(val, str) and not val.startswith("="):
        return float(val.replace(",", "").replace("₹", ""))
    return default


def _parse_date(val):
    """Parse a date field into YYYY-MM-DD string."""
    if not val:
        return ""
    if hasattr(val, 'strftime'):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, str) and not val.startswith("="):
        return val
    return ""


def _parse_setup_charges(val):
    """Parse setup charges (can be text like 'Not applicable')."""
    if not val:
        return ""
    if isinstance(val, (int, float)):
        return str(int(val))
    return str(val)


def _clean_aadhar(val):
    """Clean Aadhar number (remove .0 if present)."""
    s = str(val or "")
    return s[:-2] if s.endswith(".0") else s


def _parse_numeric_fields(client_data):
    """Extract and validate numeric fields from client_data. Raises ValueError on bad input."""
    return {
        "total_seats": _parse_int(client_data.get("total_seats"), 1),
        "rate_per_seat": _parse_float(client_data.get("rate_per_seat")),
        "security_deposit": _parse_float(client_data.get("security_deposit")),
        "lock_in_months": _parse_int(client_data.get("lock_in_months"), 11),
    }


def _build_company_document(client_data, numerics, default_plan_id, default_plan_name, user_id):
    """Assemble a company document from parsed client data."""
    total_rate = numerics["total_seats"] * numerics["rate_per_seat"]
    start_date = _parse_date(client_data.get("start_date"))
    end_date = _parse_date(client_data.get("end_date"))

    return {
        "id": str(uuid.uuid4()),
        "company_name": client_data.get("company_name", "").strip(),
        "company_address": client_data.get("company_address", ""),
        "company_gstin": client_data.get("company_gstin", ""),
        "company_pan": client_data.get("signatory_pan", ""),
        "company_email": "",
        "company_website": "",
        "signatory_name": client_data.get("signatory_name", ""),
        "signatory_father_name": client_data.get("signatory_father_name", ""),
        "signatory_designation": client_data.get("signatory_designation", ""),
        "signatory_aadhar": _clean_aadhar(client_data.get("signatory_aadhar")),
        "signatory_pan": client_data.get("signatory_pan", ""),
        "signatory_phone": "",
        "signatory_email": "",
        "plan_type_id": default_plan_id,
        "plan_name": default_plan_name,
        "space_description": client_data.get("space_description", ""),
        "total_seats": numerics["total_seats"],
        "seats_occupied": 0,
        "rate_per_seat": numerics["rate_per_seat"],
        "discount_percent": 0,
        "total_rate": total_rate,
        "meeting_room_credits": 0,
        "credits_used": 0,
        "credits_reset_date": datetime.now(timezone.utc).isoformat(),
        "security_deposit": numerics["security_deposit"],
        "setup_charges": _parse_setup_charges(client_data.get("setup_charges")),
        "lock_in_months": numerics["lock_in_months"],
        "isp_provider": "",
        "bandwidth_speed": "",
        "isp_account_id": "",
        "start_date": start_date,
        "end_date": end_date or None,
        "status": "active",
        "termination_reason": None,
        "has_outstanding_dues": False,
        "notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "terminated_at": None,
        "created_by": user_id,
    }


async def _ensure_default_plan():
    """Get or create a default plan type."""
    plan = await db.plan_types.find_one({}, {"_id": 0})
    if plan:
        return plan["id"], plan["name"]

    plan = {
        "id": str(uuid.uuid4()),
        "name": "Open Desk",
        "category": "open_desk",
        "capacity": 1,
        "default_rate": 5000,
        "meeting_room_credits": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.plan_types.insert_one(plan)
    return plan["id"], plan["name"]


# ─── Route Handler ───

@router.post("/clients", response_model=ImportResult)
async def import_clients(
    request: ImportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Bulk import clients from Excel data."""
    check_permission(current_user, "create_invoice")

    success_count = 0
    errors = []
    default_plan_id, default_plan_name = await _ensure_default_plan()

    for client_data in request.clients:
        row_num = client_data.pop("_rowNum", "?")
        try:
            company_name = client_data.get("company_name", "").strip()
            if not company_name:
                errors.append({"row": row_num, "error": "Company name is required"})
                continue

            if await db.companies.find_one({"company_name": company_name}):
                errors.append({"row": row_num, "error": f"Company '{company_name}' already exists"})
                continue

            numerics = _parse_numeric_fields(client_data)
            company = _build_company_document(
                client_data, numerics, default_plan_id, default_plan_name, current_user.get("id")
            )
            await db.companies.insert_one(company)
            success_count += 1

        except (ValueError, TypeError) as e:
            errors.append({"row": row_num, "error": f"Invalid number format: {str(e)}"})
        except Exception as e:
            errors.append({"row": row_num, "error": str(e)})

    return ImportResult(success_count=success_count, error_count=len(errors), errors=errors)
