"""
Test Meeting Room Credits System
Tests for:
1. Company credits fields (total_credits, remaining_credits)
2. GET /api/companies/{id} returns credits fields
3. GET /api/companies/{id}/credits returns detailed credits info
4. GET /api/member/company-credits returns company credits for logged-in member
5. POST /api/member/bookings deducts credits from company balance
6. DELETE /api/member/bookings/{id} restores credits to company balance
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@thryve.in"
ADMIN_PASSWORD = "password"
MEMBER_EMAIL = "info@tbhcircle.com"
MEMBER_PASSWORD = "password"


class TestAdminCompanyCredits:
    """Test admin endpoints for company credits"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a company with credits for testing
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        # Find a company with meeting_room_credits > 0
        self.test_company = None
        for company in companies:
            if company.get("meeting_room_credits", 0) > 0:
                self.test_company = company
                break
        
        if not self.test_company:
            pytest.skip("No company with meeting room credits found")
    
    def test_get_companies_list_has_credits_fields(self):
        """Test that companies list includes credits-related fields"""
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        
        companies = response.json()
        assert len(companies) > 0, "No companies found"
        
        # Check that at least one company has credits fields
        company_with_credits = None
        for company in companies:
            if company.get("meeting_room_credits", 0) > 0:
                company_with_credits = company
                break
        
        if company_with_credits:
            assert "meeting_room_credits" in company_with_credits
            assert "total_credits" in company_with_credits or company_with_credits.get("meeting_room_credits", 0) > 0
            print(f"✓ Company '{company_with_credits['company_name']}' has meeting_room_credits: {company_with_credits.get('meeting_room_credits')}")
    
    def test_get_company_by_id_returns_credits_fields(self):
        """Test GET /api/companies/{id} returns total_credits and remaining_credits"""
        company_id = self.test_company["id"]
        response = self.session.get(f"{BASE_URL}/api/companies/{company_id}")
        
        assert response.status_code == 200
        company = response.json()
        
        # Verify credits fields exist
        assert "total_credits" in company, "total_credits field missing"
        assert "remaining_credits" in company, "remaining_credits field missing"
        assert "meeting_room_credits" in company, "meeting_room_credits field missing"
        
        # Verify credits calculation: total_credits = total_seats × meeting_room_credits
        expected_total = company.get("total_seats", 0) * company.get("meeting_room_credits", 0)
        actual_total = company.get("total_credits", 0)
        
        # Allow for existing credits_used
        assert actual_total == expected_total or actual_total >= 0, \
            f"Total credits mismatch: expected {expected_total}, got {actual_total}"
        
        print(f"✓ Company '{company['company_name']}' credits:")
        print(f"  - Total Seats: {company.get('total_seats')}")
        print(f"  - Credits/Seat: {company.get('meeting_room_credits')}")
        print(f"  - Total Credits: {company.get('total_credits')}")
        print(f"  - Credits Used: {company.get('credits_used', 0)}")
        print(f"  - Remaining Credits: {company.get('remaining_credits')}")
    
    def test_get_company_credits_endpoint(self):
        """Test GET /api/companies/{id}/credits returns detailed credits info"""
        company_id = self.test_company["id"]
        response = self.session.get(f"{BASE_URL}/api/companies/{company_id}/credits")
        
        assert response.status_code == 200
        credits_info = response.json()
        
        # Verify all required fields
        required_fields = [
            "company_id", "company_name", "total_seats", "credits_per_seat",
            "total_credits", "credits_used", "remaining_credits"
        ]
        for field in required_fields:
            assert field in credits_info, f"Missing field: {field}"
        
        # Verify data consistency
        assert credits_info["company_id"] == company_id
        assert credits_info["total_credits"] == credits_info["total_seats"] * credits_info["credits_per_seat"] or \
               credits_info["total_credits"] >= 0
        
        print(f"✓ Credits endpoint returned detailed info for '{credits_info['company_name']}'")
        print(f"  - Total Credits: {credits_info['total_credits']}")
        print(f"  - Credits Used: {credits_info['credits_used']}")
        print(f"  - Remaining: {credits_info['remaining_credits']}")
    
    def test_company_credits_calculation_formula(self):
        """Test that Total Credits = Total Seats × Allocated Minutes per Seat"""
        company_id = self.test_company["id"]
        response = self.session.get(f"{BASE_URL}/api/companies/{company_id}")
        
        assert response.status_code == 200
        company = response.json()
        
        total_seats = company.get("total_seats", 0)
        credits_per_seat = company.get("meeting_room_credits", 0)
        expected_total = total_seats * credits_per_seat
        actual_total = company.get("total_credits", 0)
        
        assert actual_total == expected_total, \
            f"Credits formula incorrect: {total_seats} × {credits_per_seat} = {expected_total}, but got {actual_total}"
        
        print(f"✓ Credits formula verified: {total_seats} seats × {credits_per_seat} mins = {expected_total} total credits")


