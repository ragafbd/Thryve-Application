"""
Test Primary Member Validation for Company Member Management
Tests:
1. POST /api/companies/{id}/members returns 409 when trying to add second primary member
2. POST /api/companies/{id}/members with replace_primary=true replaces existing primary
3. PUT /api/companies/{id}/members/{member_id} returns 409 when setting is_primary_contact=true with existing primary
4. PUT /api/companies/{id}/members/{member_id} with replace_primary=true replaces existing primary
"""
import pytest
import requests
from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
import uuid


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session

@pytest.fixture(scope="module")
def test_company_id():
    """Company ID for 'To Be Honest Circle LLP' which has existing primary member"""
    return "84b0ae6a-d0fb-4139-9cfe-4c5e68f8cabd"

@pytest.fixture(scope="module")
def existing_primary_member_id():
    """Existing primary member ID (Vikram Kukreja)"""
    return "1288f840-4816-48bb-a4ae-c4d3aa4d00f8"


class TestAddMemberPrimaryValidation:
    """Test POST /api/companies/{id}/members primary contact validation"""
    
    def test_add_member_with_primary_returns_409_when_primary_exists(self, api_client, test_company_id):
        """Test: Adding a member with is_primary_contact=true when primary exists returns 409"""
        unique_email = f"TEST_primary_conflict_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/companies/{test_company_id}/members", json={
            "name": "TEST Primary Conflict Member",
            "email": unique_email,
            "phone": "9876543210",
            "is_primary_contact": True
        })
        
        # Should return 409 Conflict
        assert response.status_code == 409, f"Expected 409, got {response.status_code}: {response.text}"
        
        # Verify response contains existing primary info
        data = response.json()
        assert "detail" in data
        detail = data["detail"]
        assert "message" in detail
        assert "existing_primary" in detail
        assert "options" in detail
        
        # Verify existing primary info
        existing_primary = detail["existing_primary"]
        assert "id" in existing_primary
        assert "name" in existing_primary
        assert "email" in existing_primary
        assert existing_primary["name"] == "Vikram Kukreja"
        
        # Verify options
        assert "skip" in detail["options"]
        assert "replace" in detail["options"]
        
        print(f"✓ 409 returned with existing primary: {existing_primary['name']}")
    
    def test_add_member_with_replace_primary_true_replaces_existing(self, api_client, test_company_id, existing_primary_member_id):
        """Test: Adding a member with replace_primary=true replaces existing primary"""
        unique_email = f"TEST_replace_primary_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/companies/{test_company_id}/members", json={
            "name": "TEST New Primary Member",
            "email": unique_email,
            "phone": "9876543211",
            "is_primary_contact": True,
            "replace_primary": True
        })
        
        # Should succeed
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        new_member = response.json()
        assert new_member["is_primary_contact"] == True
        assert new_member["name"] == "TEST New Primary Member"
        new_member_id = new_member["id"]
        
        # Verify old primary is no longer primary
        old_primary_response = api_client.get(f"{BASE_URL}/api/companies/{test_company_id}")
        assert old_primary_response.status_code == 200
        company_data = old_primary_response.json()
        
        old_primary = next((m for m in company_data["members"] if m["id"] == existing_primary_member_id), None)
        assert old_primary is not None, "Old primary member not found"
        assert old_primary["is_primary_contact"] == False, "Old primary should no longer be primary"
        
        print(f"✓ New primary created: {new_member['name']}, old primary demoted")
        
        # Cleanup: Restore original primary and delete test member
        # First, set old member back to primary
        api_client.put(f"{BASE_URL}/api/companies/{test_company_id}/members/{existing_primary_member_id}", json={
            "is_primary_contact": True,
            "replace_primary": True
        })
        
        # Delete test member
        api_client.delete(f"{BASE_URL}/api/companies/{test_company_id}/members/{new_member_id}")
        print("✓ Cleanup completed: restored original primary")
    
    def test_add_member_without_primary_succeeds(self, api_client, test_company_id):
        """Test: Adding a member without is_primary_contact succeeds normally"""
        unique_email = f"TEST_regular_member_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/companies/{test_company_id}/members", json={
            "name": "TEST Regular Member",
            "email": unique_email,
            "phone": "9876543212",
            "is_primary_contact": False
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        member = response.json()
        assert member["is_primary_contact"] == False
        assert member["name"] == "TEST Regular Member"
        
        print(f"✓ Regular member added successfully: {member['name']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/companies/{test_company_id}/members/{member['id']}")
        print("✓ Cleanup completed")


class TestUpdateMemberPrimaryValidation:
    """Test PUT /api/companies/{id}/members/{member_id} primary contact validation"""
    
    def test_update_member_to_primary_returns_409_when_primary_exists(self, api_client, test_company_id):
        """Test: Updating a member to is_primary_contact=true when primary exists returns 409"""
        # First create a regular member
        unique_email = f"TEST_update_conflict_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = api_client.post(f"{BASE_URL}/api/companies/{test_company_id}/members", json={
            "name": "TEST Update Conflict Member",
            "email": unique_email,
            "phone": "9876543213",
            "is_primary_contact": False
        })
        assert create_response.status_code == 200
        member = create_response.json()
        member_id = member["id"]
        
        # Try to update to primary
        update_response = api_client.put(f"{BASE_URL}/api/companies/{test_company_id}/members/{member_id}", json={
            "is_primary_contact": True
        })
        
        # Should return 409 Conflict
        assert update_response.status_code == 409, f"Expected 409, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        assert "detail" in data
        detail = data["detail"]
        assert "existing_primary" in detail
        assert detail["existing_primary"]["name"] == "Vikram Kukreja"
        
        print(f"✓ 409 returned when updating to primary with existing primary")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/companies/{test_company_id}/members/{member_id}")
        print("✓ Cleanup completed")
    
    def test_update_member_to_primary_with_replace_true_replaces_existing(self, api_client, test_company_id, existing_primary_member_id):
        """Test: Updating a member with replace_primary=true replaces existing primary"""
        # First create a regular member
        unique_email = f"TEST_update_replace_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = api_client.post(f"{BASE_URL}/api/companies/{test_company_id}/members", json={
            "name": "TEST Update Replace Member",
            "email": unique_email,
            "phone": "9876543214",
            "is_primary_contact": False
        })
        assert create_response.status_code == 200
        member = create_response.json()
        member_id = member["id"]
        
        # Update to primary with replace_primary=true
        update_response = api_client.put(f"{BASE_URL}/api/companies/{test_company_id}/members/{member_id}", json={
            "is_primary_contact": True,
            "replace_primary": True
        })
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        updated_member = update_response.json()
        assert updated_member["is_primary_contact"] == True
        
        # Verify old primary is no longer primary
        company_response = api_client.get(f"{BASE_URL}/api/companies/{test_company_id}")
        company_data = company_response.json()
        
        old_primary = next((m for m in company_data["members"] if m["id"] == existing_primary_member_id), None)
        assert old_primary is not None
        assert old_primary["is_primary_contact"] == False, "Old primary should be demoted"
        
        print(f"✓ Member updated to primary, old primary demoted")
        
        # Cleanup: Restore original primary and delete test member
        api_client.put(f"{BASE_URL}/api/companies/{test_company_id}/members/{existing_primary_member_id}", json={
            "is_primary_contact": True,
            "replace_primary": True
        })
        api_client.delete(f"{BASE_URL}/api/companies/{test_company_id}/members/{member_id}")
        print("✓ Cleanup completed: restored original primary")
    
    def test_update_existing_primary_member_keeps_primary(self, api_client, test_company_id, existing_primary_member_id):
        """Test: Updating the existing primary member (other fields) keeps them as primary"""
        # Update other fields of existing primary
        update_response = api_client.put(f"{BASE_URL}/api/companies/{test_company_id}/members/{existing_primary_member_id}", json={
            "notes": "TEST Updated notes"
        })
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        updated = update_response.json()
        assert updated["is_primary_contact"] == True, "Primary status should remain"
        assert updated["notes"] == "TEST Updated notes"
        
        print(f"✓ Existing primary member updated without losing primary status")
        
        # Cleanup: Reset notes
        api_client.put(f"{BASE_URL}/api/companies/{test_company_id}/members/{existing_primary_member_id}", json={
            "notes": ""
        })


