"""
Test Member Portal APIs
Tests for member registration, login, invoices, bookings, tickets, and announcements
"""
import pytest
import requests
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD

TEST_MEMBER_EMAIL = "testmember@thryve.in"
TEST_MEMBER_PASSWORD = "member123"


class TestMemberPortalAuth:
    """Member Portal Authentication Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_member_login_success(self):
        """Test successful member login"""
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": TEST_MEMBER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "member" in data
        assert data["member"]["email"] == TEST_MEMBER_EMAIL
        assert data["member"]["status"] == "active"
    
    def test_member_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "Invalid email or password" in response.json().get("detail", "")
    
    def test_member_login_nonexistent_email(self):
        """Test login with non-existent email"""
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": "nonexistent@test.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
    
    def test_member_register_already_exists(self):
        """Test registration with already registered email"""
        response = self.session.post(f"{BASE_URL}/api/member/register", json={
            "email": TEST_MEMBER_EMAIL,
            "password": "newpassword123"
        })
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()
    
    def test_member_register_not_in_system(self):
        """Test registration with email not in member list"""
        response = self.session.post(f"{BASE_URL}/api/member/register", json={
            "email": "notamember@test.com",
            "password": "password123"
        })
        assert response.status_code == 404
        assert "No member found" in response.json().get("detail", "")


class TestMemberPortalProfile:
    """Member Profile Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup with authenticated member session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": TEST_MEMBER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Member login failed")
    
    def test_get_member_profile(self):
        """Test getting member profile"""
        response = self.session.get(f"{BASE_URL}/api/member/me")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_MEMBER_EMAIL
        assert "name" in data
        assert "company_name" in data
        assert "meeting_room_credits" in data
        assert "credits_remaining" in data


class TestMemberPortalInvoices:
    """Member Invoices Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup with authenticated member session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": TEST_MEMBER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Member login failed")
    
    def test_get_member_invoices(self):
        """Test getting member's invoices"""
        response = self.session.get(f"{BASE_URL}/api/member/invoices")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestMemberPortalBookings:
    """Member Room Bookings Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup with authenticated member session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": TEST_MEMBER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Member login failed")
    
    def test_get_available_rooms(self):
        """Test getting available meeting rooms"""
        response = self.session.get(f"{BASE_URL}/api/member/rooms")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "name" in data[0]
            assert "hourly_rate" in data[0]
    
    def test_check_room_availability_10am_to_6pm(self):
        """Test room availability returns 10 AM to 6 PM slots"""
        # Get first room
        rooms_response = self.session.get(f"{BASE_URL}/api/member/rooms")
        rooms = rooms_response.json()
        if not rooms:
            pytest.skip("No rooms available")
        
        room_id = rooms[0]["id"]
        response = self.session.get(f"{BASE_URL}/api/member/rooms/{room_id}/availability?date=2026-03-15")
        assert response.status_code == 200
        data = response.json()
        
        # Verify slots are from 10 AM to 6 PM
        slots = data.get("slots", [])
        assert len(slots) > 0
        
        # First slot should start at 10:00
        assert slots[0]["start_time"] == "10:00"
        
        # Last slot should end at 18:00
        assert slots[-1]["end_time"] == "18:00"
    
    def test_get_member_bookings(self):
        """Test getting member's bookings"""
        response = self.session.get(f"{BASE_URL}/api/member/bookings")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestMemberPortalTickets:
    """Member Support Tickets Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup with authenticated member session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": TEST_MEMBER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Member login failed")
    
    def test_get_member_tickets(self):
        """Test getting member's tickets"""
        response = self.session.get(f"{BASE_URL}/api/member/tickets")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_create_member_ticket(self):
        """Test creating a support ticket"""
        response = self.session.post(f"{BASE_URL}/api/member/tickets", json={
            "title": "TEST_Portal Test Ticket",
            "description": "This is a test ticket from member portal",
            "category": "general",
            "priority": "medium"
        })
        assert response.status_code == 200
        data = response.json()
        assert "ticket_number" in data
        assert data["title"] == "TEST_Portal Test Ticket"
        assert data["status"] == "open"


class TestMemberPortalAnnouncements:
    """Member Announcements Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup with authenticated member session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": TEST_MEMBER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Member login failed")
    
    def test_get_announcements(self):
        """Test getting announcements"""
        response = self.session.get(f"{BASE_URL}/api/member/announcements")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestMemberPortalSecurity:
    """Security Tests - Member cannot access admin routes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup with authenticated member session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": TEST_MEMBER_EMAIL,
            "password": TEST_MEMBER_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.member_token = token
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Member login failed")
    
    def test_member_cannot_create_admin_member(self):
        """Test that member token cannot create members (admin-only)"""
        response = self.session.post(f"{BASE_URL}/api/management/members", json={
            "name": "Hacker",
            "email": "hacker@test.com",
            "phone": "1234567890",
            "company_name": "Hack Corp",
            "plan_type_id": "any-id",
            "start_date": "2026-01-01"
        })
        # Should fail with 401 (Invalid token) because member token type is different
        assert response.status_code == 401
    
    def test_member_cannot_access_admin_users(self):
        """Test that member token cannot access admin users endpoint"""
        response = self.session.get(f"{BASE_URL}/api/auth/users")
        # Should fail with 401 (Invalid token) because member token type is different
        assert response.status_code == 401
    
    def test_member_cannot_delete_members(self):
        """Test that member token cannot delete members"""
        response = self.session.delete(f"{BASE_URL}/api/management/members/any-id")
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
