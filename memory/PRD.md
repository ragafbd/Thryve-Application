# Thryve Invoice Generator - PRD

## Original Problem Statement
Build an automatic invoice generator for Thryve Coworking with:
- Invoice number, date, Thryve Coworking details
- Client Company's Name, Address, GSTIN
- Services: Monthly rentals (GST), Refundable Security, Setup charges, Day pass (GST), Meeting room charges (GST)
- Manual invoice generation with PDF export

## User Personas
- **Admin/Staff**: Thryve Coworking team members who generate invoices for clients

## Core Requirements
- Invoice generation with auto-numbering (THR/YYYY/MM/XXXX format)
- Client management (CRUD operations)
- Multiple service types with GST handling
- PDF export for record keeping
- Dashboard with stats overview

## What's Been Implemented (Jan 2026)

### Backend (FastAPI + MongoDB)
- Client CRUD endpoints (/api/clients)
- Invoice CRUD endpoints (/api/invoices)
- GST calculation (18% = 9% CGST + 9% SGST)
- Dashboard stats endpoint (/api/stats)
- Company details endpoint (/api/company)

### Frontend (React + Tailwind + Shadcn)
- Dashboard with stats cards
- Client management page with search
- Invoice creation with live preview (split-view)
- Invoice list with search & filters
- Invoice view with PDF export (react-to-print)
- Responsive sidebar navigation

### Service Types
1. Monthly Rental (GST applicable)
2. Refundable Security Deposit (Non-taxable)
3. Setup Charges (Non-taxable)
4. Day Pass (GST applicable)
5. Meeting Room Charges (GST applicable)

### Design
- Emerald green theme (#064E3B)
- Manrope (headings), Public Sans (body), JetBrains Mono (financial data)
- Light mode with professional invoice layout

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Invoice creation and management
- [x] Client management
- [x] GST calculations
- [x] PDF export

### P1 (Important) - Future
- [ ] Invoice email delivery
- [ ] Recurring invoice scheduling
- [ ] Payment tracking/status
- [ ] Custom invoice templates

### P2 (Nice to Have)
- [ ] Multi-user authentication
- [ ] Export to Excel/CSV
- [ ] Financial reports/analytics
- [ ] Custom company branding

## Next Tasks
1. Add payment status tracking (Paid/Pending/Overdue)
2. Implement invoice email functionality
3. Add recurring invoice automation
4. Create financial reports dashboard
