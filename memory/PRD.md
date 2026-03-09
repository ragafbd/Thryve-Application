# Thryve Coworking - Product Requirements Document

## Original Problem Statement
Build an automatic invoice generator and comprehensive management system for Thryve Coworking with:
- Invoice generation with auto-numbering, GST calculation, PDF export
- Client/Member management with flexible pricing
- Meeting room booking system with credits
- Support ticket system
- Community announcements
- **Member self-service portal for viewing invoices, bookings, and tickets**

## User Personas
- **Admin**: Full access to all features, user management, settings
- **Staff**: Invoice creation, member management, bookings, tickets
- **Viewer**: View-only access to invoices and reports
- **Member**: Self-service access to their own invoices, bookings, tickets via Member Portal

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
- Default admin: admin@thryve.in / admin123

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

**Availability Hours: 10 AM to 6 PM**

Features:
- Real-time availability checking
- Credits-based booking (deducted from member's monthly credits)
- Billable amount calculated when credits exhausted
- Booking conflict detection
- Booking cancellation with credit restoration

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

### Phase 4: Member Portal (Complete ✓) - NEW

A secure, separate portal for coworking members to self-serve their needs.

#### Features
- **Separate Authentication System**: Members register/login at `/portal/login`
  - Members can only register if their email exists in admin-managed member list
  - Uses different JWT token from admin authentication (type: "member")
- **Member Dashboard** (`/portal/dashboard`): Overview of member's account, credits, plan
- **My Invoices** (`/portal/invoices`): View and track personal invoices
- **Room Bookings** (`/portal/bookings`): View available rooms and booking schedule
- **Support Tickets** (`/portal/tickets`): Create and track personal support requests
- **Announcements** (`/portal/announcements`): View community announcements

#### Security
- Completely separate auth flow from admin panel
- Member tokens cannot access admin API endpoints
- Members only see their own data (invoices, bookings, tickets)

## UI/UX Updates (March 9, 2026)
- **Admin Login Page**: Shows "Manage your World" title with "Admin Login" badge in bottom left
- **Dashboard**: Icon-based quick action cards with improved text alignment
- **Sidebar**: Section headers (MANAGEMENT, INVOICING, ADMIN) now bold and more readable
- **Brand Colors**: Primary #2E375B (navy), Accent #FFA14A (orange)

## Technical Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py              # Main FastAPI app, auth, invoice routes
├── routes/
│   ├── management.py      # Member, booking, ticket, announcement routes (admin)
│   └── member_portal.py   # Member portal APIs (member-facing)
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
- `member_credentials`: Member portal login credentials
- `bookings`: Room bookings
- `tickets`: Support tickets
- `announcements`: Community posts

## API Endpoints

### Admin Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Create admin user (admin only)
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/users` - List users (admin only)

### Member Portal Authentication
- `POST /api/portal/auth/register` - Member registration (email must exist in members)
- `POST /api/portal/auth/login` - Member login
- `POST /api/portal/auth/change-password` - Member change password

### Member Portal Data
- `GET /api/portal/dashboard` - Member dashboard stats
- `GET /api/portal/invoices` - Member's invoices
- `GET /api/portal/bookings` - Available rooms and slots
- `GET /api/portal/tickets` - Member's support tickets
- `POST /api/portal/tickets` - Create support ticket
- `GET /api/portal/announcements` - Community announcements

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
- `GET /api/management/bookings/availability` - Check slots (10 AM - 6 PM)
- `GET/POST /api/management/tickets` - Support tickets
- `GET/POST /api/management/announcements` - Announcements
- `GET /api/management/stats` - Dashboard stats

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

### P1 (Important) - Future
- [ ] Email notifications for invoices (due date + 4 days)
- [ ] Auto-generate monthly invoices for members
- [ ] Recurring invoice scheduling
- [ ] Payment reminders for overdue invoices
- [ ] Meeting room booking credits logic (monthly reset, billing after exhaustion)
- [ ] Support ticket lifecycle (status transitions, notifications)

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

## Credentials
- **Admin**: admin@thryve.in / admin123 (URL: `/login`)
- **Test Member**: testmember@thryve.in / member123 (URL: `/portal/login`)

---
Last Updated: March 9, 2026
