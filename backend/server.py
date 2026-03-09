from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from io import BytesIO
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
import urllib.request

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# GST Rate
GST_RATE = 18  # 18% GST (9% CGST + 9% SGST or 18% IGST)

# Thryve Coworking Company Details
COMPANY_DETAILS = {
    "name": "Thryve Coworking",
    "address": "123 Business Park, Tech Hub, Bangalore - 560001",
    "gstin": "29AABCT1234F1Z5",
    "email": "billing@thryvecoworking.com",
    "phone": "+91 80 1234 5678"
}

# Define Models
class ClientBase(BaseModel):
    company_name: str
    address: str
    gstin: str

class ClientCreate(ClientBase):
    pass

class Client(ClientBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LineItem(BaseModel):
    description: str
    service_type: str  # monthly_rental, security_deposit, setup_charges, day_pass, meeting_room
    quantity: float = 1
    rate: float
    is_taxable: bool = True  # GST applicable or not
    hsn_sac: Optional[str] = None  # HSN/SAC code
    unit: str = "Units"  # Units, Month, Day, Hour
    # Prorate fields
    is_prorated: bool = False
    prorate_days: Optional[int] = None  # Number of days to charge
    prorate_total_days: Optional[int] = None  # Total days in billing period (usually 30)

class InvoiceLineItem(LineItem):
    amount: float = 0
    cgst: float = 0
    sgst: float = 0
    total: float = 0

class InvoiceCreate(BaseModel):
    client_id: str
    invoice_date: str
    due_date: Optional[str] = None
    line_items: List[LineItem]
    notes: Optional[str] = ""

class InvoiceStatusUpdate(BaseModel):
    status: str  # pending, paid, overdue
    payment_date: Optional[str] = None

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    invoice_date: str
    due_date: Optional[str] = None
    client: dict
    line_items: List[dict]
    subtotal: float
    total_cgst: float
    total_sgst: float
    total_tax: float
    grand_total: float
    notes: str = ""
    status: str = "pending"  # pending, paid, overdue
    payment_date: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    company: dict = Field(default_factory=lambda: COMPANY_DETAILS)

# Helper function to generate invoice number
async def generate_invoice_number():
    # Get the highest invoice number to generate sequential number
    year = datetime.now().year
    month = datetime.now().month
    prefix = f"THR/{year}/{month:02d}/"
    
    # Find the highest number for this month
    latest = await db.invoices.find_one(
        {"invoice_number": {"$regex": f"^{prefix}"}},
        {"invoice_number": 1},
        sort=[("invoice_number", -1)]
    )
    
    if latest:
        # Extract the number part and increment
        try:
            last_num = int(latest["invoice_number"].split("/")[-1])
            next_num = last_num + 1
        except:
            next_num = 1
    else:
        next_num = 1
    
    return f"{prefix}{next_num:04d}"

# Calculate line item with GST
def calculate_line_item(item: LineItem) -> dict:
    # Handle prorate calculation
    if item.is_prorated and item.prorate_days and item.prorate_total_days:
        prorate_rate = (item.rate / item.prorate_total_days) * item.prorate_days
        amount = item.quantity * prorate_rate
    else:
        amount = item.quantity * item.rate
    
    if item.is_taxable:
        cgst = round(amount * (GST_RATE / 2) / 100, 2)
        sgst = round(amount * (GST_RATE / 2) / 100, 2)
    else:
        cgst = 0
        sgst = 0
    total = amount + cgst + sgst
    return {
        "description": item.description,
        "service_type": item.service_type,
        "quantity": item.quantity,
        "rate": item.rate,
        "is_taxable": item.is_taxable,
        "hsn_sac": item.hsn_sac or "",
        "unit": item.unit,
        "is_prorated": item.is_prorated,
        "prorate_days": item.prorate_days,
        "prorate_total_days": item.prorate_total_days,
        "amount": round(amount, 2),
        "cgst": cgst,
        "sgst": sgst,
        "total": round(total, 2)
    }

# API Routes

@api_router.get("/")
async def root():
    return {"message": "Thryve Invoice Generator API"}

@api_router.get("/company")
async def get_company_details():
    return COMPANY_DETAILS

# Client CRUD
@api_router.post("/clients", response_model=Client)
async def create_client(client_data: ClientCreate):
    client_obj = Client(**client_data.model_dump())
    doc = client_obj.model_dump()
    await db.clients.insert_one(doc)
    return client_obj

@api_router.get("/clients", response_model=List[Client])
async def get_clients():
    clients = await db.clients.find({}, {"_id": 0}).to_list(1000)
    return clients

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str):
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, client_data: ClientCreate):
    existing = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = client_data.model_dump()
    await db.clients.update_one({"id": client_id}, {"$set": update_data})
    
    updated = await db.clients.find_one({"id": client_id}, {"_id": 0})
    return updated

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"message": "Client deleted successfully"}

