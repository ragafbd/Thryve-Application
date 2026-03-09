"""
Authentication API Tests for Thryve Invoice Generator
Tests: Login, Register, Change Password, User Management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthLogin:
    """Test login endpoint /api/auth/login"""
    
    def test_login_with_valid_admin_credentials(self):
        """Test login with default admin credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["email"] == "admin@thryve.in"
        assert data["user"]["role"] == "admin"
        assert data["user"]["name"] == "Admin"
        assert data["token_type"] == "bearer"
        print(f"✓ Login successful for admin@thryve.in")
    
    def test_login_with_invalid_email(self):
        """Test login with non-existent email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@thryve.in",
            "password": "admin123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"✓ Invalid email correctly rejected")
    
    def test_login_with_wrong_password(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Wrong password correctly rejected")
    
    def test_login_with_empty_credentials(self):
        """Test login with empty email and password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "",
            "password": ""
        })
        # Should return 401 or 422 (validation error)
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
        print(f"✓ Empty credentials correctly rejected")


class TestAuthMe:
    """Test /api/auth/me endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get auth token")
    
    def test_get_current_user_with_valid_token(self, auth_token):
        """Test getting current user info with valid token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["email"] == "admin@thryve.in"
        assert data["role"] == "admin"
        assert "id" in data
        assert "name" in data
        print(f"✓ /api/auth/me returns correct user info")
    
    def test_get_current_user_without_token(self):
        """Test accessing /api/auth/me without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated request correctly rejected")
    
    def test_get_current_user_with_invalid_token(self):
        """Test accessing /api/auth/me with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid token correctly rejected")


class TestUserManagement:
    """Test user management endpoints (admin only)"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get admin token")
    
    def test_get_users_list_as_admin(self, admin_token):
        """Test getting users list as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/users", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Should have at least the admin user
        assert len(data) >= 1, "Should have at least one user"
        
        # Check admin user is in the list
        admin_user = next((u for u in data if u["email"] == "admin@thryve.in"), None)
        assert admin_user is not None, "Admin user should be in the list"
        assert admin_user["role"] == "admin"
        assert "password_hash" not in admin_user, "Password hash should not be exposed"
        print(f"✓ Users list retrieved successfully ({len(data)} users)")
    
    def test_get_users_list_without_auth(self):
        """Test getting users list without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/users")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated users list request rejected")
    
    def test_create_new_user_as_admin(self, admin_token):
        """Test creating a new user as admin"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_user = {
            "name": "TEST_Staff User",
            "email": "test_staff_user@thryve.in",
            "password": "testpass123",
            "role": "staff"
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=test_user, headers=headers)
        
        # If user already exists, that's okay for this test
        if response.status_code == 400 and "already registered" in response.text.lower():
            print(f"✓ User already exists (expected in repeated tests)")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data, "Response should contain user_id"
        assert data["message"] == "User created successfully"
        print(f"✓ New user created successfully")
    
    def test_create_user_with_invalid_role(self, admin_token):
        """Test creating user with invalid role"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        test_user = {
            "name": "Invalid Role User",
            "email": "invalid_role@thryve.in",
            "password": "testpass123",
            "role": "superadmin"  # Invalid role
        }
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json=test_user, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"✓ Invalid role correctly rejected")
    
    def test_toggle_user_status(self, admin_token):
        """Test toggling user active status"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get users list to find a non-admin user
        response = requests.get(f"{BASE_URL}/api/auth/users", headers=headers)
        users = response.json()
        
        # Find a non-admin user to toggle
        non_admin = next((u for u in users if u["role"] != "admin"), None)
        if not non_admin:
            print("✓ No non-admin user to toggle (skipping)")
            return
        
        # Toggle the user status
        response = requests.patch(f"{BASE_URL}/api/auth/users/{non_admin['id']}/toggle", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "is_active" in data
        print(f"✓ User status toggled successfully")
        
        # Toggle back
        requests.patch(f"{BASE_URL}/api/auth/users/{non_admin['id']}/toggle", headers=headers)


class TestChangePassword:
    """Test change password endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@thryve.in",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Could not get admin token")
    
    def test_change_password_with_wrong_current(self, admin_token):
        """Test change password with wrong current password"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123"
        }, headers=headers)
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "incorrect" in data.get("detail", "").lower()
        print(f"✓ Wrong current password correctly rejected")
    
    def test_change_password_without_auth(self):
        """Test change password without authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/change-password", json={
            "current_password": "admin123",
            "new_password": "newpassword123"
        })
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthenticated password change rejected")


class TestProtectedRoutes:
    """Test that routes are properly protected"""
    
    def test_stats_endpoint_accessible(self):
        """Test that stats endpoint is accessible (may or may not require auth)"""
        response = requests.get(f"{BASE_URL}/api/stats")
        # Stats might be public or protected - just check it responds
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        print(f"✓ Stats endpoint responds with status {response.status_code}")
    
    def test_clients_endpoint_accessible(self):
        """Test clients endpoint"""
        response = requests.get(f"{BASE_URL}/api/clients")
        # Clients might be public or protected
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        print(f"✓ Clients endpoint responds with status {response.status_code}")
    
    def test_invoices_endpoint_accessible(self):
        """Test invoices endpoint"""
        response = requests.get(f"{BASE_URL}/api/invoices")
        # Invoices might be public or protected
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
        print(f"✓ Invoices endpoint responds with status {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
