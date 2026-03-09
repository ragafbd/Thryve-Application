"""
Test Booking Rules for Thryve Coworking Management System
- 10 AM to 6 PM slots only
- Max 10 days advance booking
- Min 2 days before cancellation
- Multi-slot selection (consecutive slots)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBookingRules:
    """Test booking rules for meeting rooms"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.admin_token = None
        self.member_id = None
        self.room_id = None
        
        # Login as admin
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "admin123"
        })
        if response.status_code == 200:
            self.admin_token = response.json()["access_token"]
        
        # Get a room
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        if rooms_response.status_code == 200 and rooms_response.json():
            self.room_id = rooms_response.json()[0]["id"]
        
        # Get a member
        members_response = requests.get(f"{BASE_URL}/api/management/members?status=active")
        if members_response.status_code == 200 and members_response.json():
            self.member_id = members_response.json()[0]["id"]
    
    def test_slots_are_10am_to_6pm(self):
        """Test that booking slots are from 10 AM to 6 PM only"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/management/bookings/availability", params={
            "room_id": self.room_id,
            "date": today
        })
        
        assert response.status_code == 200, f"Failed to get availability: {response.text}"
        data = response.json()
        slots = data.get("slots", [])
        
        assert len(slots) > 0, "No slots returned"
        
        # Check first slot starts at 10:00
        first_slot = slots[0]
        assert first_slot["start_time"] == "10:00", f"First slot should start at 10:00, got {first_slot['start_time']}"
        
        # Check last slot ends at 18:00
        last_slot = slots[-1]
        assert last_slot["end_time"] == "18:00", f"Last slot should end at 18:00, got {last_slot['end_time']}"
        
        print(f"SUCCESS: Slots are from 10:00 to 18:00 ({len(slots)} slots)")
    
    def test_booking_within_10_days_allowed(self):
        """Test that booking within 10 days is allowed"""
        if not self.admin_token or not self.room_id or not self.member_id:
            pytest.skip("Missing test data")
        
        # Book for 5 days from now (should be allowed)
        booking_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "room_id": self.room_id,
                "member_id": self.member_id,
                "date": booking_date,
                "start_time": "10:00",
                "end_time": "10:30",
                "purpose": "TEST_booking_within_10_days"
            }
        )
        
        assert response.status_code == 200, f"Booking within 10 days should be allowed: {response.text}"
        booking = response.json()
        print(f"SUCCESS: Booking created for {booking_date} (5 days from now)")
        
        # Cleanup - cancel the booking
        if booking.get("id"):
            requests.delete(
                f"{BASE_URL}/api/management/bookings/{booking['id']}",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
    
    def test_booking_beyond_10_days_rejected(self):
        """Test that booking beyond 10 days is rejected"""
        if not self.admin_token or not self.room_id or not self.member_id:
            pytest.skip("Missing test data")
        
        # Try to book for 15 days from now (should be rejected)
        booking_date = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "room_id": self.room_id,
                "member_id": self.member_id,
                "date": booking_date,
                "start_time": "10:00",
                "end_time": "10:30",
                "purpose": "TEST_booking_beyond_10_days"
            }
        )
        
        assert response.status_code == 400, f"Booking beyond 10 days should be rejected, got {response.status_code}"
        error = response.json()
        assert "10 days" in error.get("detail", "").lower() or "advance" in error.get("detail", "").lower(), \
            f"Error should mention 10 days limit: {error}"
        print(f"SUCCESS: Booking beyond 10 days correctly rejected: {error.get('detail')}")
    
    def test_booking_in_past_rejected(self):
        """Test that booking in the past is rejected"""
        if not self.admin_token or not self.room_id or not self.member_id:
            pytest.skip("Missing test data")
        
        # Try to book for yesterday (should be rejected)
        booking_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "room_id": self.room_id,
                "member_id": self.member_id,
                "date": booking_date,
                "start_time": "10:00",
                "end_time": "10:30",
                "purpose": "TEST_booking_in_past"
            }
        )
        
        assert response.status_code == 400, f"Booking in past should be rejected, got {response.status_code}"
        print(f"SUCCESS: Booking in past correctly rejected")
    
    def test_cancellation_2_days_before_allowed(self):
        """Test that cancellation 2+ days before is allowed"""
        if not self.admin_token or not self.room_id or not self.member_id:
            pytest.skip("Missing test data")
        
        # Create a booking for 5 days from now
        booking_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        
        create_response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "room_id": self.room_id,
                "member_id": self.member_id,
                "date": booking_date,
                "start_time": "11:00",
                "end_time": "11:30",
                "purpose": "TEST_cancellation_allowed"
            }
        )
        
        if create_response.status_code != 200:
            pytest.skip(f"Could not create booking: {create_response.text}")
        
        booking = create_response.json()
        booking_id = booking.get("id")
        
        # Cancel the booking (should be allowed - 5 days > 2 days)
        cancel_response = requests.delete(
            f"{BASE_URL}/api/management/bookings/{booking_id}",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        assert cancel_response.status_code == 200, f"Cancellation 5 days before should be allowed: {cancel_response.text}"
        print(f"SUCCESS: Cancellation 5 days before correctly allowed")
    
    def test_multi_slot_booking(self):
        """Test that multi-slot booking works (consecutive slots)"""
        if not self.admin_token or not self.room_id or not self.member_id:
            pytest.skip("Missing test data")
        
        # Book multiple consecutive slots (10:00-11:00 = 2 x 30min slots)
        booking_date = (datetime.now() + timedelta(days=6)).strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "room_id": self.room_id,
                "member_id": self.member_id,
                "date": booking_date,
                "start_time": "10:00",
                "end_time": "11:00",  # 1 hour = 2 consecutive 30-min slots
                "purpose": "TEST_multi_slot_booking"
            }
        )
        
        assert response.status_code == 200, f"Multi-slot booking should work: {response.text}"
        booking = response.json()
        assert booking.get("duration_minutes") == 60, f"Duration should be 60 minutes, got {booking.get('duration_minutes')}"
        print(f"SUCCESS: Multi-slot booking created (60 minutes)")
        
        # Cleanup
        if booking.get("id"):
            requests.delete(
                f"{BASE_URL}/api/management/bookings/{booking['id']}",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
    
    def test_slot_conflict_detection(self):
        """Test that overlapping bookings are rejected"""
        if not self.admin_token or not self.room_id or not self.member_id:
            pytest.skip("Missing test data")
        
        booking_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        # Create first booking
        first_response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "room_id": self.room_id,
                "member_id": self.member_id,
                "date": booking_date,
                "start_time": "14:00",
                "end_time": "15:00",
                "purpose": "TEST_conflict_first"
            }
        )
        
        if first_response.status_code != 200:
            pytest.skip(f"Could not create first booking: {first_response.text}")
        
        first_booking = first_response.json()
        
        # Try to create overlapping booking
        conflict_response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json={
                "room_id": self.room_id,
                "member_id": self.member_id,
                "date": booking_date,
                "start_time": "14:30",
                "end_time": "15:30",
                "purpose": "TEST_conflict_second"
            }
        )
        
        assert conflict_response.status_code == 400, f"Overlapping booking should be rejected, got {conflict_response.status_code}"
        print(f"SUCCESS: Overlapping booking correctly rejected")
        
        # Cleanup
        if first_booking.get("id"):
            requests.delete(
                f"{BASE_URL}/api/management/bookings/{first_booking['id']}",
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )


class TestAdminRouting:
    """Test admin routing under /admin prefix"""
    
    def test_admin_login_endpoint(self):
        """Test admin login at /api/auth/login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "admin123"
        })
        
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert data["user"]["role"] == "admin", "User should be admin"
        print(f"SUCCESS: Admin login works correctly")
    
    def test_management_endpoints_require_auth(self):
        """Test that management endpoints require authentication"""
        # Try to create a booking without auth
        response = requests.post(f"{BASE_URL}/api/management/bookings", json={
            "room_id": "test",
            "member_id": "test",
            "date": "2026-01-15",
            "start_time": "10:00",
            "end_time": "10:30"
        })
        
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print(f"SUCCESS: Management endpoints require authentication")
    
    def test_rooms_endpoint_public(self):
        """Test that rooms endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/management/rooms")
        
        assert response.status_code == 200, f"Rooms endpoint failed: {response.text}"
        rooms = response.json()
        assert isinstance(rooms, list), "Rooms should be a list"
        print(f"SUCCESS: Rooms endpoint accessible ({len(rooms)} rooms)")


class TestMemberPortalRouting:
    """Test member portal routing"""
    
    def test_member_login_endpoint(self):
        """Test member login at /api/member/login"""
        response = requests.post(f"{BASE_URL}/api/member/login", json={
            "email": "testmember@thryve.in",
            "password": "member123"
        })
        
        assert response.status_code == 200, f"Member login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        print(f"SUCCESS: Member login works correctly")
    
    def test_member_booking_availability(self):
        """Test member portal booking availability shows 10 AM - 6 PM"""
        # Login as member
        login_response = requests.post(f"{BASE_URL}/api/member/login", json={
            "email": "testmember@thryve.in",
            "password": "member123"
        })
        
        if login_response.status_code != 200:
            pytest.skip("Member login failed")
        
        token = login_response.json()["access_token"]
        
        # Get rooms
        rooms_response = requests.get(
            f"{BASE_URL}/api/member/rooms",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if rooms_response.status_code != 200 or not rooms_response.json():
            pytest.skip("Could not get rooms")
        
        room_id = rooms_response.json()[0]["id"]
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Get availability
        avail_response = requests.get(
            f"{BASE_URL}/api/member/bookings/availability",
            headers={"Authorization": f"Bearer {token}"},
            params={"room_id": room_id, "date": today}
        )
        
        assert avail_response.status_code == 200, f"Availability check failed: {avail_response.text}"
        data = avail_response.json()
        slots = data.get("slots", [])
        
        assert len(slots) > 0, "No slots returned"
        assert slots[0]["start_time"] == "10:00", f"First slot should be 10:00, got {slots[0]['start_time']}"
        assert slots[-1]["end_time"] == "18:00", f"Last slot should end at 18:00, got {slots[-1]['end_time']}"
        print(f"SUCCESS: Member portal shows 10 AM - 6 PM slots")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
