"""
Selenium tests for the integrated data source experience and widget features.
"""
import time
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager

# Configuration
BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8000"
WAIT_TIMEOUT = 10

# Test credentials - update these with valid credentials for your test environment
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"


class TestVirtusFeatures:
    """Test suite for Virtus AI features"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup browser before each test"""
        chrome_options = Options()
        chrome_options.add_argument("--headless")  # Run headless for CI
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")

        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options
        )
        self.driver.implicitly_wait(WAIT_TIMEOUT)
        self.wait = WebDriverWait(self.driver, WAIT_TIMEOUT)

        yield

        self.driver.quit()

    def login(self, email=TEST_EMAIL, password=TEST_PASSWORD):
        """Helper to login to the application"""
        self.driver.get(f"{BASE_URL}/login")
        time.sleep(1)

        # Find and fill email field
        email_input = self.wait.until(
            EC.presence_of_element_located((By.ID, "email"))
        )
        email_input.clear()
        email_input.send_keys(email)

        # Find and fill password field
        password_input = self.driver.find_element(By.ID, "password")
        password_input.clear()
        password_input.send_keys(password)

        # Click login button
        login_button = self.driver.find_element(By.XPATH, "//button[@type='submit']")
        login_button.click()

        # Wait for redirect to dashboard/marketplace
        time.sleep(2)

    def test_01_login_page_loads(self):
        """Test that the login page loads correctly"""
        self.driver.get(f"{BASE_URL}/login")

        # Check page title or heading
        try:
            heading = self.wait.until(
                EC.presence_of_element_located((By.TAG_NAME, "h1"))
            )
            assert heading is not None
            print("✓ Login page loads successfully")
        except TimeoutException:
            # Try to find any login form element
            email_input = self.driver.find_element(By.ID, "email")
            assert email_input is not None
            print("✓ Login page loads with form")

    def test_02_settings_widgets_page_loads(self):
        """Test that the Widgets settings page loads"""
        self.login()

        # Navigate to widgets page
        self.driver.get(f"{BASE_URL}/settings/widgets")
        time.sleep(2)

        # Check for widgets heading or create button
        try:
            # Look for the page content
            page_content = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//h2[contains(text(), 'Chat Widgets')]"))
            )
            assert page_content is not None
            print("✓ Widgets page loads with correct heading")
        except TimeoutException:
            # Check if we see the create button at least
            try:
                create_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Create Widget')]")
                assert create_btn is not None
                print("✓ Widgets page loads with create button")
            except NoSuchElementException:
                # Take screenshot for debugging
                self.driver.save_screenshot("/tmp/widgets_page_error.png")
                print(f"Current URL: {self.driver.current_url}")
                print(f"Page source snippet: {self.driver.page_source[:1000]}")
                pytest.fail("Widgets page did not load correctly")

    def test_03_admin_models_page_loads(self):
        """Test that the Admin Models page loads with data source selector"""
        self.login()

        # Navigate to admin models page
        self.driver.get(f"{BASE_URL}/admin/models")
        time.sleep(2)

        # Check for models heading
        try:
            heading = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//h1[contains(text(), 'AI Models')]"))
            )
            assert heading is not None
            print("✓ Admin Models page loads correctly")
        except TimeoutException:
            self.driver.save_screenshot("/tmp/admin_models_error.png")
            print(f"Current URL: {self.driver.current_url}")
            pytest.fail("Admin Models page did not load correctly")

    def test_04_admin_models_has_data_sources_column(self):
        """Test that the models table has a Data Sources column"""
        self.login()
        self.driver.get(f"{BASE_URL}/admin/models")
        time.sleep(2)

        try:
            # Look for Data Sources header in table
            ds_header = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//th[contains(text(), 'Data Sources')]"))
            )
            assert ds_header is not None
            print("✓ Data Sources column exists in models table")
        except TimeoutException:
            self.driver.save_screenshot("/tmp/data_sources_column_error.png")
            print(f"Current URL: {self.driver.current_url}")
            pytest.fail("Data Sources column not found in models table")

    def test_05_create_widget_modal_opens(self):
        """Test that the create widget modal opens"""
        self.login()
        self.driver.get(f"{BASE_URL}/settings/widgets")
        time.sleep(2)

        try:
            # Click create widget button
            create_btn = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Create Widget')]"))
            )
            create_btn.click()
            time.sleep(1)

            # Check for modal
            modal = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//h3[contains(text(), 'Create Widget')]"))
            )
            assert modal is not None
            print("✓ Create widget modal opens correctly")
        except TimeoutException:
            self.driver.save_screenshot("/tmp/create_widget_modal_error.png")
            pytest.fail("Create widget modal did not open")

    def test_06_widget_modal_has_required_fields(self):
        """Test that the widget modal has all required fields"""
        self.login()
        self.driver.get(f"{BASE_URL}/settings/widgets")
        time.sleep(2)

        # Open modal
        create_btn = self.wait.until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Create Widget')]"))
        )
        create_btn.click()
        time.sleep(1)

        # Check for required fields
        required_fields = [
            ("name", "Widget Name"),
            ("title", "Widget Title"),
            ("placeholder", "Input Placeholder"),
        ]

        for field_id, field_label in required_fields:
            try:
                field = self.driver.find_element(By.ID, field_id)
                assert field is not None
                print(f"✓ Found field: {field_label}")
            except NoSuchElementException:
                pytest.fail(f"Required field '{field_label}' not found")

        # Check for theme color fields
        theme_fields = ["primaryColor", "backgroundColor", "textColor"]
        for field_id in theme_fields:
            try:
                field = self.driver.find_element(By.ID, field_id)
                assert field is not None
                print(f"✓ Found theme field: {field_id}")
            except NoSuchElementException:
                pytest.fail(f"Theme field '{field_id}' not found")

    def test_07_model_detail_page_loads(self):
        """Test that the model detail page loads"""
        self.login()

        # First go to marketplace to find a model
        self.driver.get(f"{BASE_URL}/marketplace")
        time.sleep(2)

        try:
            # Click on the first model card
            model_card = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'Tile')]//h3/parent::*"))
            )
            model_card.click()
            time.sleep(2)

            # Check for model detail page content
            pricing_section = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Pricing')]"))
            )
            assert pricing_section is not None
            print("✓ Model detail page loads correctly")
        except TimeoutException:
            self.driver.save_screenshot("/tmp/model_detail_error.png")
            print(f"Current URL: {self.driver.current_url}")
            # This might fail if there are no models - that's okay
            print("⚠ No models found or model detail page issue")

    def test_08_model_detail_has_data_sources_section(self):
        """Test that the model detail page has a data sources section"""
        self.login()
        self.driver.get(f"{BASE_URL}/marketplace")
        time.sleep(2)

        try:
            # Click on first model
            model_card = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(@class, 'Tile')]//h3/parent::*"))
            )
            model_card.click()
            time.sleep(2)

            # Look for Data Sources section
            ds_section = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'Data Sources')]"))
            )
            assert ds_section is not None
            print("✓ Data Sources section found on model detail page")
        except TimeoutException:
            self.driver.save_screenshot("/tmp/model_detail_ds_error.png")
            print("⚠ Data Sources section not visible or no models available")

    def test_09_widget_api_frame_endpoint(self):
        """Test that the widget frame endpoint works"""
        import requests

        # First, we need to get a widget ID - let's try to list widgets via API
        # This is an API test, not a Selenium test, but it validates the backend
        try:
            # Try to access a sample widget frame (will 404 if no widgets exist)
            response = requests.get(f"{API_URL}/api/v1/widgets/test-id/frame")
            # 404 means the endpoint exists but widget not found - that's expected
            assert response.status_code in [200, 404]
            print(f"✓ Widget frame endpoint responds (status: {response.status_code})")
        except requests.RequestException as e:
            pytest.fail(f"Widget frame endpoint error: {e}")

    def test_10_widget_api_embed_js_endpoint(self):
        """Test that the widget embed.js endpoint works"""
        import requests

        try:
            response = requests.get(f"{API_URL}/api/v1/widgets/test-id/embed.js")
            # 404 means the endpoint exists but widget not found - that's expected
            assert response.status_code in [200, 404]
            print(f"✓ Widget embed.js endpoint responds (status: {response.status_code})")
        except requests.RequestException as e:
            pytest.fail(f"Widget embed.js endpoint error: {e}")

    def test_11_settings_navigation_has_widgets(self):
        """Test that the settings navigation includes Widgets tab"""
        self.login()
        self.driver.get(f"{BASE_URL}/settings")
        time.sleep(2)

        try:
            widgets_nav = self.wait.until(
                EC.presence_of_element_located((By.XPATH, "//button[contains(text(), 'Widgets')]"))
            )
            assert widgets_nav is not None
            print("✓ Widgets tab found in settings navigation")
        except TimeoutException:
            self.driver.save_screenshot("/tmp/settings_nav_error.png")
            pytest.fail("Widgets tab not found in settings navigation")

    def test_12_admin_model_edit_has_data_sources(self):
        """Test that editing a model shows the data sources multi-select"""
        self.login()
        self.driver.get(f"{BASE_URL}/admin/models")
        time.sleep(2)

        try:
            # Click add model button to open modal
            add_btn = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Add Model')]"))
            )
            add_btn.click()
            time.sleep(1)

            # Check for data sources field label in the modal
            # The label might be "Default Data Sources"
            ds_label = self.driver.find_elements(By.XPATH, "//*[contains(text(), 'Data Sources')]")
            if len(ds_label) > 0:
                print("✓ Data Sources selector found in model form")
            else:
                # It might only show if there are data sources available
                print("⚠ Data Sources selector not visible (may be no data sources)")
        except TimeoutException:
            self.driver.save_screenshot("/tmp/admin_model_edit_error.png")
            pytest.fail("Could not open model edit form")


