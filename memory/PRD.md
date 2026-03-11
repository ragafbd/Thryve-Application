# Thryve Coworking - Product Requirements Document

## Original Problem Statement
Build an automatic invoice generator and comprehensive management system for Thryve Coworking with:
- Invoice generation with auto-numbering, GST calculation, PDF export
- Client/Member management with flexible pricing
- Meeting room booking system with credits
- Support ticket system
- Community announcements
- **Member self-service portal for viewing invoices, bookings, and tickets**
- **Public holiday management for booking restrictions**

## Recent Updates (March 11, 2026)
- **Invoice Editing Feature**: Added ability to edit invoices after creation
  - Edit button on invoice view page opens edit dialog
  - Can modify: client, due date, line items, notes
  - Line items can be added/removed/modified
  - Totals (subtotal, CGST, SGST, grand total) automatically recalculate
  - API: PUT `/api/invoices/{invoice_id}`
- **Create Invoice Description Auto-Populate**: Removed separate description input field
  - Description now auto-populates from Service Type dropdown selection
  - Service types: Monthly Plan, Day Pass, Security Deposit, Setup Charges, Meeting Room
  - Cleaner UI with less manual input
- **New Invoice Number Format**: Changed from `THR/YYYY/MM/XXXX` to `YY-YY/Mon/NNN/CompanyName`
  - Example: `26-27/Apr/001/Acme Corp Pvt Ltd`
  - YY-YY: Financial year (April to March), e.g., 26-27 for FY 2026-2027
  - Mon: Month abbreviation (Apr, May, Jun, etc.)
  - NNN: Sequential number, resets each financial year starting April
  - CompanyName: Client company name for easy identification
- **Excel Data Import**: New feature at `/admin/import` (hidden URL) to bulk import client data from Excel files
  - Column mapping: Company Name, Authorized Signatory, Father's Name, Designation, PAN, GSTIN, Aadhar, Address, Space Description, Seats, Start/End Date, Lock-in, License Fee, Security, Setup Charges
  - Validates company names, rejects duplicates
  - Parses dates and numeric values correctly
  - API: POST `/api/import/clients`
- **LLA Generator**: New feature at `/admin/agreement` to generate Leave & License Agreements
  - Select client from dropdown or table
  - Preview agreement with all company details, terms, and fees
  - Download as Word document (.docx)
  - Print directly from browser
  - Added to sidebar menu under Management
- **Model Updates**: Added new fields to Company model:
  - `signatory_father_name`, `signatory_designation`
  - `space_description`
  - `security_deposit`, `setup_charges`, `lock_in_months`
  - `end_date`

## Recent Updates (March 10, 2026)
- **Dashboard Cleanup**: Removed redundant quick action icon cards from dashboard (Members, Meeting Room Bookings, Support Tickets, Announcements, Create Invoice, Bulk Invoice). Dashboard now shows only analytics. Navigation is available via sidebar only to avoid duplicity.
- **Sidebar Cleanup**: Removed "Clients (Legacy)" from ADMIN section. The new "Clients" page under MANAGEMENT is now the single source for client management.
- **Code Cleanup**: Removed unused legacy files (`Clients.jsx`, `Members.jsx`) and their routes from App.js.
- **Removed Bulk Invoice**: Completely removed the Excel-based bulk invoice feature. All invoices are now generated from the app's database to prevent typos and ensure data accuracy.
- **Fixed Add Client Form**: Number of Seats, Rate per Seat, Discount, and Start Date fields are now blank by default instead of pre-filled, allowing admins to enter values manually without clearing existing defaults.
- **Enhanced Add Client Form**: 
  - Added Email ID and Website fields to Company Details
  - Added new "Authorised Signatory Details" section with Name, Phone, Email, Aadhar, and PAN fields
  - GSTIN and PAN placeholders updated to generic "Enter..." text (validation rules remain: uppercase, 15 chars for GSTIN, 10 chars for PAN)
  - Meeting room credits now entered per seat - label updated to "Meeting Room Credits (minutes per seat)"
  - Added "Internet/Bandwidth Details" section with ISP Provider, Bandwidth Speed, and Account/Connection ID
  - Rate per Seat field no longer auto-populates when selecting a plan - must be entered manually with blank placeholder
