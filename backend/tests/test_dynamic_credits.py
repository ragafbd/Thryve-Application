"""
Test Dynamic Credit Calculation from Bookings
Tests for the fix: Credits must be calculated dynamically from ALL confirmed bookings
for a company, not from cached/stored values.

Credit rates:
- Conference Room (CR): 20 credits per hour (60-min slot)
- Meeting Room (MR): 5 credits per 30-min slot

Test company: To Be Honest Circle LLP
- Total Allocated: 120 credits (4 seats × 30 credits/seat)
- Expected Credits Used: 145 (calculated from 9 bookings)
"""
import pytest
import requests
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, MEMBER_EMAIL, MEMBER_PASSWORD

# Expected values for To Be Honest Circle LLP
TBH_COMPANY_NAME = "To Be Honest Circle LLP"
TBH_TOTAL_CREDITS = 120  # 4 seats × 30 credits/seat
TBH_EXPECTED_CREDITS_USED = 145  # Calculated from 9 bookings


class TestAdminDynamicCredits:
    """Test admin endpoints return dynamically calculated credits"""
    
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
        
        # Find To Be Honest Circle LLP company
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        self.tbh_company = None
        for company in companies:
            if TBH_COMPANY_NAME in company.get("company_name", ""):
                self.tbh_company = company
                break
        
        if not self.tbh_company:
            pytest.skip(f"Company '{TBH_COMPANY_NAME}' not found")
    
    def test_companies_list_returns_dynamic_credits_used(self):
        """
        Test GET /api/companies returns dynamically calculated credits_used
        Expected: To Be Honest Circle LLP should show 145 credits used
        """
        response = self.session.get(f"{BASE_URL}/api/companies")
        assert response.status_code == 200
        
        companies = response.json()
        tbh = None
        for company in companies:
            if TBH_COMPANY_NAME in company.get("company_name", ""):
                tbh = company
                break
        
        assert tbh is not None, f"Company '{TBH_COMPANY_NAME}' not found in list"
        
        # Verify credits_used is dynamically calculated (should be 145)
        credits_used = tbh.get("credits_used", 0)
        assert credits_used == TBH_EXPECTED_CREDITS_USED, \
            f"Credits Used mismatch: expected {TBH_EXPECTED_CREDITS_USED}, got {credits_used}"
        
        # Verify total_credits
        total_credits = tbh.get("total_credits", 0)
        assert total_credits == TBH_TOTAL_CREDITS, \
            f"Total Credits mismatch: expected {TBH_TOTAL_CREDITS}, got {total_credits}"
        
        # Verify remaining_credits is calculated correctly (should be 0 since 145 > 120)
        remaining_credits = tbh.get("remaining_credits", 0)
        expected_remaining = max(0, TBH_TOTAL_CREDITS - TBH_EXPECTED_CREDITS_USED)
        assert remaining_credits == expected_remaining, \
            f"Remaining Credits mismatch: expected {expected_remaining}, got {remaining_credits}"
        
        print(f"✓ GET /api/companies - Credits Used: {credits_used} (expected: {TBH_EXPECTED_CREDITS_USED})")
    
    def test_company_details_returns_dynamic_credits_used(self):
        """
        Test GET /api/companies/{id} returns dynamically calculated credits_used
        Expected: To Be Honest Circle LLP should show 145 credits used
        """
        company_id = self.tbh_company["id"]
        response = self.session.get(f"{BASE_URL}/api/companies/{company_id}")
        
        assert response.status_code == 200
        company = response.json()
        
        # Verify credits_used is dynamically calculated (should be 145)
        credits_used = company.get("credits_used", 0)
        assert credits_used == TBH_EXPECTED_CREDITS_USED, \
            f"Credits Used mismatch: expected {TBH_EXPECTED_CREDITS_USED}, got {credits_used}"
        
        # Verify total_credits
        total_credits = company.get("total_credits", 0)
        assert total_credits == TBH_TOTAL_CREDITS, \
            f"Total Credits mismatch: expected {TBH_TOTAL_CREDITS}, got {total_credits}"
        
        # Verify remaining_credits
        remaining_credits = company.get("remaining_credits", 0)
        expected_remaining = max(0, TBH_TOTAL_CREDITS - TBH_EXPECTED_CREDITS_USED)
        assert remaining_credits == expected_remaining, \
            f"Remaining Credits mismatch: expected {expected_remaining}, got {remaining_credits}"
        
        print(f"✓ GET /api/companies/{{id}} - Credits Used: {credits_used} (expected: {TBH_EXPECTED_CREDITS_USED})")
    
    def test_company_credits_endpoint_returns_dynamic_credits(self):
        """
        Test GET /api/companies/{id}/credits returns dynamically calculated credits
        Expected: To Be Honest Circle LLP should show 145 credits used
        """
        company_id = self.tbh_company["id"]
        response = self.session.get(f"{BASE_URL}/api/companies/{company_id}/credits")
        
        assert response.status_code == 200
        credits_info = response.json()
        
        # Verify required fields
        required_fields = ["company_id", "company_name", "total_credits", "credits_used", "remaining_credits"]
        for field in required_fields:
            assert field in credits_info, f"Missing field: {field}"
        
        # Verify credits_used is dynamically calculated (should be 145)
        credits_used = credits_info.get("credits_used", 0)
        assert credits_used == TBH_EXPECTED_CREDITS_USED, \
            f"Credits Used mismatch: expected {TBH_EXPECTED_CREDITS_USED}, got {credits_used}"
        
        # Verify total_credits
        total_credits = credits_info.get("total_credits", 0)
        assert total_credits == TBH_TOTAL_CREDITS, \
            f"Total Credits mismatch: expected {TBH_TOTAL_CREDITS}, got {total_credits}"
        
        # Verify remaining_credits
        remaining_credits = credits_info.get("remaining_credits", 0)
        expected_remaining = max(0, TBH_TOTAL_CREDITS - TBH_EXPECTED_CREDITS_USED)
        assert remaining_credits == expected_remaining, \
            f"Remaining Credits mismatch: expected {expected_remaining}, got {remaining_credits}"
        
        # Verify recent_bookings are included
        assert "recent_bookings" in credits_info, "recent_bookings field missing"
        
        print(f"✓ GET /api/companies/{{id}}/credits - Credits Used: {credits_used} (expected: {TBH_EXPECTED_CREDITS_USED})")


