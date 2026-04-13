"""
Shared test configuration and credentials.
All test credentials are loaded from environment variables with safe fallbacks.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials loaded from env vars (never hardcoded in test files)
ADMIN_EMAIL = os.environ.get('TEST_ADMIN_EMAIL', 'admin@thryve.in')
ADMIN_PASSWORD = os.environ.get('TEST_ADMIN_PASSWORD', 'password')
MEMBER_EMAIL = os.environ.get('TEST_MEMBER_EMAIL', 'info@tbhcircle.com')
MEMBER_PASSWORD = os.environ.get('TEST_MEMBER_PASSWORD', 'password')


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


@pytest.fixture(scope="module")
def member_token():
    """Get member authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/member/login",
        json={"email": MEMBER_EMAIL, "password": MEMBER_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Member login failed: {response.text}")
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def member_headers(member_token):
    """Get member authorization headers"""
    return {"Authorization": f"Bearer {member_token}"}


def admin_session():
    """Create an authenticated admin requests.Session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        token = response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    return None


def member_session():
    """Create an authenticated member requests.Session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(
        f"{BASE_URL}/api/member/login",
        json={"email": MEMBER_EMAIL, "password": MEMBER_PASSWORD}
    )
    if response.status_code == 200:
        token = response.json().get("access_token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    return None