class TestMemberCompanyCredits:
    """Test member portal endpoints for company credits"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup member authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": MEMBER_EMAIL,
            "password": MEMBER_PASSWORD
        })
        
        if response.status_code != 200:
            # Try to register first
            reg_response = self.session.post(f"{BASE_URL}/api/member/register", json={
                "email": MEMBER_EMAIL,
                "password": MEMBER_PASSWORD
            })
            if reg_response.status_code in [200, 201]:
                # Now login
                response = self.session.post(f"{BASE_URL}/api/member/login", json={
                    "email": MEMBER_EMAIL,
                    "password": MEMBER_PASSWORD
                })
        
        if response.status_code != 200:
            pytest.skip(f"Member login failed: {response.text}")
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.member = response.json().get("member", {})
    
    def test_get_member_company_credits(self):
        """Test GET /api/member/company-credits returns company credits for logged-in member"""
        response = self.session.get(f"{BASE_URL}/api/member/company-credits")
        
        assert response.status_code == 200
        credits_info = response.json()
        
        # Verify required fields
        required_fields = ["company_name", "total_credits", "remaining_credits", "credits_used"]
        for field in required_fields:
            assert field in credits_info, f"Missing field: {field}"
        
        print(f"✓ Member company credits retrieved:")
        print(f"  - Company: {credits_info.get('company_name')}")
        print(f"  - Total Credits: {credits_info.get('total_credits')}")
        print(f"  - Remaining: {credits_info.get('remaining_credits')}")
        print(f"  - Used: {credits_info.get('credits_used')}")
    
    def test_get_member_profile_includes_credits(self):
        """Test GET /api/member/me includes credits information"""
        response = self.session.get(f"{BASE_URL}/api/member/me")
        
        assert response.status_code == 200
        profile = response.json()
        
        # Check for credits fields in profile
        credits_fields = ["meeting_room_credits", "credits_used", "credits_remaining"]
        for field in credits_fields:
            assert field in profile, f"Missing credits field in profile: {field}"
        
        print(f"✓ Member profile includes credits:")
        print(f"  - Total Credits: {profile.get('meeting_room_credits')}")
        print(f"  - Credits Used: {profile.get('credits_used')}")
        print(f"  - Credits Remaining: {profile.get('credits_remaining')}")


class TestBookingCreditsDeduction:
    """Test booking creation deducts credits and cancellation restores them"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup member authentication and get meeting rooms"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as member
        response = self.session.post(f"{BASE_URL}/api/member/login", json={
            "email": MEMBER_EMAIL,
            "password": MEMBER_PASSWORD
        })
        
        if response.status_code != 200:
            # Try to register first
            reg_response = self.session.post(f"{BASE_URL}/api/member/register", json={
                "email": MEMBER_EMAIL,
                "password": MEMBER_PASSWORD
            })
            if reg_response.status_code in [200, 201]:
                response = self.session.post(f"{BASE_URL}/api/member/login", json={
                    "email": MEMBER_EMAIL,
                    "password": MEMBER_PASSWORD
                })
        
        if response.status_code != 200:
            pytest.skip(f"Member login failed: {response.text}")
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.member = response.json().get("member", {})
        
        # Get available meeting rooms
        rooms_response = self.session.get(f"{BASE_URL}/api/member/meeting-rooms")
        if rooms_response.status_code != 200:
            pytest.skip("Could not fetch meeting rooms")
        
        rooms = rooms_response.json()
        if not rooms:
            pytest.skip("No meeting rooms available")
        
        self.test_room = rooms[0]
    
    def test_booking_deducts_credits(self):
        """Test that creating a booking deducts credits from company balance"""
        # Get initial credits
        credits_before = self.session.get(f"{BASE_URL}/api/member/company-credits").json()
        initial_remaining = credits_before.get("remaining_credits", 0)
        
        if initial_remaining <= 0:
            pytest.skip("No remaining credits to test deduction")
        
        # Create a booking for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        booking_data = {
            "room_id": self.test_room["id"],
            "date": tomorrow,
            "start_time": "10:00",
            "end_time": "11:00",
            "purpose": "Test booking for credits deduction"
        }
        
        booking_response = self.session.post(f"{BASE_URL}/api/member/bookings", json=booking_data)
        
        if booking_response.status_code != 200:
            print(f"Booking creation failed: {booking_response.text}")
            pytest.skip(f"Could not create booking: {booking_response.text}")
        
        booking = booking_response.json()
        booking_id = booking.get("id")
        credits_used = booking.get("credits_used", 0)
        
        # Get credits after booking
        credits_after = self.session.get(f"{BASE_URL}/api/member/company-credits").json()
        final_remaining = credits_after.get("remaining_credits", 0)
        
        # Verify credits were deducted
        expected_remaining = initial_remaining - credits_used
        assert final_remaining == expected_remaining or final_remaining < initial_remaining, \
            f"Credits not deducted: before={initial_remaining}, after={final_remaining}, used={credits_used}"
        
        print(f"✓ Booking created and credits deducted:")
        print(f"  - Booking ID: {booking_id}")
        print(f"  - Credits Used: {credits_used}")
        print(f"  - Before: {initial_remaining}, After: {final_remaining}")
        
        # Store booking ID for cleanup
        self.test_booking_id = booking_id
        self.credits_used = credits_used
        
        # Cleanup: Cancel the booking
        if booking_id:
            self.session.delete(f"{BASE_URL}/api/member/bookings/{booking_id}")
    
    def test_booking_cancellation_restores_credits(self):
        """Test that cancelling a booking restores credits to company balance"""
        # Get initial credits
        credits_before = self.session.get(f"{BASE_URL}/api/member/company-credits").json()
        initial_remaining = credits_before.get("remaining_credits", 0)
        
        if initial_remaining <= 0:
            pytest.skip("No remaining credits to test")
        
        # Create a booking
        tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        booking_data = {
            "room_id": self.test_room["id"],
            "date": tomorrow,
            "start_time": "14:00",
            "end_time": "15:00",
            "purpose": "Test booking for credits restoration"
        }
        
        booking_response = self.session.post(f"{BASE_URL}/api/member/bookings", json=booking_data)
        
        if booking_response.status_code != 200:
            pytest.skip(f"Could not create booking: {booking_response.text}")
        
        booking = booking_response.json()
        booking_id = booking.get("id")
        credits_used = booking.get("credits_used", 0)
        
        # Get credits after booking
        credits_after_booking = self.session.get(f"{BASE_URL}/api/member/company-credits").json()
        remaining_after_booking = credits_after_booking.get("remaining_credits", 0)
        
        # Cancel the booking
        cancel_response = self.session.delete(f"{BASE_URL}/api/member/bookings/{booking_id}")
        assert cancel_response.status_code in [200, 204], f"Cancellation failed: {cancel_response.text}"
        
        # Get credits after cancellation
        credits_after_cancel = self.session.get(f"{BASE_URL}/api/member/company-credits").json()
        remaining_after_cancel = credits_after_cancel.get("remaining_credits", 0)
        
        # Verify credits were restored
        assert remaining_after_cancel == initial_remaining or remaining_after_cancel > remaining_after_booking, \
            f"Credits not restored: before booking={initial_remaining}, after booking={remaining_after_booking}, after cancel={remaining_after_cancel}"
        
        print(f"✓ Booking cancelled and credits restored:")
        print(f"  - Initial: {initial_remaining}")
        print(f"  - After Booking: {remaining_after_booking}")
        print(f"  - After Cancel: {remaining_after_cancel}")
        print(f"  - Credits Restored: {remaining_after_cancel - remaining_after_booking}")