- **Clients Page Stats**: Removed redundant "Credits/Seat" stat card (now shows 3 cards: Active Companies, Seats Occupied, Monthly Revenue)
- **Terminate/Suspend Clients**: Available via 3-dot menu on each client card (Edit Company, Add Member, Terminate, Reactivate)
- **Removed Delete Option**: Companies can no longer be permanently deleted to preserve historical records
- **Export Feature**: Added "Export" button to download all client data as CSV file with comprehensive fields (company details, signatory info, subscription, internet details)

## User Personas
- **Admin**: Full access to all features, user management, settings (at `/admin`)
- **Staff**: Invoice creation, member management, bookings, tickets (at `/admin`)
- **Viewer**: View-only access to invoices and reports (at `/admin`)
- **Member**: Self-service access to their own invoices, bookings, tickets via Member Portal (at `/` and `/portal`)

## URL Structure (Updated March 9, 2026)
- **Landing Page `/`**: Member Portal Login (Login/Register tabs)
- **Member Portal `/portal/*`**: Member dashboard, invoices, bookings, tickets
- **Admin Panel `/admin/*`**: Full management system for staff/admins
- **Legacy `/login`**: Redirects to `/admin/login`

## What's Been Implemented (March 2026)

### Phase 1: Invoice Generator (Complete ✓)
- Invoice CRUD with auto-numbering (THR/YYYY/MM/XXXX)
- Client management
- GST calculation (18% = 9% CGST + 9% SGST)
- PDF export with Thryve branding
- Payment status tracking (Pending/Paid/Overdue)
- Due date with auto-overdue detection
- Prorate billing for partial months
- Bulk invoice generation from Excel

### Phase 2: Authentication (Complete ✓)
- JWT-based authentication
- Role-based access control (admin, staff, viewer)
- User management (create, edit, deactivate users)
- Password change functionality
- Default admin: admin@thryve.in / password

### Phase 3: Management System (Complete ✓)

#### Member Management
- Member registration with plan assignment
- Flexible pricing (custom rates per member)
- Discount support (percentage-based)
- Meeting room credits allocation
- Status tracking (active/inactive/suspended/terminated)
- Company/GSTIN info for invoicing
- **Termination with History Preservation**:
  - Terminate individual members with end date, reason, and outstanding dues flag
  - Bulk terminate all members from a company at once
  - Outstanding dues tracking for terminated members
  - Reactivate terminated members when needed
  - Full history preserved for audit purposes

#### Plans Available
| Plan | Default Rate | Meeting Room Credits |
|------|-------------|---------------------|
| Private Cabin - 4 Seater | Rs. 40,000/mo | 480 min/mo |
| Private Cabin - 6 Seater | Rs. 55,000/mo | 600 min/mo |
| Open Desk | Rs. 8,000/mo | 120 min/mo |
| Hot Desk | Rs. 6,000/mo | 60 min/mo |
| Day Pass | Rs. 500/day | 0 min |

#### Meeting Room Bookings
| Room | Capacity | Rate | Slot Duration |
|------|----------|------|---------------|
| CR-1 (Conference Room 1) | 10 seats | Rs. 1,000/hr | 60 min |
| MR-1 (Meeting Room 1) | 5 seats | Rs. 500/hr | 30 min |
| MR-2 (Meeting Room 2) | 5 seats | Rs. 500/hr | 30 min |

**Availability Hours: 10 AM to 7 PM (Mon-Sat)**

**Booking Rules:**
- **Multi-slot selection**: Select multiple consecutive time slots in one go
- **Advance booking**: Maximum 10 days in advance
- **Cancellation**: Can only cancel 2+ days before the event (within 48 hours will use credits)
- **Blocked dates**: Sundays and Public Holidays
- Credits allocated at member onboarding