# Invoice CRUD
@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice_data: InvoiceCreate):
    # Get client details
    client = await db.clients.find_one({"id": invoice_data.client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Generate invoice number
    invoice_number = await generate_invoice_number()
    
    # Calculate line items
    calculated_items = [calculate_line_item(item) for item in invoice_data.line_items]
    
    # Calculate totals
    subtotal = sum(item["amount"] for item in calculated_items)
    total_cgst = sum(item["cgst"] for item in calculated_items)
    total_sgst = sum(item["sgst"] for item in calculated_items)
    total_tax = total_cgst + total_sgst
    grand_total = subtotal + total_tax
    
    # Create invoice object
    invoice_obj = Invoice(
        invoice_number=invoice_number,
        invoice_date=invoice_data.invoice_date,
        due_date=invoice_data.due_date,
        client=client,
        line_items=calculated_items,
        subtotal=round(subtotal, 2),
        total_cgst=round(total_cgst, 2),
        total_sgst=round(total_sgst, 2),
        total_tax=round(total_tax, 2),
        grand_total=round(grand_total, 2),
        notes=invoice_data.notes or "",
        status="pending"
    )
    
    doc = invoice_obj.model_dump()
    # Remove None values to avoid storing them
    doc = {k: v for k, v in doc.items() if v is not None}
    await db.invoices.insert_one(doc)
    return invoice_obj

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices():
    invoices = await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return invoices

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Invoice deleted successfully"}

@api_router.patch("/invoices/{invoice_id}/status", response_model=Invoice)
async def update_invoice_status(invoice_id: str, status_update: InvoiceStatusUpdate):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    update_data = {"status": status_update.status}
    if status_update.status == "paid" and status_update.payment_date:
        update_data["payment_date"] = status_update.payment_date
    elif status_update.status == "paid":
        update_data["payment_date"] = datetime.now(timezone.utc).isoformat().split('T')[0]
    
    await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return updated

# Dashboard stats
@api_router.get("/stats")
async def get_stats():
    total_invoices = await db.invoices.count_documents({})
    total_clients = await db.clients.count_documents({})
    
    # Calculate totals by status
    invoices = await db.invoices.find({}, {"_id": 0, "grand_total": 1, "status": 1, "due_date": 1}).to_list(1000)
    total_revenue = sum(inv.get("grand_total", 0) for inv in invoices)
    
    # Count by status
    paid_count = sum(1 for inv in invoices if inv.get("status") == "paid")
    pending_count = sum(1 for inv in invoices if inv.get("status") == "pending")
    overdue_count = sum(1 for inv in invoices if inv.get("status") == "overdue")
    
    # Calculate pending/overdue amounts
    pending_amount = sum(inv.get("grand_total", 0) for inv in invoices if inv.get("status") in ["pending", "overdue"])
    paid_amount = sum(inv.get("grand_total", 0) for inv in invoices if inv.get("status") == "paid")
    
    return {
        "total_invoices": total_invoices,
        "total_clients": total_clients,
        "total_revenue": round(total_revenue, 2),
        "paid_count": paid_count,
        "pending_count": pending_count,
        "overdue_count": overdue_count,
        "pending_amount": round(pending_amount, 2),
        "paid_amount": round(paid_amount, 2)
    }

# Check and update overdue invoices
@api_router.post("/invoices/check-overdue")
async def check_overdue_invoices():
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    # Find pending invoices with due_date before today
    result = await db.invoices.update_many(
        {"status": "pending", "due_date": {"$lt": today}},
        {"$set": {"status": "overdue"}}
    )
    return {"updated_count": result.modified_count}

# Download Excel Template
@api_router.get("/excel/template")
async def download_excel_template():
    wb = Workbook()
    ws = wb.active
    ws.title = "Invoice Data"
    
    # Define headers - One row per client with all service types as columns
    headers = [
        "Client Company Name", "Client Address", "Client GSTIN",
        "Invoice Date (YYYY-MM-DD)", "Due Date (YYYY-MM-DD)",
        "Monthly Plan Fee", "Prorate Days", "Prorate Total Days",
        "Day Pass Rate", "Day Pass Qty",
        "Security Deposit",
        "Setup Charges",
        "Meeting Room Rate", "Meeting Room Hours",
        "Additional Charges", "Additional Charges Description",
        "Notes"
    ]
    
    # Style for headers
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2E375B", end_color="2E375B", fill_type="solid")
    header_fill_orange = PatternFill(start_color="FFA14A", end_color="FFA14A", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Column categories for coloring
    client_cols = [1, 2, 3]  # Client info
    date_cols = [4, 5]  # Dates
    service_cols = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]  # Services
    notes_col = [17]
    
    # Write headers
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        if col in service_cols:
            cell.fill = header_fill_orange
            cell.font = Font(bold=True, color="2E375B")
        else:
            cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
        ws.column_dimensions[cell.column_letter].width = 18
    
    # Wider columns for address and description
    ws.column_dimensions['B'].width = 35
    ws.column_dimensions['P'].width = 25
    ws.column_dimensions['Q'].width = 30
    
    # Add sample data rows
    sample_data = [
        # Client with monthly plan + security deposit
        ["ABC Tech Pvt Ltd", "123 Tech Park, Sector 15, Faridabad, Haryana 121007", "06AABCT1234F1Z5",
         "2026-01-01", "2026-01-15",
         "15000", "", "",  # Monthly plan (full month)
         "", "",  # No day pass
         "30000",  # Security deposit
         "",  # No setup
         "", "",  # No meeting room
         "", "",  # No additional
         "New member - January billing"],
        # Client with prorated plan + setup
        ["XYZ Solutions", "456 Business Hub, Sector 21, Faridabad, Haryana 121002", "06BBXYZ5678G1Z8",
         "2026-01-15", "2026-01-31",
         "12000", "15", "30",  # Prorated (15 of 30 days)
         "", "",  # No day pass
         "",  # No security
         "5000",  # Setup charges
         "", "",  # No meeting room
         "", "",  # No additional
         "Mid-month joiner"],
        # Client with day pass + meeting room
        ["Startup Inc", "789 Innovation Center, Faridabad, Haryana 121003", "06CCSTU9012H1Z2",
         "2026-01-20", "2026-01-25",
         "", "", "",  # No monthly
         "500", "3",  # 3 day passes
         "",  # No security
         "",  # No setup
         "1000", "4",  # 4 hours meeting room
         "2000", "Printing & Courier",  # Additional charges
         "Guest usage"],
    ]
    
    for row_num, row_data in enumerate(sample_data, 2):
        for col, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col, value=value)
            cell.border = thin_border
    
    # Add instructions sheet
    ws_instructions = wb.create_sheet("Instructions")
    instructions = [
        ["THRYVE COWORKING - INVOICE EXCEL TEMPLATE"],
        [""],
        ["HOW TO USE:"],
        ["1. Fill one row per client/invoice"],
        ["2. Only fill the service columns that apply - empty columns are ignored"],
        ["3. GST (18%) is auto-calculated for applicable services"],
        [""],
        ["COLUMN GUIDE:"],
        [""],
        ["CLIENT DETAILS (Required):"],
        ["Client Company Name", "Company name as it should appear on invoice"],
        ["Client Address", "Full address including city, state, PIN"],
        ["Client GSTIN", "GST Identification Number (15 characters)"],
        [""],
        ["DATES (Required):"],
        ["Invoice Date", "Format: YYYY-MM-DD (e.g., 2026-01-01)"],
        ["Due Date", "Format: YYYY-MM-DD - Payment due date"],
        [""],
        ["SERVICES (Fill only what applies - leave others empty):"],
        [""],
        ["Monthly Plan Fee", "GST APPLICABLE - Full monthly desk/cabin rate"],
        ["Prorate Days", "Optional - Days to charge (for partial month)"],
        ["Prorate Total Days", "Optional - Total days in period (default: 30)"],
        ["", "Example: Fee=15000, Days=15, Total=30 → Charges ₹7,500 + GST"],
        [""],
        ["Day Pass Rate", "GST APPLICABLE - Rate per day pass"],
        ["Day Pass Qty", "Number of day passes (default: 1)"],
        [""],
        ["Security Deposit", "NO GST - Refundable security deposit amount"],
        [""],
        ["Setup Charges", "GST APPLICABLE - One-time setup/onboarding fee"],
        [""],
        ["Meeting Room Rate", "GST APPLICABLE - Rate per hour"],
        ["Meeting Room Hours", "Number of hours (default: 1)"],
        [""],
        ["Additional Charges", "GST APPLICABLE - Any other charges"],
        ["Additional Charges Description", "Description for additional charges"],
        [""],
        ["Notes", "Optional - Notes to appear on invoice"],
        [""],
        ["TIPS:"],
        ["• Leave service columns empty if not applicable"],
        ["• Only filled services appear on the invoice"],
        ["• New clients are auto-created in the system"],
        ["• Multiple invoices = multiple rows"],
    ]
    
    for row_num, row_data in enumerate(instructions, 1):
        for col_num, value in enumerate(row_data, 1):
            cell = ws_instructions.cell(row=row_num, column=col_num, value=value)
            if row_num == 1:
                cell.font = Font(bold=True, size=14, color="2E375B")
            elif row_num in [3, 10, 15, 18, 20, 25, 28, 30, 33, 36, 39, 42]:
                cell.font = Font(bold=True)
            elif "GST APPLICABLE" in str(value):
                cell.font = Font(color="008000")
            elif "NO GST" in str(value):
                cell.font = Font(color="FF6600")
    
    ws_instructions.column_dimensions['A'].width = 30
    ws_instructions.column_dimensions['B'].width = 55
    
    # Save to BytesIO
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=thryve_invoice_template.xlsx"}
    )

