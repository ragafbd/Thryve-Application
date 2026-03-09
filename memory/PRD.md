# Thryve Coworking - Product Requirements Document

## Original Problem Statement
Build an automatic invoice generator and comprehensive management system for Thryve Coworking with:
- Invoice generation with auto-numbering, GST calculation, PDF export
- Client/Member management with flexible pricing
- Meeting room booking system with credits
- Support ticket system
- Community announcements

## User Personas
- **Admin**: Full access to all features, user management, settings
- **Staff**: Invoice creation, member management, bookings, tickets
- **Viewer**: View-only access to invoices and reports

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
- Status tracking (active/inactive/suspended)
- Company/GSTIN info for invoicing

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

## Technical Architecture

### Backend (FastAPI + MongoDB)
```
/app/backend/
├── server.py              # Main FastAPI app, auth, invoice routes
├── routes/
│   └── management.py      # Member, booking, ticket, announcement routes
├── models/
│   └── management.py      # Pydantic models for management system
└── requirements.txt       # Dependencies
```

### Frontend (React + Tailwind + Shadcn/UI)
```
/app/frontend/src/
├── App.js                 # Routes configuration
├── components/
│   ├── Layout.jsx         # Sidebar navigation, user menu
│   └── InvoicePreview.jsx # Invoice rendering
├── contexts/
│   └── AuthContext.jsx    # Authentication state
└── pages/
    ├── Dashboard.jsx      # Invoice dashboard
    ├── Members.jsx        # Member management
    ├── Bookings.jsx       # Room bookings
    ├── Tickets.jsx        # Support tickets
    ├── Announcements.jsx  # Community announcements
    └── ... (invoice pages)
```

### Database Collections
- `users`: System users with roles
- `clients`: Legacy billing clients
- `invoices`: Invoice records
- `plan_types`: Workspace plans
- `meeting_rooms`: Room configurations
- `members`: Coworking members
- `bookings`: Room bookings
- `tickets`: Support tickets
- `announcements`: Community posts

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Create user (admin only)
- `POST /api/auth/change-password` - Change password
- `GET /api/auth/users` - List users (admin only)

### Invoices
- `GET/POST /api/invoices` - List/Create invoices
- `GET /api/invoices/{id}` - Get invoice
- `GET /api/invoices/{id}/pdf` - Download PDF
- `PATCH /api/invoices/{id}/status` - Update payment status

### Management
- `GET/POST /api/management/plans` - Plans
- `GET/POST /api/management/rooms` - Meeting rooms
- `GET/POST /api/management/members` - Members
- `GET/POST /api/management/bookings` - Room bookings
- `GET /api/management/bookings/availability` - Check slots
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

### P1 (Important) - Future
- [ ] Email notifications for invoices (due date + 4 days)
- [ ] Auto-generate monthly invoices for members
- [ ] Recurring invoice scheduling
- [ ] Payment reminders for overdue invoices
- [ ] Member self-service portal

### P2 (Nice to Have)
- [ ] WhatsApp integration for reminders
- [ ] Visitor management
- [ ] Analytics dashboard
- [ ] Export reports to Excel
- [ ] Mobile-responsive optimization

## Test Reports
- `/app/test_reports/iteration_2.json` - Authentication tests (17 passed)
- `/app/test_reports/iteration_3.json` - Management tests (31 passed)

## Credentials
- **Admin**: admin@thryve.in / admin123

---
Last Updated: March 9, 2026
