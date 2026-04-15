"""
Management API Tests for Thryve Coworking Management System
Tests: Plans, Meeting Rooms, Members, Bookings, Tickets, Announcements
"""
import pytest
import requests
from datetime import datetime, timedelta
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD


# ==================== FIXTURES ====================

@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    pytest.skip("Could not get admin token")

@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Get auth headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}"}

# ==================== PLAN TYPES TESTS ====================

class TestPlanTypes:
    """Test /api/management/plans endpoints"""
    
    def test_get_plans_list(self):
        """Test getting all plan types (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/management/plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 5, f"Should have at least 5 default plans, got {len(data)}"
        
        # Verify default plans exist
        plan_names = [p["name"] for p in data]
        assert "Cabin - 4 Seater" in plan_names, "Missing Cabin - 4 Seater plan"
        assert "Open Desk" in plan_names, "Missing Open Desk plan"
        assert "Hot Desk" in plan_names, "Missing Hot Desk plan"
        assert "Day Pass" in plan_names, "Missing Day Pass plan"
        print(f"✓ Plans list retrieved successfully ({len(data)} plans)")
    
    def test_plan_has_correct_structure(self):
        """Test that plans have correct data structure"""
        response = requests.get(f"{BASE_URL}/api/management/plans")
        data = response.json()
        
        # Check first plan structure
        plan = data[0]
        required_fields = ["id", "name", "category", "default_rate", "meeting_room_credits"]
        for field in required_fields:
            assert field in plan, f"Plan missing required field: {field}"
        
        # Verify data types
        assert isinstance(plan["default_rate"], (int, float)), "default_rate should be numeric"
        assert isinstance(plan["meeting_room_credits"], int), "meeting_room_credits should be int"
        print(f"✓ Plan structure is correct")
    
    def test_verify_default_plan_rates(self):
        """Verify default plan rates match requirements"""
        response = requests.get(f"{BASE_URL}/api/management/plans")
        data = response.json()
        
        plans_dict = {p["name"]: p for p in data}
        
        # Verify rates as per requirements
        assert plans_dict["Cabin - 4 Seater"]["default_rate"] == 40000, "4-seater cabin should be 40k"
        assert plans_dict["Cabin - 6 Seater"]["default_rate"] == 55000, "6-seater cabin should be 55k"
        assert plans_dict["Open Desk"]["default_rate"] == 8000, "Open Desk should be 8k"
        assert plans_dict["Hot Desk"]["default_rate"] == 6000, "Hot Desk should be 6k"
        assert plans_dict["Day Pass"]["default_rate"] == 500, "Day Pass should be 500"
        print(f"✓ Default plan rates are correct")

# ==================== MEETING ROOMS TESTS ====================

class TestMeetingRooms:
    """Test /api/management/rooms endpoints"""
    
    def test_get_rooms_list(self):
        """Test getting all meeting rooms (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/management/rooms")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 3, f"Should have at least 3 default rooms, got {len(data)}"
        
        # Verify default rooms exist
        room_names = [r["name"] for r in data]
        assert "CR-1" in room_names, "Missing CR-1 room"
        assert "MR-1" in room_names, "Missing MR-1 room"
        assert "MR-2" in room_names, "Missing MR-2 room"
        print(f"✓ Rooms list retrieved successfully ({len(data)} rooms)")
    
    def test_verify_room_rates_and_slots(self):
        """Verify room rates and slot durations match requirements"""
        response = requests.get(f"{BASE_URL}/api/management/rooms")
        data = response.json()
        
        rooms_dict = {r["name"]: r for r in data}
        
        # CR-1: Conference Room - 1000/hr, 60min slots
        cr1 = rooms_dict["CR-1"]
        assert cr1["hourly_rate"] == 1000, f"CR-1 should be 1000/hr, got {cr1['hourly_rate']}"
        assert cr1["slot_duration"] == 60, f"CR-1 should have 60min slots, got {cr1['slot_duration']}"
        assert cr1["capacity"] == 10, f"CR-1 should have 10 seats, got {cr1['capacity']}"
        
        # MR-1: Meeting Room - 500/hr, 30min slots
        mr1 = rooms_dict["MR-1"]
        assert mr1["hourly_rate"] == 500, f"MR-1 should be 500/hr, got {mr1['hourly_rate']}"
        assert mr1["slot_duration"] == 30, f"MR-1 should have 30min slots, got {mr1['slot_duration']}"
        
        # MR-2: Meeting Room - 500/hr, 30min slots
        mr2 = rooms_dict["MR-2"]
        assert mr2["hourly_rate"] == 500, f"MR-2 should be 500/hr, got {mr2['hourly_rate']}"
        assert mr2["slot_duration"] == 30, f"MR-2 should have 30min slots, got {mr2['slot_duration']}"
        
        print(f"✓ Room rates and slot durations are correct")

# ==================== MEMBERS TESTS ====================

class TestMembers:
    """Test /api/management/members endpoints"""
    
    created_member_id = None
    
    def test_get_members_list(self, auth_headers):
        """Test getting all members"""
        response = requests.get(f"{BASE_URL}/api/management/members", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Members list retrieved successfully ({len(data)} members)")
    
    def test_create_member_with_plan(self, auth_headers):
        """Test creating a new member with plan selection"""
        # First get a plan ID
        plans_response = requests.get(f"{BASE_URL}/api/management/plans")
        plans = plans_response.json()
        open_desk_plan = next((p for p in plans if p["name"] == "Open Desk"), None)
        assert open_desk_plan, "Open Desk plan not found"
        
        member_data = {
            "name": "TEST_John Doe",
            "email": "test_john@example.com",
            "phone": "+91 98765 43210",
            "company_name": "TEST_Tech Solutions",
            "company_address": "123 Tech Park, Faridabad",
            "gstin": "06AABCT1234F1Z5",
            "plan_type_id": open_desk_plan["id"],
            "seat_number": "A-12",
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "notes": "Test member"
        }
        
        response = requests.post(f"{BASE_URL}/api/management/members", json=member_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_John Doe"
        assert data["plan_name"] == "Open Desk"
        assert data["final_rate"] == 8000, f"Final rate should be 8000, got {data['final_rate']}"
        assert data["status"] == "active"
        
        TestMembers.created_member_id = data["id"]
        print(f"✓ Member created successfully with ID: {data['id']}")
    
    def test_create_member_with_custom_rate(self, auth_headers):
        """Test creating member with custom rate"""
        plans_response = requests.get(f"{BASE_URL}/api/management/plans")
        plans = plans_response.json()
        cabin_plan = next((p for p in plans if "4 Seater" in p["name"]), None)
        
        member_data = {
            "name": "TEST_Jane Smith",
            "email": "test_jane@example.com",
            "phone": "+91 98765 43211",
            "company_name": "TEST_Custom Rate Corp",
            "plan_type_id": cabin_plan["id"],
            "custom_rate": 35000,  # Custom rate instead of default 40000
            "start_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/management/members", json=member_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["custom_rate"] == 35000
        assert data["final_rate"] == 35000, f"Final rate should be 35000, got {data['final_rate']}"
        print(f"✓ Member with custom rate created successfully")
    
    def test_create_member_with_discount(self, auth_headers):
        """Test creating member with discount"""
        plans_response = requests.get(f"{BASE_URL}/api/management/plans")
        plans = plans_response.json()
        hot_desk_plan = next((p for p in plans if p["name"] == "Hot Desk"), None)
        
        member_data = {
            "name": "TEST_Discount User",
            "email": "test_discount@example.com",
            "phone": "+91 98765 43212",
            "company_name": "TEST_Discount Corp",
            "plan_type_id": hot_desk_plan["id"],
            "discount_percent": 10,  # 10% discount
            "start_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/management/members", json=member_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["discount_percent"] == 10
        # Hot Desk is 6000, with 10% discount = 5400
        expected_rate = 6000 * 0.9
        assert data["final_rate"] == expected_rate, f"Final rate should be {expected_rate}, got {data['final_rate']}"
        print(f"✓ Member with discount created successfully (final rate: {data['final_rate']})")
    
    def test_update_member(self, auth_headers):
        """Test updating a member"""
        if not TestMembers.created_member_id:
            pytest.skip("No member created to update")
        
        update_data = {
            "name": "TEST_John Doe Updated",
            "phone": "+91 98765 99999"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/management/members/{TestMembers.created_member_id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_John Doe Updated"
        assert data["phone"] == "+91 98765 99999"
        print(f"✓ Member updated successfully")
    
    def test_get_member_by_id(self, auth_headers):
        """Test getting a specific member"""
        if not TestMembers.created_member_id:
            pytest.skip("No member created to get")
        
        response = requests.get(
            f"{BASE_URL}/api/management/members/{TestMembers.created_member_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["id"] == TestMembers.created_member_id
        print(f"✓ Member retrieved by ID successfully")
    
    def test_filter_members_by_status(self, auth_headers):
        """Test filtering members by status"""
        response = requests.get(
            f"{BASE_URL}/api/management/members?status=active",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # All returned members should be active
        for member in data:
            assert member["status"] == "active", f"Member {member['name']} should be active"
        print(f"✓ Members filtered by status successfully ({len(data)} active members)")

# ==================== BOOKINGS TESTS ====================

class TestBookings:
    """Test /api/management/bookings endpoints"""
    
    created_booking_id = None
    test_member_id = None
    
    def test_get_bookings_list(self, auth_headers):
        """Test getting all bookings"""
        response = requests.get(f"{BASE_URL}/api/management/bookings", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Bookings list retrieved successfully ({len(data)} bookings)")
    
    def test_check_room_availability(self, auth_headers):
        """Test checking room availability for a date"""
        # Get a room ID
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        cr1 = next((r for r in rooms if r["name"] == "CR-1"), None)
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/management/bookings/availability?room_id={cr1['id']}&date={tomorrow}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "room" in data, "Response should contain room info"
        assert "slots" in data, "Response should contain slots"
        assert data["date"] == tomorrow
        
        # CR-1 has 60min slots, so should have slots from 9AM to 8PM (11 slots)
        slots = data["slots"]
        assert len(slots) >= 10, f"Should have at least 10 slots, got {len(slots)}"
        
        # Check slot structure
        slot = slots[0]
        assert "start_time" in slot
        assert "end_time" in slot
        assert "is_available" in slot
        print(f"✓ Room availability checked successfully ({len(slots)} slots)")
    
    def test_create_booking(self, auth_headers):
        """Test creating a booking"""
        # First ensure we have a member
        members_response = requests.get(f"{BASE_URL}/api/management/members", headers=auth_headers)
        members = members_response.json()
        
        if not members:
            # Create a test member first
            plans_response = requests.get(f"{BASE_URL}/api/management/plans")
            plans = plans_response.json()
            open_desk = next((p for p in plans if p["name"] == "Open Desk"), None)
            
            member_data = {
                "name": "TEST_Booking User",
                "email": "test_booking@example.com",
                "phone": "+91 98765 43213",
                "company_name": "TEST_Booking Corp",
                "plan_type_id": open_desk["id"],
                "start_date": datetime.now().strftime("%Y-%m-%d")
            }
            member_response = requests.post(f"{BASE_URL}/api/management/members", json=member_data, headers=auth_headers)
            test_member = member_response.json()
        else:
            test_member = members[0]
        
        TestBookings.test_member_id = test_member["id"]
        
        # Get a room
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        mr1 = next((r for r in rooms if r["name"] == "MR-1"), None)
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        booking_data = {
            "room_id": mr1["id"],
            "member_id": test_member["id"],
            "date": tomorrow,
            "start_time": "10:00",
            "end_time": "11:00",
            "purpose": "Team meeting",
            "attendees": 4
        }
        
        response = requests.post(f"{BASE_URL}/api/management/bookings", json=booking_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["room_name"] == "MR-1"
        assert data["member_name"] == test_member["name"]
        assert data["date"] == tomorrow
        assert data["start_time"] == "10:00"
        assert data["end_time"] == "11:00"
        assert data["duration_minutes"] == 60
        assert data["status"] == "confirmed"
        
        TestBookings.created_booking_id = data["id"]
        print(f"✓ Booking created successfully with ID: {data['id']}")
    
    def test_booking_conflict_detection(self, auth_headers):
        """Test that conflicting bookings are rejected"""
        if not TestBookings.created_booking_id:
            pytest.skip("No booking created to test conflict")
        
        # Get the same room and try to book same time
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        mr1 = next((r for r in rooms if r["name"] == "MR-1"), None)
        
        members_response = requests.get(f"{BASE_URL}/api/management/members", headers=auth_headers)
        members = members_response.json()
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Try to book overlapping time
        booking_data = {
            "room_id": mr1["id"],
            "member_id": members[0]["id"],
            "date": tomorrow,
            "start_time": "10:30",  # Overlaps with 10:00-11:00
            "end_time": "11:30",
            "purpose": "Conflicting meeting"
        }
        
        response = requests.post(f"{BASE_URL}/api/management/bookings", json=booking_data, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400 for conflict, got {response.status_code}"
        assert "already booked" in response.text.lower() or "conflict" in response.text.lower()
        print(f"✓ Booking conflict correctly detected")
    
    def test_cancel_booking(self, auth_headers):
        """Test cancelling a booking"""
        if not TestBookings.created_booking_id:
            pytest.skip("No booking created to cancel")
        
        response = requests.delete(
            f"{BASE_URL}/api/management/bookings/{TestBookings.created_booking_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "cancelled" in data.get("message", "").lower()
        print(f"✓ Booking cancelled successfully")

# ==================== TICKETS TESTS ====================

class TestTickets:
    """Test /api/management/tickets endpoints"""
    
    created_ticket_id = None
    
    def test_get_tickets_list(self, auth_headers):
        """Test getting all tickets"""
        response = requests.get(f"{BASE_URL}/api/management/tickets", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Tickets list retrieved successfully ({len(data)} tickets)")
    
    def test_create_ticket_with_category_priority(self, auth_headers):
        """Test creating a ticket with category and priority"""
        ticket_data = {
            "title": "TEST_AC not working",
            "description": "The air conditioning in meeting room MR-1 is not cooling properly",
            "category": "maintenance",
            "priority": "high"
        }
        
        response = requests.post(f"{BASE_URL}/api/management/tickets", json=ticket_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["title"] == "TEST_AC not working"
        assert data["category"] == "maintenance"
        assert data["priority"] == "high"
        assert data["status"] == "open"
        assert data["ticket_number"].startswith("THR-TKT-")
        
        TestTickets.created_ticket_id = data["id"]
        print(f"✓ Ticket created successfully: {data['ticket_number']}")
    
    def test_create_ticket_with_member(self, auth_headers):
        """Test creating a ticket linked to a member"""
        # Get a member
        members_response = requests.get(f"{BASE_URL}/api/management/members", headers=auth_headers)
        members = members_response.json()
        
        if not members:
            pytest.skip("No members available")
        
        ticket_data = {
            "title": "TEST_WiFi connectivity issue",
            "description": "Unable to connect to WiFi from desk A-12",
            "category": "it_support",
            "priority": "medium",
            "member_id": members[0]["id"]
        }
        
        response = requests.post(f"{BASE_URL}/api/management/tickets", json=ticket_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["member_id"] == members[0]["id"]
        assert data["member_name"] == members[0]["name"]
        print(f"✓ Ticket with member created successfully")
    
    def test_update_ticket_status(self, auth_headers):
        """Test updating ticket status"""
        if not TestTickets.created_ticket_id:
            pytest.skip("No ticket created to update")
        
        update_data = {
            "status": "in_progress"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/management/tickets/{TestTickets.created_ticket_id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "in_progress"
        print(f"✓ Ticket status updated to in_progress")
    
    def test_resolve_ticket(self, auth_headers):
        """Test resolving a ticket"""
        if not TestTickets.created_ticket_id:
            pytest.skip("No ticket created to resolve")
        
        update_data = {
            "status": "resolved",
            "resolution": "AC filter cleaned and refrigerant topped up"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/management/tickets/{TestTickets.created_ticket_id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "resolved"
        assert data["resolution"] == "AC filter cleaned and refrigerant topped up"
        assert data["resolved_at"] is not None
        print(f"✓ Ticket resolved successfully")
    
    def test_filter_tickets_by_status(self, auth_headers):
        """Test filtering tickets by status"""
        response = requests.get(
            f"{BASE_URL}/api/management/tickets?status=open",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        for ticket in data:
            assert ticket["status"] == "open"
        print(f"✓ Tickets filtered by status successfully ({len(data)} open tickets)")

# ==================== ANNOUNCEMENTS TESTS ====================

class TestAnnouncements:
    """Test /api/management/announcements endpoints"""
    
    created_announcement_id = None
    
    def test_get_announcements_list(self, auth_headers):
        """Test getting all announcements"""
        response = requests.get(f"{BASE_URL}/api/management/announcements", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Announcements list retrieved successfully ({len(data)} announcements)")
    
    def test_create_announcement(self, auth_headers):
        """Test creating a new announcement"""
        announcement_data = {
            "title": "TEST_Office Closure Notice",
            "content": "The office will be closed on January 26th for Republic Day. Happy holidays!",
            "category": "important",
            "is_pinned": False
        }
        
        response = requests.post(f"{BASE_URL}/api/management/announcements", json=announcement_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["title"] == "TEST_Office Closure Notice"
        assert data["category"] == "important"
        assert data["is_pinned"] == False
        assert data["is_active"] == True
        
        TestAnnouncements.created_announcement_id = data["id"]
        print(f"✓ Announcement created successfully with ID: {data['id']}")
    
    def test_create_pinned_announcement(self, auth_headers):
        """Test creating a pinned announcement"""
        announcement_data = {
            "title": "TEST_Welcome to Thryve!",
            "content": "Welcome to our coworking community. Please read the house rules.",
            "category": "general",
            "is_pinned": True
        }
        
        response = requests.post(f"{BASE_URL}/api/management/announcements", json=announcement_data, headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["is_pinned"] == True
        print(f"✓ Pinned announcement created successfully")
    
    def test_update_announcement_pin_status(self, auth_headers):
        """Test updating announcement pin status"""
        if not TestAnnouncements.created_announcement_id:
            pytest.skip("No announcement created to update")
        
        update_data = {
            "title": "TEST_Office Closure Notice",
            "content": "The office will be closed on January 26th for Republic Day. Happy holidays!",
            "category": "important",
            "is_pinned": True  # Pin the announcement
        }
        
        response = requests.put(
            f"{BASE_URL}/api/management/announcements/{TestAnnouncements.created_announcement_id}",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["is_pinned"] == True
        print(f"✓ Announcement pinned successfully")
    
    def test_delete_announcement(self, auth_headers):
        """Test deleting an announcement"""
        if not TestAnnouncements.created_announcement_id:
            pytest.skip("No announcement created to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/management/announcements/{TestAnnouncements.created_announcement_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "deleted" in data.get("message", "").lower()
        print(f"✓ Announcement deleted successfully")

# ==================== MANAGEMENT STATS TESTS ====================

class TestManagementStats:
    """Test /api/management/stats endpoint"""
    
    def test_get_management_stats(self, auth_headers):
        """Test getting management dashboard statistics"""
        response = requests.get(f"{BASE_URL}/api/management/stats", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required fields
        required_fields = [
            "total_members", "active_members", "plan_distribution",
            "todays_bookings", "monthly_revenue", "open_tickets", "active_announcements"
        ]
        for field in required_fields:
            assert field in data, f"Stats missing required field: {field}"
        
        # Verify data types
        assert isinstance(data["total_members"], int)
        assert isinstance(data["active_members"], int)
        assert isinstance(data["plan_distribution"], dict)
        assert isinstance(data["monthly_revenue"], (int, float))
        
        print(f"✓ Management stats retrieved successfully")
        print(f"  - Total members: {data['total_members']}")
        print(f"  - Active members: {data['active_members']}")
        print(f"  - Monthly revenue: Rs. {data['monthly_revenue']}")
        print(f"  - Open tickets: {data['open_tickets']}")

# ==================== CLEANUP ====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_members(self, auth_headers):
        """Delete test members created during testing"""
        response = requests.get(f"{BASE_URL}/api/management/members", headers=auth_headers)
        members = response.json()
        
        deleted_count = 0
        for member in members:
            if member["name"].startswith("TEST_") or member["email"].startswith("test_"):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/management/members/{member['id']}",
                    headers=auth_headers
                )
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test members")
    
    def test_cleanup_test_announcements(self, auth_headers):
        """Delete test announcements created during testing"""
        response = requests.get(f"{BASE_URL}/api/management/announcements?active_only=false", headers=auth_headers)
        announcements = response.json()
        
        deleted_count = 0
        for ann in announcements:
            if ann["title"].startswith("TEST_"):
                delete_response = requests.delete(
                    f"{BASE_URL}/api/management/announcements/{ann['id']}",
                    headers=auth_headers
                )
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test announcements")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