# Process Excel and generate invoices
@api_router.post("/excel/upload")
async def upload_excel_and_generate_invoices(file: UploadFile = File(...)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls)")
    
    try:
        contents = await file.read()
        wb = load_workbook(filename=BytesIO(contents))
        ws = wb.active
        
        # Get headers from first row
        headers = [cell.value for cell in ws[1]]
        
        created_invoices = []
        errors = []
        
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:  # Skip empty rows
                continue
            
            try:
                row_data = dict(zip(headers, row))
                
                # Extract client info
                client_data = {
                    "company_name": str(row_data.get("Client Company Name", "") or "").strip(),
                    "address": str(row_data.get("Client Address", "") or "").strip(),
                    "gstin": str(row_data.get("Client GSTIN", "") or "").strip().upper()
                }
                
                if not client_data["company_name"] or not client_data["gstin"]:
                    errors.append({"row": row_num, "error": "Missing client name or GSTIN"})
                    continue
                
                # Check if client exists, if not create
                client = await db.clients.find_one(
                    {"gstin": client_data["gstin"]}, 
                    {"_id": 0}
                )
                
                if not client:
                    client_obj = Client(**client_data)
                    client_doc = client_obj.model_dump()
                    await db.clients.insert_one(client_doc)
                    client = client_doc
                
                # Build line items from filled columns
                line_items = []
                
                # Monthly Plan Fee
                monthly_fee = row_data.get("Monthly Plan Fee")
                if monthly_fee and str(monthly_fee).strip():
                    monthly_fee = float(monthly_fee)
                    prorate_days = row_data.get("Prorate Days")
                    prorate_total = row_data.get("Prorate Total Days") or 30
                    is_prorated = prorate_days is not None and str(prorate_days).strip() != ""
                    
                    line_items.append(LineItem(
                        description="Monthly Plan Fee" + (f" (Prorated: {prorate_days} of {prorate_total} days)" if is_prorated else ""),
                        service_type="monthly_rental",
                        quantity=1,
                        rate=monthly_fee,
                        is_taxable=True,
                        hsn_sac="997212",
                        unit="Month",
                        is_prorated=is_prorated,
                        prorate_days=int(prorate_days) if is_prorated else None,
                        prorate_total_days=int(prorate_total) if prorate_total else 30
                    ))
                
                # Day Pass
                day_pass_rate = row_data.get("Day Pass Rate")
                if day_pass_rate and str(day_pass_rate).strip():
                    day_pass_qty = row_data.get("Day Pass Qty") or 1
                    line_items.append(LineItem(
                        description="Day Pass",
                        service_type="day_pass",
                        quantity=float(day_pass_qty),
                        rate=float(day_pass_rate),
                        is_taxable=True,
                        hsn_sac="997212",
                        unit="Day"
                    ))
                
                # Security Deposit (NO GST)
                security_deposit = row_data.get("Security Deposit")
                if security_deposit and str(security_deposit).strip():
                    line_items.append(LineItem(
                        description="Refundable Security Deposit",
                        service_type="security_deposit",
                        quantity=1,
                        rate=float(security_deposit),
                        is_taxable=False,
                        hsn_sac="",
                        unit="Units"
                    ))
                
                # Setup Charges
                setup_charges = row_data.get("Setup Charges")
                if setup_charges and str(setup_charges).strip():
                    line_items.append(LineItem(
                        description="Setup Charges",
                        service_type="setup_charges",
                        quantity=1,
                        rate=float(setup_charges),
                        is_taxable=True,
                        hsn_sac="997212",
                        unit="Units"
                    ))
                
                # Meeting Room
                meeting_rate = row_data.get("Meeting Room Rate")
                if meeting_rate and str(meeting_rate).strip():
                    meeting_hours = row_data.get("Meeting Room Hours") or 1
                    line_items.append(LineItem(
                        description="Meeting Room Charges",
                        service_type="meeting_room",
                        quantity=float(meeting_hours),
                        rate=float(meeting_rate),
                        is_taxable=True,
                        hsn_sac="997212",
                        unit="Hour"
                    ))
                
                # Additional Charges
                additional = row_data.get("Additional Charges")
                if additional and str(additional).strip():
                    additional_desc = row_data.get("Additional Charges Description") or "Additional Charges"
                    line_items.append(LineItem(
                        description=str(additional_desc),
                        service_type="monthly_rental",  # Use monthly_rental type for GST
                        quantity=1,
                        rate=float(additional),
                        is_taxable=True,
                        hsn_sac="997212",
                        unit="Units"
                    ))
                
                if not line_items:
                    errors.append({"row": row_num, "client": client_data["company_name"], "error": "No billable items found"})
                    continue
                
                # Calculate line items
                calculated_items = [calculate_line_item(item) for item in line_items]
                
                # Calculate totals
                subtotal = sum(item["amount"] for item in calculated_items)
                total_cgst = sum(item["cgst"] for item in calculated_items)
                total_sgst = sum(item["sgst"] for item in calculated_items)
                total_tax = total_cgst + total_sgst
                grand_total = subtotal + total_tax
                
                # Get dates
                invoice_date = row_data.get("Invoice Date (YYYY-MM-DD)")
                due_date = row_data.get("Due Date (YYYY-MM-DD)")
                
                if invoice_date:
                    invoice_date = str(invoice_date).strip()[:10]
                else:
                    invoice_date = datetime.now().strftime('%Y-%m-%d')
                
                if due_date:
                    due_date = str(due_date).strip()[:10]
                
                # Generate invoice number
                invoice_number = await generate_invoice_number()
                
                # Create invoice
                invoice_obj = Invoice(
                    invoice_number=invoice_number,
                    invoice_date=invoice_date,
                    due_date=due_date if due_date else None,
                    client=client,
                    line_items=calculated_items,
                    subtotal=round(subtotal, 2),
                    total_cgst=round(total_cgst, 2),
                    total_sgst=round(total_sgst, 2),
                    total_tax=round(total_tax, 2),
                    grand_total=round(grand_total, 2),
                    notes=str(row_data.get("Notes", "") or ""),
                    status="pending"
                )
                
                doc = invoice_obj.model_dump()
                doc = {k: v for k, v in doc.items() if v is not None}
                await db.invoices.insert_one(doc)
                
                created_invoices.append({
                    "invoice_number": invoice_number,
                    "client": client_data["company_name"],
                    "items_count": len(calculated_items),
                    "grand_total": round(grand_total, 2)
                })
                
            except Exception as e:
                errors.append({
                    "row": row_num,
                    "client": row_data.get("Client Company Name", "Unknown"),
                    "error": str(e)
                })
        
        return {
            "success": True,
            "created_count": len(created_invoices),
            "created_invoices": created_invoices,
            "errors": errors
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing Excel file: {str(e)}")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