class TestEdgeCases:
    """Test edge cases for primary member validation"""
    
    def test_409_response_structure(self, api_client, test_company_id):
        """Test: 409 response has correct structure with all required fields"""
        unique_email = f"TEST_structure_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/companies/{test_company_id}/members", json={
            "name": "TEST Structure Check",
            "email": unique_email,
            "phone": "9876543215",
            "is_primary_contact": True
        })
        
        assert response.status_code == 409
        
        data = response.json()
        detail = data["detail"]
        
        # Verify all required fields
        assert "message" in detail, "Missing 'message' field"
        assert "existing_primary" in detail, "Missing 'existing_primary' field"
        assert "options" in detail, "Missing 'options' field"
        
        # Verify existing_primary structure
        existing = detail["existing_primary"]
        assert "id" in existing, "Missing 'id' in existing_primary"
        assert "name" in existing, "Missing 'name' in existing_primary"
        assert "email" in existing, "Missing 'email' in existing_primary"
        
        # Verify options
        assert isinstance(detail["options"], list), "Options should be a list"
        assert len(detail["options"]) == 2, "Should have 2 options"
        
        print(f"✓ 409 response structure verified")
    
    def test_add_primary_to_company_without_primary(self, api_client):
        """Test: Adding primary member to company without existing primary succeeds"""
        # Find a company without primary or create test scenario
        # For this test, we'll use a different company or skip if not available
        
        # Get all companies
        companies_response = api_client.get(f"{BASE_URL}/api/companies")
        assert companies_response.status_code == 200
        companies = companies_response.json()
        
        # Find a company with no primary member
        test_company = None
        for company in companies:
            company_detail = api_client.get(f"{BASE_URL}/api/companies/{company['id']}").json()
            members = company_detail.get("members", [])
            has_primary = any(m.get("is_primary_contact") for m in members)
            if not has_primary and company["status"] == "active":
                test_company = company
                break
        
        if test_company is None:
            pytest.skip("No company without primary member found for testing")
        
        unique_email = f"TEST_first_primary_{uuid.uuid4().hex[:8]}@test.com"
        
        response = api_client.post(f"{BASE_URL}/api/companies/{test_company['id']}/members", json={
            "name": "TEST First Primary",
            "email": unique_email,
            "phone": "9876543216",
            "is_primary_contact": True
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        member = response.json()
        assert member["is_primary_contact"] == True
        
        print(f"✓ First primary member added to company: {test_company['company_name']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/companies/{test_company['id']}/members/{member['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