Features:
- Real-time availability checking
- Credits-based booking (deducted from member's monthly credits)
- Billable amount calculated when credits exhausted
- Booking conflict detection
- Booking cancellation with credit restoration (if within rules)

#### Public Holidays Management (NEW - March 9, 2026 ✓)
- **Admin Management Page** at `/admin/holidays`
- **Default Indian Holidays**: 13 holidays pre-loaded for 2025 and 2026
- **Year Filter**: View holidays by year (2025, 2026, 2027)
- **CRUD Operations**: Add, edit, activate/deactivate, delete holidays
- **Booking Integration**: 
  - Bookings automatically blocked on public holidays
  - Both admin and member portals respect holiday restrictions
  - Frontend fetches holidays from API (not hardcoded)

**Holidays API Endpoints:**
- `GET /api/holidays` - List all holidays (with year filter)
- `GET /api/holidays/dates` - Get just dates array (for calendar blocking)
- `POST /api/holidays` - Create holiday (admin only)
- `PUT /api/holidays/{id}` - Update holiday (admin only)
- `DELETE /api/holidays/{id}` - Delete holiday (admin only)

#### Support Tickets
- Ticket numbering (THR-TKT-XXXX)
- Categories: Maintenance, IT Support, Admin, Facilities, Other
- Priority levels: Low, Medium, High, Urgent
- Status workflow: Open → In Progress → Resolved → Closed
- Assignment to staff members
- Resolution notes

#### Community Announcements
- Create/edit/delete announcements
- Categories: General, Event, Maintenance, Important
- Pin important announcements to top
- Expiry dates for time-limited announcements

### Phase 4: Member Portal (Complete ✓)

A secure, separate portal for coworking members to self-serve their needs.

#### Features
- **Separate Authentication System**: Members register/login at `/` (landing page)
  - Members can only register if their email exists in admin-managed member list
  - Uses different JWT token from admin authentication (type: "member")
- **Member Dashboard** (`/portal`): Overview of member's account, credits, plan
- **My Invoices** (`/portal/invoices`): View and track personal invoices
- **Room Bookings** (`/portal/bookings`): View available rooms and make bookings
- **Support Tickets** (`/portal/tickets`): Create and track personal support requests
- **Announcements** (`/portal/announcements`): View community announcements

#### Security
- Completely separate auth flow from admin panel
- Member tokens cannot access admin API endpoints
- Members only see their own data (invoices, bookings, tickets)

## UI/UX Updates (March 9, 2026)
- **Landing Page**: Clean light theme with member login/register
- **Admin & Member Portals**: Consistent navy blue (#2E375B) and orange (#FFA14A) color scheme
- **Sidebar**: Centered logo, consistent navigation styling
- **Date Format**: Ordinal dates throughout (e.g., "Monday, 9th March, 2026")
- **Browser Title**: "Thryve Coworking App"
- **Booking Calendar**: 
  - Removed duplicate date display (calendar icon removed)
  - Navigation arrows allow browsing through all dates including blocked ones
  - Shows specific holiday names when blocked (e.g., "Bookings are not available on Holi")
  - Shows "Bookings are not available on Sundays" for Sunday dates

## Technical Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py              # Main FastAPI app, auth, invoice routes
├── routes/
│   ├── management.py      # Member, booking, ticket, announcement routes (admin)
│   ├── member_portal.py   # Member portal APIs (member-facing)
│   └── public_holidays.py # Public holidays management
├── models/
│   └── management.py      # Pydantic models for management system
└── requirements.txt       # Dependencies
```

### Frontend (React + Tailwind + Shadcn/UI)
```
/app/frontend/src/
├── App.js                 # Routes configuration (admin + portal)
├── components/
│   ├── Layout.jsx         # Admin sidebar navigation, user menu
│   └── InvoicePreview.jsx # Invoice rendering
├── contexts/
│   ├── AuthContext.jsx    # Admin authentication state
│   └── MemberAuthContext.jsx # Member portal auth state
└── pages/
    ├── Dashboard.jsx      # Admin dashboard
    ├── Members.jsx        # Member management
    ├── Bookings.jsx       # Room bookings (admin)
    ├── PublicHolidays.jsx # Public holidays management
    ├── Tickets.jsx        # Support tickets (admin)
    ├── Announcements.jsx  # Community announcements
    └── portal/            # Member Portal Pages
        ├── MemberLogin.jsx
        ├── MemberLayout.jsx
        ├── MemberDashboard.jsx
        ├── MemberInvoices.jsx
        ├── MemberBookings.jsx
        ├── MemberTickets.jsx
        └── MemberAnnouncements.jsx
```

### Database Collections
- `users`: Admin/Staff users with roles
- `clients`: Legacy billing clients
- `invoices`: Invoice records
- `plan_types`: Workspace plans
- `meeting_rooms`: Room configurations
- `members`: Coworking members
- `member_auth`: Member portal login credentials
- `bookings`: Room bookings
- `tickets`: Support tickets
- `announcements`: Community posts
- `public_holidays`: Public holiday dates (NEW)

## API Endpoints

### Admin Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Create admin user (admin only)
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/users` - List users (admin only)

### Member Portal Authentication
- `POST /api/member/register` - Member registration (email must exist in members)
- `POST /api/member/login` - Member login
- `POST /api/member/change-password` - Member change password

### Member Portal Data
- `GET /api/member/me` - Member profile
- `GET /api/member/invoices` - Member's invoices
- `GET /api/member/bookings` - Member's bookings
- `POST /api/member/bookings` - Create booking
- `DELETE /api/member/bookings/{id}` - Cancel booking
- `GET /api/member/rooms` - Available rooms
- `GET /api/member/rooms/{id}/availability` - Room availability
- `GET /api/member/tickets` - Member's support tickets
- `POST /api/member/tickets` - Create support ticket
- `GET /api/member/announcements` - Community announcements

### Invoices (Admin)
- `GET/POST /api/invoices` - List/Create invoices
- `GET /api/invoices/{id}` - Get invoice
- `GET /api/invoices/{id}/pdf` - Download PDF
- `PATCH /api/invoices/{id}/status` - Update payment status

### Management (Admin)
- `GET/POST /api/management/plans` - Plans
- `GET/POST /api/management/rooms` - Meeting rooms
- `GET/POST /api/management/members` - Members
- `GET/POST /api/management/bookings` - Room bookings
- `GET /api/management/bookings/availability` - Check slots (10 AM - 7 PM)
- `GET/POST /api/management/tickets` - Support tickets
- `GET/POST /api/management/announcements` - Announcements
- `GET /api/management/stats` - Dashboard stats

### Public Holidays
- `GET /api/holidays` - List holidays (with year filter)
- `GET /api/holidays/dates` - Get dates array only
- `POST /api/holidays` - Create holiday (admin only)
- `PUT /api/holidays/{id}` - Update holiday (admin only)
- `DELETE /api/holidays/{id}` - Delete holiday (admin only)

## Prioritized Backlog

### P0 (Critical) - DONE ✓
- [x] Invoice generation with GST
- [x] PDF export
- [x] Authentication & authorization
- [x] Member management
- [x] Meeting room bookings
- [x] Support tickets
- [x] Announcements
- [x] Member self-service portal
- [x] Public holiday booking restrictions

### P1 (Important) - Future
- [ ] Email notifications for invoices (due date + 4 days)
- [ ] Auto-generate monthly invoices for members
- [ ] Recurring invoice scheduling
- [ ] Payment reminders for overdue invoices
- [ ] Meeting room booking credits logic (monthly reset, billing after exhaustion)
- [ ] Support ticket lifecycle (status transitions, notifications)
- [ ] Email-based password reset flow

### P2 (Nice to Have)
- [ ] WhatsApp integration for reminders
- [ ] Visitor management
- [ ] Analytics dashboard
- [ ] Export reports to Excel
- [ ] Mobile-responsive optimization
- [ ] Backend refactoring (move invoice routes to separate file)

## Test Reports
- `/app/test_reports/iteration_2.json` - Authentication tests (17 passed)
- `/app/test_reports/iteration_3.json` - Management tests (31 passed)
- `/app/test_reports/iteration_4.json` - Member Portal tests (16 passed)
- `/app/test_reports/iteration_5.json` - UI Restructure & Booking Rules (100% passed)
- `/app/test_reports/iteration_6.json` - Public Holidays feature (21 passed, 100%)

## Credentials
- **Admin**: admin@thryve.in / password (URL: `/admin/login`)
- **Test Member**: Create in admin panel first, then register at landing page (`/`)

---
Last Updated: March 9, 2026