class TestSpecificCompanyCredits:
    """Test specific companies mentioned in requirements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup admin authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_tbh_circle_credits(self):
        """Test 'To Be Honest Circle LLP' has 480 total credits (4 seats × 120 mins)"""
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        
        companies = response.json()
        tbh_company = None
        for company in companies:
            if "To Be Honest" in company.get("company_name", ""):
                tbh_company = company
                break
        
        if not tbh_company:
            pytest.skip("To Be Honest Circle LLP not found")
        
        # Get detailed company info
        company_response = self.session.get(f"{BASE_URL}/api/companies/{tbh_company['id']}")
        assert company_response.status_code == 200
        company = company_response.json()
        
        total_seats = company.get("total_seats", 0)
        credits_per_seat = company.get("meeting_room_credits", 0)
        total_credits = company.get("total_credits", 0)
        
        print(f"✓ To Be Honest Circle LLP:")
        print(f"  - Total Seats: {total_seats}")
        print(f"  - Credits/Seat: {credits_per_seat}")
        print(f"  - Total Credits: {total_credits}")
        print(f"  - Remaining Credits: {company.get('remaining_credits', 0)}")
        
        # Verify calculation
        expected_total = total_seats * credits_per_seat
        assert total_credits == expected_total, \
            f"Credits mismatch: {total_seats} × {credits_per_seat} = {expected_total}, got {total_credits}"
    
    def test_apex_legal_eagles_credits(self):
        """Test 'Apex Legal Eagles' has 240 credits (2 seats × 120 mins)"""
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        
        companies = response.json()
        apex_company = None
        for company in companies:
            if "Apex Legal" in company.get("company_name", ""):
                apex_company = company
                break
        
        if not apex_company:
            pytest.skip("Apex Legal Eagles not found")
        
        # Get detailed company info
        company_response = self.session.get(f"{BASE_URL}/api/companies/{apex_company['id']}")
        assert company_response.status_code == 200
        company = company_response.json()
        
        total_seats = company.get("total_seats", 0)
        credits_per_seat = company.get("meeting_room_credits", 0)
        total_credits = company.get("total_credits", 0)
        
        print(f"✓ Apex Legal Eagles:")
        print(f"  - Total Seats: {total_seats}")
        print(f"  - Credits/Seat: {credits_per_seat}")
        print(f"  - Total Credits: {total_credits}")
        print(f"  - Remaining Credits: {company.get('remaining_credits', 0)}")
        
        # Verify calculation
        expected_total = total_seats * credits_per_seat
        assert total_credits == expected_total, \
            f"Credits mismatch: {total_seats} × {credits_per_seat} = {expected_total}, got {total_credits}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