class TestMemberDynamicCredits:
    """Test member portal endpoints return dynamically calculated credits"""
    
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
            pytest.skip(f"Member login failed: {response.text}")
        
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.member = response.json().get("member", {})
    
    def test_member_profile_returns_dynamic_credits(self):
        """
        Test GET /api/member/me returns dynamically calculated credits
        Expected: Vikram Kukreja (To Be Honest Circle LLP) should see 145 credits used
        """
        response = self.session.get(f"{BASE_URL}/api/member/me")
        
        assert response.status_code == 200
        profile = response.json()
        
        # Verify credits fields exist
        assert "credits_used" in profile, "credits_used field missing in profile"
        assert "credits_remaining" in profile, "credits_remaining field missing in profile"
        assert "meeting_room_credits" in profile, "meeting_room_credits field missing in profile"
        
        # Verify credits_used is dynamically calculated (should be 145)
        credits_used = profile.get("credits_used", 0)
        assert credits_used == TBH_EXPECTED_CREDITS_USED, \
            f"Credits Used mismatch: expected {TBH_EXPECTED_CREDITS_USED}, got {credits_used}"
        
        # Verify total credits (meeting_room_credits)
        total_credits = profile.get("meeting_room_credits", 0)
        assert total_credits == TBH_TOTAL_CREDITS, \
            f"Total Credits mismatch: expected {TBH_TOTAL_CREDITS}, got {total_credits}"
        
        # Verify remaining credits
        remaining_credits = profile.get("credits_remaining", 0)
        expected_remaining = max(0, TBH_TOTAL_CREDITS - TBH_EXPECTED_CREDITS_USED)
        assert remaining_credits == expected_remaining, \
            f"Remaining Credits mismatch: expected {expected_remaining}, got {remaining_credits}"
        
        print(f"✓ GET /api/member/me - Credits Used: {credits_used} (expected: {TBH_EXPECTED_CREDITS_USED})")
    
    def test_member_company_credits_returns_dynamic_credits(self):
        """
        Test GET /api/member/company-credits returns dynamically calculated credits
        Expected: To Be Honest Circle LLP should show 145 credits used
        """
        response = self.session.get(f"{BASE_URL}/api/member/company-credits")
        
        assert response.status_code == 200
        credits_info = response.json()
        
        # Verify required fields
        required_fields = ["company_name", "total_credits", "credits_used", "remaining_credits"]
        for field in required_fields:
            assert field in credits_info, f"Missing field: {field}"
        
        # Verify company name
        assert TBH_COMPANY_NAME in credits_info.get("company_name", ""), \
            f"Company name mismatch: expected '{TBH_COMPANY_NAME}', got '{credits_info.get('company_name')}'"
        
        # Verify credits_used is dynamically calculated (should be 145)
        credits_used = credits_info.get("credits_used", 0)
        assert credits_used == TBH_EXPECTED_CREDITS_USED, \
            f"Credits Used mismatch: expected {TBH_EXPECTED_CREDITS_USED}, got {credits_used}"
        
        # Verify total_credits
        total_credits = credits_info.get("total_credits", 0)
        assert total_credits == TBH_TOTAL_CREDITS, \
            f"Total Credits mismatch: expected {TBH_TOTAL_CREDITS}, got {total_credits}"
        
        # Verify remaining_credits
        remaining_credits = credits_info.get("remaining_credits", 0)
        expected_remaining = max(0, TBH_TOTAL_CREDITS - TBH_EXPECTED_CREDITS_USED)
        assert remaining_credits == expected_remaining, \
            f"Remaining Credits mismatch: expected {expected_remaining}, got {remaining_credits}"
        
        print(f"✓ GET /api/member/company-credits - Credits Used: {credits_used} (expected: {TBH_EXPECTED_CREDITS_USED})")


