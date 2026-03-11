"""
Test Public Holidays Feature
- GET /api/holidays - List all holidays
- GET /api/holidays/dates - Get just dates array
- POST /api/holidays - Create new holiday (admin only)
- PUT /api/holidays/{id} - Update holiday
- DELETE /api/holidays/{id} - Delete holiday
- Booking blocking on public holidays
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cowork-hub-11.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@thryve.in"
ADMIN_PASSWORD = "password"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestPublicHolidaysAPI:
    """Test Public Holidays CRUD operations"""
    
    def test_get_holidays_list(self):
        """GET /api/holidays - Should return list of holidays"""
        response = requests.get(f"{BASE_URL}/api/holidays")
        assert response.status_code == 200
        
        holidays = response.json()
        assert isinstance(holidays, list)
        assert len(holidays) > 0  # Default holidays should be seeded
        
        # Verify holiday structure
        holiday = holidays[0]
        assert "id" in holiday
        assert "date" in holiday
        assert "name" in holiday
        assert "is_active" in holiday
        print(f"✓ GET /api/holidays returned {len(holidays)} holidays")
    
    def test_get_holidays_by_year(self):
        """GET /api/holidays?year=2026 - Should filter by year"""
        response = requests.get(f"{BASE_URL}/api/holidays?year=2026")
        assert response.status_code == 200
        
        holidays = response.json()
        assert isinstance(holidays, list)
        
        # All holidays should be from 2026
        for holiday in holidays:
            assert holiday["date"].startswith("2026")
        print(f"✓ GET /api/holidays?year=2026 returned {len(holidays)} holidays for 2026")
    
    def test_get_holiday_dates_only(self):
        """GET /api/holidays/dates - Should return just dates array"""
        response = requests.get(f"{BASE_URL}/api/holidays/dates")
        assert response.status_code == 200
        
        dates = response.json()
        assert isinstance(dates, list)
        assert len(dates) > 0
        
        # Verify date format
        for date in dates:
            assert isinstance(date, str)
            # Should be YYYY-MM-DD format
            datetime.strptime(date, "%Y-%m-%d")
        print(f"✓ GET /api/holidays/dates returned {len(dates)} dates")
    
    def test_get_holiday_dates_by_year(self):
        """GET /api/holidays/dates?year=2026 - Should filter dates by year"""
        response = requests.get(f"{BASE_URL}/api/holidays/dates?year=2026")
        assert response.status_code == 200
        
        dates = response.json()
        assert isinstance(dates, list)
        
        # All dates should be from 2026
        for date in dates:
            assert date.startswith("2026")
        print(f"✓ GET /api/holidays/dates?year=2026 returned {len(dates)} dates")
    
    def test_create_holiday_requires_auth(self):
        """POST /api/holidays - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/holidays",
            json={"date": "2026-12-31", "name": "Test Holiday"}
        )
        assert response.status_code in [401, 403]
        print("✓ POST /api/holidays requires authentication")
    
    def test_create_holiday_admin_only(self, auth_headers):
        """POST /api/holidays - Admin can create holiday"""
        # Use a unique date to avoid conflicts
        test_date = "2027-01-01"
        
        response = requests.post(
            f"{BASE_URL}/api/holidays",
            headers=auth_headers,
            json={
                "date": test_date,
                "name": "TEST_New Year 2027",
                "description": "Test holiday for testing"
            }
        )
        
        # May fail if holiday already exists
        if response.status_code == 400 and "already exists" in response.text:
            print("✓ POST /api/holidays - Holiday already exists (expected)")
            return
        
        assert response.status_code == 200
        holiday = response.json()
        assert holiday["date"] == test_date
        assert holiday["name"] == "TEST_New Year 2027"
        assert holiday["is_active"] == True
        print(f"✓ POST /api/holidays created holiday: {holiday['name']}")
    
    def test_create_holiday_invalid_date(self, auth_headers):
        """POST /api/holidays - Should reject invalid date format"""
        response = requests.post(
            f"{BASE_URL}/api/holidays",
            headers=auth_headers,
            json={
                "date": "invalid-date",
                "name": "Invalid Holiday"
            }
        )
        assert response.status_code == 400
        print("✓ POST /api/holidays rejects invalid date format")
    
    def test_update_holiday(self, auth_headers):
        """PUT /api/holidays/{id} - Admin can update holiday"""
        # First get a holiday to update
        response = requests.get(f"{BASE_URL}/api/holidays?year=2027&active_only=false")
        holidays = response.json()
        
        if not holidays:
            pytest.skip("No holidays found to update")
        
        holiday_id = holidays[0]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/holidays/{holiday_id}",
            headers=auth_headers,
            json={"description": "Updated description for testing"}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["description"] == "Updated description for testing"
        print(f"✓ PUT /api/holidays/{holiday_id} updated successfully")
    
    def test_update_holiday_not_found(self, auth_headers):
        """PUT /api/holidays/{id} - Should return 404 for non-existent holiday"""
        response = requests.put(
            f"{BASE_URL}/api/holidays/non-existent-id",
            headers=auth_headers,
            json={"name": "Updated Name"}
        )
        assert response.status_code == 404
        print("✓ PUT /api/holidays returns 404 for non-existent holiday")
    
    def test_toggle_holiday_active_status(self, auth_headers):
        """PUT /api/holidays/{id} - Can toggle is_active status"""
        # Get a holiday
        response = requests.get(f"{BASE_URL}/api/holidays?year=2027&active_only=false")
        holidays = response.json()
        
        if not holidays:
            pytest.skip("No holidays found to toggle")
        
        holiday = holidays[0]
        holiday_id = holiday["id"]
        current_status = holiday["is_active"]
        
        # Toggle status
        response = requests.put(
            f"{BASE_URL}/api/holidays/{holiday_id}",
            headers=auth_headers,
            json={"is_active": not current_status}
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["is_active"] == (not current_status)
        
        # Toggle back
        response = requests.put(
            f"{BASE_URL}/api/holidays/{holiday_id}",
            headers=auth_headers,
            json={"is_active": current_status}
        )
        assert response.status_code == 200
        print(f"✓ PUT /api/holidays/{holiday_id} toggled is_active successfully")


class TestDefaultHolidays:
    """Test that default Indian holidays are seeded"""
    
    def test_2025_holidays_seeded(self):
        """Verify 2025 Indian holidays are present"""
        response = requests.get(f"{BASE_URL}/api/holidays?year=2025")
        assert response.status_code == 200
        
        holidays = response.json()
        holiday_names = [h["name"] for h in holidays]
        
        # Check for key Indian holidays
        expected_holidays = [
            "Republic Day",
            "Holi",
            "Independence Day",
            "Gandhi Jayanti",
            "Diwali",
            "Christmas"
        ]
        
        for expected in expected_holidays:
            assert any(expected in name for name in holiday_names), f"Missing {expected} in 2025"
        print(f"✓ 2025 holidays seeded correctly ({len(holidays)} holidays)")
    
    def test_2026_holidays_seeded(self):
        """Verify 2026 Indian holidays are present"""
        response = requests.get(f"{BASE_URL}/api/holidays?year=2026")
        assert response.status_code == 200
        
        holidays = response.json()
        holiday_names = [h["name"] for h in holidays]
        
        # Check for key Indian holidays
        expected_holidays = [
            "Republic Day",
            "Holi",
            "Independence Day",
            "Gandhi Jayanti",
            "Diwali",
            "Christmas"
        ]
        
        for expected in expected_holidays:
            assert any(expected in name for name in holiday_names), f"Missing {expected} in 2026"
        print(f"✓ 2026 holidays seeded correctly ({len(holidays)} holidays)")
    
    def test_holi_2026_exists(self):
        """Verify Holi 2026 exists in the database"""
        response = requests.get(f"{BASE_URL}/api/holidays?year=2026")
        holidays = response.json()
        
        holi = next((h for h in holidays if h["name"] == "Holi"), None)
        assert holi is not None, "Holi 2026 not found"
        assert holi["date"].startswith("2026-03"), f"Holi 2026 should be in March: {holi['date']}"
        print(f"✓ Holi 2026 exists with date: {holi['date']}")
    
    def test_independence_day_2026_date(self):
        """Verify Independence Day 2026 is on August 15"""
        response = requests.get(f"{BASE_URL}/api/holidays?year=2026")
        holidays = response.json()
        
        ind_day = next((h for h in holidays if h["name"] == "Independence Day"), None)
        assert ind_day is not None, "Independence Day 2026 not found"
        assert ind_day["date"] == "2026-08-15", f"Independence Day 2026 date incorrect: {ind_day['date']}"
        print("✓ Independence Day 2026 is correctly set to 2026-08-15")


class TestBookingBlockingOnHolidays:
    """Test that bookings are blocked on public holidays"""
    
    def test_availability_blocked_on_holi_2026(self, auth_headers):
        """Check availability returns empty slots on Holi (actual date from DB)"""
        # Get Holi date from database
        holidays_response = requests.get(f"{BASE_URL}/api/holidays?year=2026")
        holidays = holidays_response.json()
        holi = next((h for h in holidays if h["name"] == "Holi"), None)
        
        if not holi:
            pytest.skip("Holi 2026 not found in database")
        
        holi_date = holi["date"]
        
        # Get a room first
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        
        if not rooms:
            pytest.skip("No rooms found")
        
        room_id = rooms[0]["id"]
        
        # Check availability on Holi 2026
        response = requests.get(
            f"{BASE_URL}/api/management/bookings/availability?room_id={room_id}&date={holi_date}"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["slots"] == [], f"Slots should be empty on public holiday ({holi_date})"
        assert "message" in data
        assert "Holi" in data["message"] or "not available" in data["message"].lower()
        print(f"✓ Availability blocked on Holi 2026 ({holi_date}): {data.get('message', 'No slots')}")
    
    def test_availability_blocked_on_independence_day_2026(self, auth_headers):
        """Check availability returns empty slots on Independence Day (2026-08-15)"""
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        
        if not rooms:
            pytest.skip("No rooms found")
        
        room_id = rooms[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/management/bookings/availability?room_id={room_id}&date=2026-08-15"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["slots"] == [], "Slots should be empty on public holiday"
        assert "message" in data
        print(f"✓ Availability blocked on Independence Day 2026: {data.get('message', 'No slots')}")
    
    def test_availability_blocked_on_sunday(self, auth_headers):
        """Check availability returns empty slots on Sunday (2026-03-08)"""
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        
        if not rooms:
            pytest.skip("No rooms found")
        
        room_id = rooms[0]["id"]
        
        # 2026-03-08 is a Sunday
        response = requests.get(
            f"{BASE_URL}/api/management/bookings/availability?room_id={room_id}&date=2026-03-08"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["slots"] == [], "Slots should be empty on Sunday"
        assert "message" in data
        assert "Sunday" in data["message"]
        print(f"✓ Availability blocked on Sunday 2026-03-08: {data.get('message', 'No slots')}")
    
    def test_availability_available_on_weekday(self, auth_headers):
        """Check availability returns slots on non-holiday weekday (2026-03-09)"""
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        
        if not rooms:
            pytest.skip("No rooms found")
        
        room_id = rooms[0]["id"]
        
        # 2026-03-09 is a Monday (not a holiday)
        response = requests.get(
            f"{BASE_URL}/api/management/bookings/availability?room_id={room_id}&date=2026-03-09"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["slots"]) > 0, "Slots should be available on weekday"
        print(f"✓ Availability available on weekday 2026-03-09: {len(data['slots'])} slots")
    
    def test_booking_rejected_on_holiday(self, auth_headers):
        """POST /api/management/bookings - Should reject booking on public holiday"""
        # Get a future holiday from database (within 10 days booking window)
        holidays_response = requests.get(f"{BASE_URL}/api/holidays?year=2026")
        holidays = holidays_response.json()
        
        # Find a future holiday within booking window
        today = datetime.now()
        max_date = today + timedelta(days=10)
        
        future_holiday = None
        for h in holidays:
            holiday_date = datetime.strptime(h["date"], "%Y-%m-%d")
            if today < holiday_date <= max_date:
                future_holiday = h
                break
        
        if not future_holiday:
            # If no holiday in booking window, test with Independence Day (should fail with "Cannot book in the past" or "advance booking" error)
            pytest.skip("No public holiday within 10-day booking window to test")
        
        holiday_date = future_holiday["date"]
        holiday_name = future_holiday["name"]
        
        # Get a room and member
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        
        members_response = requests.get(
            f"{BASE_URL}/api/management/members?status=active",
            headers=auth_headers
        )
        members = members_response.json()
        
        if not rooms or not members:
            pytest.skip("No rooms or members found")
        
        room_id = rooms[0]["id"]
        member_id = members[0]["id"]
        
        # Try to book on the holiday
        response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers=auth_headers,
            json={
                "room_id": room_id,
                "member_id": member_id,
                "date": holiday_date,
                "start_time": "10:00",
                "end_time": "11:00",
                "purpose": "Test booking on holiday"
            }
        )
        
        assert response.status_code == 400
        error = response.json()
        assert "detail" in error
        assert holiday_name in error["detail"] or "not available" in error["detail"].lower()
        print(f"✓ Booking rejected on {holiday_name} ({holiday_date}): {error['detail']}")
    
    def test_booking_rejected_on_sunday(self, auth_headers):
        """POST /api/management/bookings - Should reject booking on Sunday"""
        rooms_response = requests.get(f"{BASE_URL}/api/management/rooms")
        rooms = rooms_response.json()
        
        members_response = requests.get(
            f"{BASE_URL}/api/management/members?status=active",
            headers=auth_headers
        )
        members = members_response.json()
        
        if not rooms or not members:
            pytest.skip("No rooms or members found")
        
        room_id = rooms[0]["id"]
        member_id = members[0]["id"]
        
        # Find next Sunday within booking window (10 days)
        today = datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7  # Next Sunday
        
        next_sunday = today + timedelta(days=days_until_sunday)
        sunday_date = next_sunday.strftime("%Y-%m-%d")
        
        # Try to book on Sunday
        response = requests.post(
            f"{BASE_URL}/api/management/bookings",
            headers=auth_headers,
            json={
                "room_id": room_id,
                "member_id": member_id,
                "date": sunday_date,
                "start_time": "10:00",
                "end_time": "11:00",
                "purpose": "Test booking on Sunday"
            }
        )
        
        assert response.status_code == 400
        error = response.json()
        assert "detail" in error
        assert "Sunday" in error["detail"]
        print(f"✓ Booking rejected on Sunday ({sunday_date}): {error['detail']}")


class TestMemberPortalHolidayBlocking:
    """Test that member portal also blocks bookings on holidays"""
    
    @pytest.fixture(scope="class")
    def member_token(self):
        """Get member authentication token"""
        # Try to login as test member
        response = requests.post(
            f"{BASE_URL}/api/member/login",
            json={"email": "testmember@thryve.in", "password": "member123"}
        )
        if response.status_code != 200:
            pytest.skip(f"Member login failed: {response.text}")
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def member_headers(self, member_token):
        """Get member authorization headers"""
        return {"Authorization": f"Bearer {member_token}"}
    
    def test_member_availability_blocked_on_holiday(self, member_headers):
        """Member portal should show no slots on public holiday"""
        # Get rooms
        rooms_response = requests.get(
            f"{BASE_URL}/api/member/rooms",
            headers=member_headers
        )
        
        if rooms_response.status_code != 200:
            pytest.skip("Could not get rooms")
        
        rooms = rooms_response.json()
        if not rooms:
            pytest.skip("No rooms found")
        
        room_id = rooms[0]["id"]
        
        # Check availability on Holi 2026
        response = requests.get(
            f"{BASE_URL}/api/member/rooms/{room_id}/availability?date=2026-03-10",
            headers=member_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["slots"] == [], "Member portal should show no slots on holiday"
        print(f"✓ Member portal blocks availability on Holi 2026")
    
    def test_member_booking_rejected_on_holiday(self, member_headers):
        """Member portal should reject booking on public holiday"""
        # Get rooms
        rooms_response = requests.get(
            f"{BASE_URL}/api/member/rooms",
            headers=member_headers
        )
        
        if rooms_response.status_code != 200:
            pytest.skip("Could not get rooms")
        
        rooms = rooms_response.json()
        if not rooms:
            pytest.skip("No rooms found")
        
        room_id = rooms[0]["id"]
        
        # Try to book on Holi 2026
        response = requests.post(
            f"{BASE_URL}/api/member/bookings",
            headers=member_headers,
            json={
                "room_id": room_id,
                "date": "2026-03-10",  # Holi
                "start_time": "10:00",
                "end_time": "11:00",
                "purpose": "Test member booking on holiday"
            }
        )
        
        assert response.status_code == 400
        error = response.json()
        assert "detail" in error
        assert "Holi" in error["detail"] or "not available" in error["detail"].lower()
        print(f"✓ Member booking rejected on Holi 2026: {error['detail']}")


class TestDeleteHoliday:
    """Test holiday deletion (run last to clean up test data)"""
    
    def test_delete_test_holiday(self, auth_headers):
        """DELETE /api/holidays/{id} - Admin can delete holiday"""
        # Find test holiday
        response = requests.get(f"{BASE_URL}/api/holidays?year=2027&active_only=false")
        holidays = response.json()
        
        test_holiday = next((h for h in holidays if "TEST_" in h.get("name", "")), None)
        
        if not test_holiday:
            pytest.skip("No test holiday found to delete")
        
        holiday_id = test_holiday["id"]
        
        response = requests.delete(
            f"{BASE_URL}/api/holidays/{holiday_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"✓ DELETE /api/holidays/{holiday_id} deleted test holiday")
    
    def test_delete_holiday_not_found(self, auth_headers):
        """DELETE /api/holidays/{id} - Should return 404 for non-existent holiday"""
        response = requests.delete(
            f"{BASE_URL}/api/holidays/non-existent-id",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✓ DELETE /api/holidays returns 404 for non-existent holiday")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
