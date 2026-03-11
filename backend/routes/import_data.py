"""
Import data routes for Thryve Coworking
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/import", tags=["import"])

# Get database and auth from server.py
from server import db, get_current_user, check_permission


class ClientImportData(BaseModel):
    company_name: str
    signatory_name: Optional[str] = ""
    signatory_father_name: Optional[str] = ""
    signatory_designation: Optional[str] = ""
    signatory_pan: Optional[str] = ""
    signatory_aadhar: Optional[str] = ""
    company_gstin: Optional[str] = ""
    company_address: Optional[str] = ""
    space_type: Optional[str] = ""
    space_description: Optional[str] = ""
    total_seats: Optional[int] = 1
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    lock_in_months: Optional[int] = 6
    rate_per_seat: Optional[float] = 0
    security_deposit: Optional[float] = 0
    setup_charges: Optional[float] = 0


class ImportRequest(BaseModel):
    clients: List[dict]


class ImportResult(BaseModel):
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
    default_plan_id = default_plan["id"] if default_plan else "open-desk"
    default_plan_name = default_plan["name"] if default_plan else "Open Desk"
    
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
            setup_charges = 0
            lock_in_months = 6
            
            try:
                if client_data.get("total_seats"):
                    total_seats = int(client_data["total_seats"])
                if client_data.get("rate_per_seat"):
                    rate_per_seat = float(client_data["rate_per_seat"])
                if client_data.get("security_deposit"):
                    security_deposit = float(client_data["security_deposit"])
                if client_data.get("setup_charges"):
                    setup_charges = float(client_data["setup_charges"])
                if client_data.get("lock_in_months"):
                    lock_in_months = int(client_data["lock_in_months"])
            except (ValueError, TypeError) as e:
                errors.append({"row": row_num, "error": f"Invalid number format: {str(e)}"})
                continue
            
            # Calculate total rate
            total_rate = total_seats * rate_per_seat
            
            # Create company document
            company = {
                "id": str(uuid.uuid4()),
                "company_name": company_name,
                "company_address": client_data.get("company_address", ""),
                "company_gstin": client_data.get("company_gstin", ""),
                "company_pan": "",
                "company_email": "",
                "company_website": "",
                "signatory_name": client_data.get("signatory_name", ""),
                "signatory_father_name": client_data.get("signatory_father_name", ""),
                "signatory_designation": client_data.get("signatory_designation", ""),
                "signatory_aadhar": str(client_data.get("signatory_aadhar", "")).replace(".0", ""),
                "signatory_pan": client_data.get("signatory_pan", ""),
                "signatory_phone": "",
                "signatory_email": "",
                "plan_type_id": default_plan_id,
                "plan_name": default_plan_name,
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
                "space_type": client_data.get("space_type", ""),
                "space_description": client_data.get("space_description", ""),
                "isp_provider": "",
                "bandwidth_speed": "",
                "isp_account_id": "",
                "start_date": client_data.get("start_date", ""),
                "end_date": client_data.get("end_date", ""),
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
