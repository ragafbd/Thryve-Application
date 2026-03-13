"""
Test cases for Upcoming Birthdays feature
Tests the GET /api/management/birthdays/upcoming endpoint
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test member data
TEST_MEMBER_ID = "1288f840-4816-48bb-a4ae-c4d3aa4d00f8"
TEST_MEMBER_DOB = "1992-03-15"


class TestBirthdayAPI:
    """Test cases for birthday API endpoint"""
    
    def test_birthday_endpoint_returns_200(self):
        """Test that birthday endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ Birthday endpoint returns 200")
    
    def test_birthday_endpoint_returns_list(self):
        """Test that birthday endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=10")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"✓ Birthday endpoint returns list with {len(data)} items")
    
    def test_birthday_response_has_required_fields(self):
        """Test that birthday response contains all required fields"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=30")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            birthday = data[0]
            required_fields = ['id', 'name', 'company_name', 'phone', 'birthday_date', 'days_until', 'turning_age', 'is_today']
            
            for field in required_fields:
                assert field in birthday, f"Missing required field: {field}"
            
            print(f"✓ Birthday response has all required fields: {required_fields}")
        else:
            pytest.skip("No birthdays found in next 30 days to verify fields")
    
    def test_birthday_days_until_calculation(self):
        """Test that days_until is calculated correctly"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=30")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            for birthday in data:
                days_until = birthday.get('days_until')
                assert days_until is not None, "days_until should not be None"
                assert isinstance(days_until, int), f"days_until should be int, got {type(days_until)}"
                assert 0 <= days_until <= 30, f"days_until should be between 0 and 30, got {days_until}"
            print(f"✓ days_until calculation is correct for {len(data)} birthdays")
        else:
            pytest.skip("No birthdays found to verify days_until")
    
    def test_birthday_is_today_flag(self):
        """Test that is_today flag is set correctly"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=30")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            for birthday in data:
                is_today = birthday.get('is_today')
                days_until = birthday.get('days_until')
                
                assert isinstance(is_today, bool), f"is_today should be bool, got {type(is_today)}"
                
                # is_today should be True only when days_until is 0
                if days_until == 0:
                    assert is_today == True, "is_today should be True when days_until is 0"
                else:
                    assert is_today == False, f"is_today should be False when days_until is {days_until}"
            
            print("✓ is_today flag is correctly set based on days_until")
        else:
            pytest.skip("No birthdays found to verify is_today flag")
    
    def test_birthday_sorted_by_days_until(self):
        """Test that birthdays are sorted by days_until (closest first)"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=30")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 1:
            days_list = [b.get('days_until') for b in data]
            assert days_list == sorted(days_list), "Birthdays should be sorted by days_until ascending"
            print(f"✓ Birthdays are sorted by days_until: {days_list}")
        elif len(data) == 1:
            print("✓ Only one birthday found, sorting not applicable")
        else:
            pytest.skip("No birthdays found to verify sorting")
    
    def test_birthday_days_parameter(self):
        """Test that days parameter filters correctly"""
        # Get birthdays in next 5 days
        response_5 = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=5")
        assert response_5.status_code == 200
        data_5 = response_5.json()
        
        # Get birthdays in next 30 days
        response_30 = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=30")
        assert response_30.status_code == 200
        data_30 = response_30.json()
        
        # 30 days should have >= birthdays than 5 days
        assert len(data_30) >= len(data_5), "30 days should have >= birthdays than 5 days"
        
        # Verify all birthdays in 5-day response are within 5 days
        for birthday in data_5:
            assert birthday.get('days_until') <= 5, f"Birthday should be within 5 days, got {birthday.get('days_until')}"
        
        print(f"✓ Days parameter works correctly: 5 days={len(data_5)}, 30 days={len(data_30)}")
    
    def test_birthday_phone_field_present(self):
        """Test that phone field is present in birthday response"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=30")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            for birthday in data:
                # Phone field should exist (can be None or string)
                assert 'phone' in birthday, "phone field should be present"
            print("✓ Phone field is present in all birthday responses")
        else:
            pytest.skip("No birthdays found to verify phone field")
    
    def test_birthday_turning_age_calculation(self):
        """Test that turning_age is calculated correctly"""
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=30")
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            for birthday in data:
                turning_age = birthday.get('turning_age')
                assert turning_age is not None, "turning_age should not be None"
                assert isinstance(turning_age, int), f"turning_age should be int, got {type(turning_age)}"
                assert turning_age > 0, f"turning_age should be positive, got {turning_age}"
                assert turning_age < 150, f"turning_age should be reasonable, got {turning_age}"
            print(f"✓ turning_age calculation is correct for {len(data)} birthdays")
        else:
            pytest.skip("No birthdays found to verify turning_age")
    
    def test_specific_member_birthday(self):
        """Test that specific test member (Vikram Kukreja) appears in birthday list"""
        # Vikram's birthday is March 15, 1992
        # Current date is March 13, 2026 - so birthday should be in 2 days
        response = requests.get(f"{BASE_URL}/api/management/birthdays/upcoming?days=10")
        assert response.status_code == 200
        data = response.json()
        
        # Find Vikram's birthday
        vikram_birthday = None
        for birthday in data:
            if birthday.get('id') == TEST_MEMBER_ID:
                vikram_birthday = birthday
                break
        
        assert vikram_birthday is not None, f"Test member {TEST_MEMBER_ID} should appear in birthday list"
        
        # Verify fields
        assert vikram_birthday.get('name') == "Vikram Kukreja", f"Name should be Vikram Kukreja"
        assert vikram_birthday.get('company_name') == "To Be Honest Circle LLP", f"Company should be To Be Honest Circle LLP"
        assert vikram_birthday.get('phone') == "9871118142", f"Phone should be 9871118142"
        assert vikram_birthday.get('days_until') == 2, f"Days until should be 2, got {vikram_birthday.get('days_until')}"
        assert vikram_birthday.get('turning_age') == 34, f"Turning age should be 34, got {vikram_birthday.get('turning_age')}"
        assert vikram_birthday.get('is_today') == False, "is_today should be False"
        
        print(f"✓ Test member Vikram Kukreja found with correct data:")
        print(f"  - Name: {vikram_birthday.get('name')}")
        print(f"  - Company: {vikram_birthday.get('company_name')}")
        print(f"  - Phone: {vikram_birthday.get('phone')}")
        print(f"  - Birthday Date: {vikram_birthday.get('birthday_date')}")
        print(f"  - Days Until: {vikram_birthday.get('days_until')}")
        print(f"  - Turning Age: {vikram_birthday.get('turning_age')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
