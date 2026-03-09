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
    # Get the count of invoices to generate sequential number
    count = await db.invoices.count_documents({})
    year = datetime.now().year
    month = datetime.now().month
    return f"THR/{year}/{month:02d}/{count + 1:04d}"

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
    
    # Define headers
    headers = [
        "Client Company Name", "Client Address", "Client GSTIN",
        "Service Type", "Description", "Quantity", "Rate",
        "Is Taxable (Yes/No)", "Prorate Days", "Total Days",
        "Invoice Date (YYYY-MM-DD)", "Due Date (YYYY-MM-DD)", "Notes"
    ]
    
    # Style for headers
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="2E375B", end_color="2E375B", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # Write headers
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border
        ws.column_dimensions[cell.column_letter].width = 20
    
    # Add sample data row
    sample_data = [
        "ABC Tech Pvt Ltd", "123 Tech Park, Sector 15, Faridabad", "06AABCT1234F1Z5",
        "Monthly Plan", "Dedicated Desk - January 2026", "1", "15000",
        "Yes", "", "30",
        "2026-01-01", "2026-01-15", "First month billing"
    ]
    for col, value in enumerate(sample_data, 1):
        cell = ws.cell(row=2, column=col, value=value)
        cell.border = thin_border
    
    # Add instructions sheet
    ws_instructions = wb.create_sheet("Instructions")
    instructions = [
        ["EXCEL TEMPLATE INSTRUCTIONS FOR THRYVE INVOICE GENERATOR"],
        [""],
        ["Column Details:"],
        ["Client Company Name", "Required - Company name for the invoice"],
        ["Client Address", "Required - Full address of the client"],
        ["Client GSTIN", "Required - GST Identification Number"],
        ["Service Type", "Required - One of: Monthly Plan, Security Deposit, Setup Charges, Day Pass, Meeting Room"],
        ["Description", "Optional - Custom description for the line item"],
        ["Quantity", "Required - Number of units (default: 1)"],
        ["Rate", "Required - Rate per unit in INR"],
        ["Is Taxable (Yes/No)", "Required - Whether GST applies (Yes for plans, No for deposits)"],
        ["Prorate Days", "Optional - Number of days to charge (for prorated billing)"],
        ["Total Days", "Optional - Total days in billing period (default: 30)"],
        ["Invoice Date", "Required - Format: YYYY-MM-DD (e.g., 2026-01-01)"],
        ["Due Date", "Required - Format: YYYY-MM-DD"],
        ["Notes", "Optional - Additional notes for the invoice"],
        [""],
        ["Tips:"],
        ["- Multiple line items for same client: Add multiple rows with same client details"],
        ["- Service Types: Monthly Plan (GST), Day Pass (GST), Meeting Room (GST), Security Deposit (No GST), Setup Charges (No GST)"],
        ["- Prorate: Leave Prorate Days empty for full month billing"],
    ]
    for row_num, row_data in enumerate(instructions, 1):
        for col_num, value in enumerate(row_data, 1):
            cell = ws_instructions.cell(row=row_num, column=col_num, value=value)
            if row_num == 1:
                cell.font = Font(bold=True, size=14)
            elif row_num == 3:
                cell.font = Font(bold=True)
    ws_instructions.column_dimensions['A'].width = 25
    ws_instructions.column_dimensions['B'].width = 60
    
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
        
        # Group rows by client (to create one invoice per client)
        client_invoices = {}
        
        for row_num, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:  # Skip empty rows
                continue
                
            row_data = dict(zip(headers, row))
            
            # Extract client info
            client_key = f"{row_data.get('Client Company Name', '')}|{row_data.get('Client GSTIN', '')}"
            
            if client_key not in client_invoices:
                client_invoices[client_key] = {
                    "client": {
                        "company_name": row_data.get("Client Company Name", ""),
                        "address": row_data.get("Client Address", ""),
                        "gstin": row_data.get("Client GSTIN", "")
                    },
                    "invoice_date": str(row_data.get("Invoice Date (YYYY-MM-DD)", datetime.now().strftime('%Y-%m-%d'))),
                    "due_date": str(row_data.get("Due Date (YYYY-MM-DD)", "")),
                    "notes": row_data.get("Notes", "") or "",
                    "line_items": []
                }
            
            # Map service type
            service_type_map = {
                "Monthly Plan": "monthly_rental",
                "Security Deposit": "security_deposit",
                "Setup Charges": "setup_charges",
                "Day Pass": "day_pass",
                "Meeting Room": "meeting_room"
            }
            service_type = service_type_map.get(row_data.get("Service Type", ""), "monthly_rental")
            
            # Parse taxable
            is_taxable = str(row_data.get("Is Taxable (Yes/No)", "Yes")).lower() in ["yes", "y", "true", "1"]
            
            # Parse prorate
            prorate_days = row_data.get("Prorate Days")
            prorate_total = row_data.get("Total Days", 30)
            is_prorated = prorate_days is not None and prorate_days != ""
            
            line_item = {
                "description": row_data.get("Description", "") or row_data.get("Service Type", ""),
                "service_type": service_type,
                "quantity": float(row_data.get("Quantity", 1) or 1),
                "rate": float(row_data.get("Rate", 0) or 0),
                "is_taxable": is_taxable,
                "hsn_sac": "997212" if service_type in ["monthly_rental", "day_pass", "meeting_room"] else "",
                "unit": "Month" if service_type == "monthly_rental" else "Units",
                "is_prorated": is_prorated,
                "prorate_days": int(prorate_days) if is_prorated and prorate_days else None,
                "prorate_total_days": int(prorate_total) if prorate_total else 30
            }
            
            client_invoices[client_key]["line_items"].append(line_item)
        
        # Create invoices
        created_invoices = []
        errors = []
        
        for client_key, invoice_data in client_invoices.items():
            try:
                # Check if client exists, if not create
                client = await db.clients.find_one(
                    {"gstin": invoice_data["client"]["gstin"]}, 
                    {"_id": 0}
                )
                
                if not client:
                    # Create new client
                    client_obj = Client(**invoice_data["client"])
                    client_doc = client_obj.model_dump()
                    await db.clients.insert_one(client_doc)
                    client = client_doc
                
                # Generate invoice number
                invoice_number = await generate_invoice_number()
                
                # Calculate line items
                calculated_items = []
                for item in invoice_data["line_items"]:
                    line_item = LineItem(**item)
                    calculated_items.append(calculate_line_item(line_item))
                
                # Calculate totals
                subtotal = sum(item["amount"] for item in calculated_items)
                total_cgst = sum(item["cgst"] for item in calculated_items)
                total_sgst = sum(item["sgst"] for item in calculated_items)
                total_tax = total_cgst + total_sgst
                grand_total = subtotal + total_tax
                
                # Create invoice
                invoice_obj = Invoice(
                    invoice_number=invoice_number,
                    invoice_date=invoice_data["invoice_date"],
                    due_date=invoice_data["due_date"] if invoice_data["due_date"] else None,
                    client=client,
                    line_items=calculated_items,
                    subtotal=round(subtotal, 2),
                    total_cgst=round(total_cgst, 2),
                    total_sgst=round(total_sgst, 2),
                    total_tax=round(total_tax, 2),
                    grand_total=round(grand_total, 2),
                    notes=invoice_data["notes"],
                    status="pending"
                )
                
                doc = invoice_obj.model_dump()
                doc = {k: v for k, v in doc.items() if v is not None}
                await db.invoices.insert_one(doc)
                
                created_invoices.append({
                    "invoice_number": invoice_number,
                    "client": invoice_data["client"]["company_name"],
                    "grand_total": round(grand_total, 2)
                })
                
            except Exception as e:
                errors.append({
                    "client": invoice_data["client"]["company_name"],
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