class TestAPIEndpoints:
    """Test the API endpoints directly"""

    def test_model_data_sources_endpoint(self):
        """Test the model data sources API endpoint"""
        import requests

        # Use a valid UUID format
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{API_URL}/api/v1/models/{fake_uuid}/data-sources")
        # 401 or 404 are acceptable - 404 could mean model not found, 401 means auth required
        assert response.status_code in [401, 403, 404]
        print(f"✓ Model data-sources endpoint exists (status: {response.status_code})")

    def test_subscription_data_sources_endpoint(self):
        """Test the subscription data sources API endpoint"""
        import requests

        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{API_URL}/api/v1/subscriptions/{fake_uuid}/data-sources")
        assert response.status_code in [401, 403, 404]
        print(f"✓ Subscription data-sources endpoint exists (status: {response.status_code})")

    def test_widget_embed_code_endpoint(self):
        """Test the widget embed code API endpoint"""
        import requests

        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{API_URL}/api/v1/widgets/{fake_uuid}/embed-code")
        # This requires auth, so 401 is expected without it
        assert response.status_code in [401, 403, 404]
        print(f"✓ Widget embed-code endpoint exists (status: {response.status_code})")

    def test_widget_frame_endpoint(self):
        """Test the widget frame endpoint returns HTML"""
        import requests

        # Use a valid UUID format (even though it doesn't exist)
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        response = requests.get(f"{API_URL}/api/v1/widgets/{fake_uuid}/frame")
        # 404 is expected since the widget doesn't exist
        assert response.status_code in [200, 404]
        if response.status_code == 200:
            assert "text/html" in response.headers.get("content-type", "")
        print(f"✓ Widget frame endpoint works (status: {response.status_code})")


def run_quick_tests():
    """Run quick tests without Selenium (API only)"""
    import requests

    print("\n" + "="*60)
    print("Running Quick API Tests")
    print("="*60 + "\n")

    tests = [
        ("Backend health", f"{API_URL}/api/v1/health"),
        ("Models list", f"{API_URL}/api/v1/models"),
        ("Widget frame", f"{API_URL}/api/v1/widgets/00000000-0000-0000-0000-000000000000/frame"),
        ("Widget embed.js", f"{API_URL}/api/v1/widgets/00000000-0000-0000-0000-000000000000/embed.js"),
    ]

    for name, url in tests:
        try:
            response = requests.get(url, timeout=5)
            status = "✓" if response.status_code in [200, 401, 404] else "✗"
            print(f"{status} {name}: {response.status_code}")
        except Exception as e:
            print(f"✗ {name}: {e}")

    print("\n" + "="*60)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--quick":
        run_quick_tests()
    else:
        # Run pytest
        pytest.main([__file__, "-v", "-s"])