class TestCreditCalculationLogic:
    """Test the credit calculation logic based on room types"""
    
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
        
        # Find To Be Honest Circle LLP company
        companies_response = self.session.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        self.tbh_company = None
        for company in companies:
            if TBH_COMPANY_NAME in company.get("company_name", ""):
                self.tbh_company = company
                break
        
        if not self.tbh_company:
            pytest.skip(f"Company '{TBH_COMPANY_NAME}' not found")
    
    def test_credit_calculation_from_bookings(self):
        """
        Test that credits are calculated correctly from bookings:
        - Conference Room (CR): 20 credits per hour
        - Meeting Room (MR): 5 credits per 30-min slot
        
        Expected bookings for To Be Honest Circle LLP:
        - 6 × CR-1 (60 min each) = 6 × 20 = 120 credits
        - 2 × MR (30 min each) = 2 × 5 = 10 credits
        - 1 × MR (90 min) = 15 credits
        - Total = 145 credits
        """
        company_id = self.tbh_company["id"]
        response = self.session.get(f"{BASE_URL}/api/companies/{company_id}/credits")
        
        assert response.status_code == 200
        credits_info = response.json()
        
        # Get recent bookings
        recent_bookings = credits_info.get("recent_bookings", [])
        
        # Calculate expected credits from bookings
        calculated_credits = 0
        for booking in recent_bookings:
            if booking.get("status") == "cancelled":
                continue
            
            # Use credits_calculated if available, otherwise calculate
            if booking.get("credits_calculated"):
                calculated_credits += booking.get("credits_calculated", 0)
            elif booking.get("credits_required"):
                calculated_credits += booking.get("credits_required", 0)
            elif booking.get("credits_used"):
                calculated_credits += booking.get("credits_used", 0)
            else:
                # Calculate from duration and room type
                duration = booking.get("duration_minutes", 0)
                room_name = (booking.get("room_name") or "").upper()
                
                if "CR" in room_name:  # Conference Room: 20 credits per hour
                    calculated_credits += int((duration / 60) * 20)
                else:  # Meeting Room: 5 credits per 30-min slot
                    calculated_credits += int((duration / 30) * 5)
        
        # Verify the API returns the correct total
        api_credits_used = credits_info.get("credits_used", 0)
        
        print(f"✓ Credit calculation verified:")
        print(f"  - API credits_used: {api_credits_used}")
        print(f"  - Expected: {TBH_EXPECTED_CREDITS_USED}")
        print(f"  - Bookings count: {len(recent_bookings)}")
        
        assert api_credits_used == TBH_EXPECTED_CREDITS_USED, \
            f"Credits Used mismatch: expected {TBH_EXPECTED_CREDITS_USED}, got {api_credits_used}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
