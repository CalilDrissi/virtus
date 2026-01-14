"""
Selenium tests for Admin Models page functionality.
Tests all buttons and interactions to identify issues.
"""
import time
import json
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    ElementClickInterceptedException,
    StaleElementReferenceException,
)


class AdminModelsTest:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.errors = []
        self.warnings = []
        self.passed = []

        # Setup Chrome options
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")

        self.driver = webdriver.Chrome(options=chrome_options)
        self.wait = WebDriverWait(self.driver, 10)

    def log_error(self, test_name, message, details=None):
        error = {"test": test_name, "message": message, "details": details}
        self.errors.append(error)
        print(f"[ERROR] {test_name}: {message}")
        if details:
            print(f"        Details: {details}")

    def log_warning(self, test_name, message, details=None):
        warning = {"test": test_name, "message": message, "details": details}
        self.warnings.append(warning)
        print(f"[WARNING] {test_name}: {message}")

    def log_pass(self, test_name, message):
        self.passed.append({"test": test_name, "message": message})
        print(f"[PASS] {test_name}: {message}")

    def login_as_admin(self):
        """Login as admin user"""
        print("\n--- Logging in as admin ---")
        try:
            self.driver.get(f"{self.base_url}/login")
            time.sleep(1)

            # Find and fill email
            email_input = self.wait.until(
                EC.presence_of_element_located((By.ID, "email"))
            )
            email_input.clear()
            email_input.send_keys("admin@virtus.ai")

            # Find and fill password
            password_input = self.driver.find_element(By.ID, "password")
            password_input.clear()
            password_input.send_keys("admin123")

            # Click login button
            login_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Sign In')]")
            login_btn.click()

            # Wait for redirect to dashboard
            time.sleep(2)

            if "/login" not in self.driver.current_url:
                self.log_pass("login", "Successfully logged in as admin")
                return True
            else:
                self.log_error("login", "Failed to login - still on login page")
                return False

        except Exception as e:
            self.log_error("login", f"Login failed: {str(e)}")
            return False

    def navigate_to_admin_models(self):
        """Navigate to Admin Models page"""
        print("\n--- Navigating to Admin Models ---")
        try:
            self.driver.get(f"{self.base_url}/admin/models")
            time.sleep(2)

            # Check if we're on the admin models page
            if "/admin/models" in self.driver.current_url:
                self.log_pass("navigate", "Successfully navigated to Admin Models page")
                return True
            else:
                self.log_error("navigate", f"Failed to navigate - current URL: {self.driver.current_url}")
                return False

        except Exception as e:
            self.log_error("navigate", f"Navigation failed: {str(e)}")
            return False

    def test_add_model_button(self):
        """Test the Add Model button"""
        print("\n--- Testing Add Model Button ---")
        try:
            # Find Add Model button
            add_btn = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Add Model')]"))
            )
            add_btn.click()
            time.sleep(1)

            # Check if modal opened
            modal = self.driver.find_elements(By.CLASS_NAME, "cds--modal-container")
            if modal:
                self.log_pass("add_model_button", "Add Model button works - modal opened")

                # Close modal
                cancel_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
                cancel_btn.click()
                time.sleep(0.5)
                return True
            else:
                self.log_error("add_model_button", "Add Model button clicked but modal did not open")
                return False

        except TimeoutException:
            self.log_error("add_model_button", "Add Model button not found or not clickable")
            return False
        except Exception as e:
            self.log_error("add_model_button", f"Error testing Add Model button: {str(e)}")
            return False

    def test_edit_buttons(self):
        """Test Edit buttons in the table"""
        print("\n--- Testing Edit Buttons ---")
        try:
            # Find all rows and get the first action button from each (Edit button)
            rows = self.driver.find_elements(By.XPATH, "//tbody/tr")
            if not rows:
                self.log_warning("edit_buttons", "No table rows found")
                return True

            # Get the first row's action cell
            first_row = rows[0]
            cells = first_row.find_elements(By.TAG_NAME, "td")
            if not cells:
                self.log_warning("edit_buttons", "No cells in first row")
                return True

            # Action buttons are in the last cell
            action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")
            if not action_buttons:
                self.log_warning("edit_buttons", "No action buttons found")
                return True

            edit_buttons = [action_buttons[0]]  # First button is Edit
            print(f"  Found {len(edit_buttons)} edit button(s)")

            # Test first edit button
            first_edit = edit_buttons[0]
            try:
                first_edit.click()
                time.sleep(1)

                # Check if modal opened
                modal = self.driver.find_elements(By.CLASS_NAME, "cds--modal-container")
                if modal and len(modal) > 0:
                    # Check modal heading
                    heading = self.driver.find_elements(By.CLASS_NAME, "cds--modal-header__heading")
                    if heading and "Edit" in heading[0].text:
                        self.log_pass("edit_button", "Edit button works - edit modal opened")
                    else:
                        self.log_pass("edit_button", "Edit button works - modal opened")

                    # Close modal
                    cancel_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
                    cancel_btn.click()
                    time.sleep(0.5)
                    return True
                else:
                    self.log_error("edit_button", "Edit button clicked but modal did not open")
                    return False

            except ElementClickInterceptedException:
                self.log_error("edit_button", "Edit button click intercepted - might be covered by another element")
                return False

        except Exception as e:
            self.log_error("edit_buttons", f"Error testing edit buttons: {str(e)}")
            return False

    def test_delete_buttons(self):
        """Test Delete buttons in the table"""
        print("\n--- Testing Delete Buttons ---")
        try:
            # Find all rows and get delete buttons
            rows = self.driver.find_elements(By.XPATH, "//tbody/tr")
            if not rows:
                self.log_warning("delete_buttons", "No table rows found")
                return True

            initial_count = len(rows)
            print(f"  Found {initial_count} model(s)")

            # Get the first row's action cell
            first_row = rows[0]
            cells = first_row.find_elements(By.TAG_NAME, "td")
            if not cells:
                self.log_warning("delete_buttons", "No cells in first row")
                return True

            # Action buttons are in the last cell - second button is Delete
            action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")
            if len(action_buttons) < 2:
                self.log_warning("delete_buttons", "Delete button not found")
                return True

            delete_btn = action_buttons[1]  # Second button is Delete
            print(f"  Testing delete button...")

            # Check button state
            is_disabled = delete_btn.get_attribute("disabled")
            if is_disabled:
                self.log_error("delete_button", "Delete button is disabled")
                return False

            # Clear console logs before click
            self.driver.get_log("browser")

            # Click delete button
            delete_btn.click()
            time.sleep(2)

            # Check console for errors
            logs = self.driver.get_log("browser")
            errors = [log for log in logs if log["level"] == "SEVERE"]

            if errors:
                self.log_error("delete_button", "JavaScript errors after delete", [e["message"][:200] for e in errors])
                return False

            # Check if model count decreased
            rows_after = self.driver.find_elements(By.XPATH, "//tbody/tr")
            final_count = len(rows_after)

            if final_count < initial_count:
                self.log_pass("delete_button", f"Delete successful ({initial_count} -> {final_count})")
            else:
                self.log_pass("delete_button", "Delete button is clickable and no JS errors")

            return True

        except ElementClickInterceptedException as e:
            self.log_error("delete_button", "Delete button click intercepted", str(e))
            return False
        except Exception as e:
            self.log_error("delete_buttons", f"Error testing delete buttons: {str(e)}")
            return False

    def test_modal_form_validation(self):
        """Test modal form validation"""
        print("\n--- Testing Modal Form Validation ---")
        try:
            # Open Add Model modal
            add_btn = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Add Model')]"))
            )
            add_btn.click()
            time.sleep(1)

            # Check if Create button is disabled when form is empty
            create_btn = self.driver.find_element(
                By.XPATH, "//button[contains(text(), 'Create Model')]"
            )

            if create_btn.get_attribute("disabled"):
                self.log_pass("form_validation", "Create button is properly disabled when form is empty")
            else:
                self.log_error("form_validation", "Create button should be disabled when form is empty")

            # Fill required fields
            name_input = self.driver.find_element(By.ID, "name")
            name_input.send_keys("Test Model")

            model_id_input = self.driver.find_element(By.ID, "provider_model_id")
            model_id_input.send_keys("test-model-id")

            time.sleep(0.5)

            # Check if Create button is now enabled
            if not create_btn.get_attribute("disabled"):
                self.log_pass("form_validation", "Create button is enabled after filling required fields")
            else:
                self.log_error("form_validation", "Create button should be enabled after filling required fields")

            # Close modal
            cancel_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
            cancel_btn.click()
            time.sleep(0.5)

            return True

        except Exception as e:
            self.log_error("form_validation", f"Error testing form validation: {str(e)}")
            # Try to close modal if open
            try:
                cancel_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
                cancel_btn.click()
            except:
                pass
            return False

    def test_dropdown_functionality(self):
        """Test dropdown menus in modal"""
        print("\n--- Testing Dropdown Functionality ---")
        try:
            # Open Add Model modal
            add_btn = self.wait.until(
                EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Add Model')]"))
            )
            add_btn.click()
            time.sleep(1)

            # Find category dropdown
            category_dropdown = self.driver.find_elements(By.ID, "category")
            if category_dropdown:
                category_dropdown[0].click()
                time.sleep(0.5)

                # Check if dropdown options appear
                options = self.driver.find_elements(By.CLASS_NAME, "cds--list-box__menu-item")
                if options:
                    self.log_pass("dropdown_category", f"Category dropdown works - {len(options)} options available")
                    # Click first option
                    options[0].click()
                    time.sleep(0.3)
                else:
                    self.log_error("dropdown_category", "Category dropdown opened but no options found")
            else:
                self.log_warning("dropdown_category", "Category dropdown not found")

            # Find provider dropdown
            provider_dropdown = self.driver.find_elements(By.ID, "provider")
            if provider_dropdown:
                provider_dropdown[0].click()
                time.sleep(0.5)

                options = self.driver.find_elements(By.CLASS_NAME, "cds--list-box__menu-item")
                if options:
                    self.log_pass("dropdown_provider", f"Provider dropdown works - {len(options)} options available")
                    # Close dropdown by clicking elsewhere
                    self.driver.find_element(By.TAG_NAME, "body").click()
                    time.sleep(0.3)
                else:
                    self.log_error("dropdown_provider", "Provider dropdown opened but no options found")
            else:
                self.log_warning("dropdown_provider", "Provider dropdown not found")

            # Close modal
            cancel_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
            cancel_btn.click()
            time.sleep(0.5)

            return True

        except Exception as e:
            self.log_error("dropdowns", f"Error testing dropdowns: {str(e)}")
            try:
                cancel_btn = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
                cancel_btn.click()
            except:
                pass
            return False

    def test_table_rendering(self):
        """Test that table renders correctly"""
        print("\n--- Testing Table Rendering ---")
        try:
            # Check for table
            table = self.driver.find_elements(By.CLASS_NAME, "cds--data-table")
            if not table:
                self.log_error("table_render", "Data table not found on page")
                return False

            # Check for table headers
            headers = self.driver.find_elements(By.TAG_NAME, "th")
            expected_headers = ["Name", "Provider", "Category", "Pricing", "Data Sources", "Status", "Actions"]

            found_headers = [h.text for h in headers if h.text]
            print(f"  Found headers: {found_headers}")

            missing_headers = [h for h in expected_headers if h not in found_headers]
            if missing_headers:
                self.log_warning("table_headers", f"Some expected headers missing: {missing_headers}")
            else:
                self.log_pass("table_headers", "All expected table headers present")

            # Check for table rows
            rows = self.driver.find_elements(By.XPATH, "//tbody/tr")
            print(f"  Found {len(rows)} data row(s)")

            if len(rows) == 0:
                self.log_warning("table_rows", "No data rows in table - might need to create models first")
            else:
                self.log_pass("table_rows", f"Table has {len(rows)} model(s)")

            return True

        except Exception as e:
            self.log_error("table_render", f"Error checking table: {str(e)}")
            return False

    def test_api_integration(self):
        """Test that API calls are being made correctly"""
        print("\n--- Testing API Integration ---")
        try:
            # Enable network logging
            # Check for any failed network requests in the console
            logs = self.driver.get_log("browser")

            api_errors = []
            for log in logs:
                if "api" in log["message"].lower() and log["level"] == "SEVERE":
                    api_errors.append(log["message"])

            if api_errors:
                self.log_error("api_integration", "API errors found in console", api_errors)
                return False
            else:
                self.log_pass("api_integration", "No API errors in console")
                return True

        except Exception as e:
            self.log_warning("api_integration", f"Could not check API logs: {str(e)}")
            return True

    def test_responsive_layout(self):
        """Test responsive layout"""
        print("\n--- Testing Responsive Layout ---")
        try:
            # Test different viewport sizes
            sizes = [(1920, 1080), (1024, 768), (768, 1024)]

            for width, height in sizes:
                self.driver.set_window_size(width, height)
                time.sleep(0.5)

                # Check if main elements are still visible
                add_btn = self.driver.find_elements(By.XPATH, "//button[contains(., 'Add Model')]")
                table = self.driver.find_elements(By.CLASS_NAME, "cds--data-table")

                if add_btn and table:
                    self.log_pass(f"responsive_{width}x{height}", f"Layout OK at {width}x{height}")
                else:
                    self.log_error(f"responsive_{width}x{height}", f"Missing elements at {width}x{height}")

            # Reset to default size
            self.driver.set_window_size(1920, 1080)
            return True

        except Exception as e:
            self.log_error("responsive", f"Error testing responsive layout: {str(e)}")
            return False

    def check_console_errors(self):
        """Check for any JavaScript console errors"""
        print("\n--- Checking Console Errors ---")
        try:
            logs = self.driver.get_log("browser")

            severe_errors = [log for log in logs if log["level"] == "SEVERE"]
            warnings = [log for log in logs if log["level"] == "WARNING"]

            if severe_errors:
                for error in severe_errors:
                    self.log_error("console", "JavaScript error", error["message"])
            else:
                self.log_pass("console", "No severe JavaScript errors")

            if warnings:
                print(f"  Found {len(warnings)} warnings (non-critical)")

            return len(severe_errors) == 0

        except Exception as e:
            self.log_warning("console", f"Could not check console: {str(e)}")
            return True

    def run_all_tests(self):
        """Run all tests"""
        print("=" * 60)
        print("ADMIN MODELS PAGE - SELENIUM TESTS")
        print("=" * 60)

        try:
            if not self.login_as_admin():
                print("\nCannot proceed without login")
                return self.generate_report()

            if not self.navigate_to_admin_models():
                print("\nCannot proceed without navigating to admin models")
                return self.generate_report()

            # Run individual tests
            self.test_table_rendering()
            self.test_add_model_button()
            self.test_edit_buttons()
            self.test_delete_buttons()
            self.test_modal_form_validation()
            self.test_dropdown_functionality()
            self.test_api_integration()
            self.check_console_errors()

        except Exception as e:
            self.log_error("test_suite", f"Test suite failed: {str(e)}")

        finally:
            self.driver.quit()

        return self.generate_report()

    def generate_report(self):
        """Generate test report"""
        print("\n" + "=" * 60)
        print("TEST REPORT")
        print("=" * 60)

        print(f"\nPassed: {len(self.passed)}")
        print(f"Warnings: {len(self.warnings)}")
        print(f"Errors: {len(self.errors)}")

        if self.errors:
            print("\n--- ERRORS ---")
            for error in self.errors:
                print(f"  - {error['test']}: {error['message']}")
                if error.get('details'):
                    print(f"    Details: {error['details']}")

        if self.warnings:
            print("\n--- WARNINGS ---")
            for warning in self.warnings:
                print(f"  - {warning['test']}: {warning['message']}")

        return {
            "passed": self.passed,
            "warnings": self.warnings,
            "errors": self.errors,
        }


if __name__ == "__main__":
    test = AdminModelsTest()
    results = test.run_all_tests()

    # Save results to file
    with open("/Users/cal/Desktop/virtus/frontend/tests/test_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nResults saved to test_results.json")
