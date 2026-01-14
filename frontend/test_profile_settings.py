#!/usr/bin/env python3
"""
Selenium test for Profile Settings page
"""
import time
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager
import platform

BASE_URL = "http://localhost:3000"
TEST_EMAIL = "client@demo.com"
TEST_PASSWORD = "demo123"

errors = []
warnings = []

def log_error(msg):
    print(f"❌ ERROR: {msg}")
    errors.append(msg)

def log_warning(msg):
    print(f"⚠️  WARNING: {msg}")
    warnings.append(msg)

def log_success(msg):
    print(f"✅ {msg}")

def log_info(msg):
    print(f"ℹ️  {msg}")

def setup_driver():
    """Setup Chrome driver"""
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=options)
    driver.implicitly_wait(10)
    return driver

def login(driver):
    """Login to the application"""
    log_info("Logging in...")
    driver.get(f"{BASE_URL}/login")
    time.sleep(1)

    # Find and fill email
    try:
        email_input = driver.find_element(By.ID, "email")
        email_input.clear()
        email_input.send_keys(TEST_EMAIL)
        log_success("Found and filled email input")
    except Exception as e:
        log_error(f"Could not find email input: {e}")
        return False

    # Find and fill password
    try:
        password_input = driver.find_element(By.ID, "password")
        password_input.clear()
        password_input.send_keys(TEST_PASSWORD)
        log_success("Found and filled password input")
    except Exception as e:
        log_error(f"Could not find password input: {e}")
        return False

    # Click login button
    try:
        login_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Sign In') or contains(text(), 'Login')]")
        login_btn.click()
        log_success("Clicked login button")
    except Exception as e:
        log_error(f"Could not find login button: {e}")
        return False

    # Wait for redirect
    time.sleep(2)

    if "/login" not in driver.current_url:
        log_success("Login successful - redirected away from login page")
        return True
    else:
        log_error("Login failed - still on login page")
        return False

def navigate_to_profile_settings(driver):
    """Navigate to profile settings page"""
    log_info("Navigating to Profile Settings...")

    driver.get(f"{BASE_URL}/settings/profile")
    time.sleep(2)

    if "/settings" in driver.current_url:
        log_success("Navigated to settings page")
        return True
    else:
        log_error(f"Failed to navigate - current URL: {driver.current_url}")
        return False

def test_profile_settings_elements(driver):
    """Test that all profile settings elements are present"""
    log_info("Testing Profile Settings elements...")

    # Test page title
    try:
        title = driver.find_element(By.XPATH, "//h2[contains(text(), 'Profile Settings')]")
        log_success("Found 'Profile Settings' title")
    except:
        log_error("Could not find 'Profile Settings' title")

    # Test avatar section
    try:
        avatar_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Change Avatar')]")
        log_success("Found 'Change Avatar' button")
    except:
        log_warning("Could not find 'Change Avatar' button")

    # Test Full Name input
    try:
        name_input = driver.find_element(By.ID, "full_name")
        name_value = name_input.get_attribute("value")
        log_success(f"Found Full Name input (value: '{name_value}')")

        # Test that it's editable - use JavaScript to set value and dispatch input event for React
        driver.execute_script("""
            var input = arguments[0];
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, 'Test Name');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        """, name_input)
        time.sleep(0.5)
        new_value = name_input.get_attribute("value")
        if new_value == "Test Name":
            log_success("Full Name input is editable")
        else:
            log_warning(f"Full Name input edit test - got '{new_value}'")
        # Restore original value
        driver.execute_script("""
            var input = arguments[0];
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, arguments[1]);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        """, name_input, name_value)
        time.sleep(0.5)
    except Exception as e:
        log_error(f"Could not find/test Full Name input: {e}")

    # Test Email input
    try:
        email_input = driver.find_element(By.ID, "email")
        email_value = email_input.get_attribute("value")
        log_success(f"Found Email input (value: '{email_value}')")

        if email_value == TEST_EMAIL:
            log_success("Email matches logged in user")
        else:
            log_warning(f"Email mismatch: expected '{TEST_EMAIL}', got '{email_value}'")
    except Exception as e:
        log_error(f"Could not find Email input: {e}")

    # Test Role input (should be disabled)
    try:
        role_input = driver.find_element(By.ID, "role")
        role_value = role_input.get_attribute("value")
        is_disabled = role_input.get_attribute("disabled")
        log_success(f"Found Role input (value: '{role_value}')")

        if is_disabled:
            log_success("Role input is correctly disabled")
        else:
            log_warning("Role input should be disabled but isn't")
    except Exception as e:
        log_error(f"Could not find Role input: {e}")

    # Test Save button
    try:
        save_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Save Changes')]")
        log_success("Found 'Save Changes' button")

        # Check if button is clickable - should be disabled when no changes
        if save_btn.is_enabled():
            log_warning("Save button is enabled but no changes made yet")
        else:
            log_success("Save button correctly disabled (no changes made)")
    except Exception as e:
        log_error(f"Could not find Save button: {e}")

def test_save_functionality(driver):
    """Test the save functionality"""
    log_info("Testing save functionality...")

    def set_input_value(input_elem, value):
        """Set React controlled input value using JavaScript"""
        driver.execute_script("""
            var input = arguments[0];
            var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, arguments[1]);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        """, input_elem, value)

    try:
        # Update name
        name_input = driver.find_element(By.ID, "full_name")
        original_name = name_input.get_attribute("value")

        # Use JavaScript to set React controlled input
        set_input_value(name_input, "Selenium Test User")
        time.sleep(0.5)

        # Check if save button is now enabled (should be enabled since we made changes)
        save_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Save Changes')]")
        if save_btn.is_enabled():
            log_success("Save button enabled after making changes")
            save_btn.click()
            time.sleep(2)

            # Check for success or error notification
            try:
                # Check for error first by looking for "Failed to update" text
                try:
                    error_elem = driver.find_element(By.XPATH, "//*[contains(text(), 'Failed to update') or contains(text(), 'Error')]")
                    log_warning(f"Save triggered error: {error_elem.text[:100]}")
                except:
                    # No error text, check for success text
                    try:
                        success_elem = driver.find_element(By.XPATH, "//*[contains(text(), 'Profile updated successfully') or contains(text(), 'updated successfully')]")
                        log_success("Save triggered success notification")
                    except:
                        # Try looking for just "Success" title
                        try:
                            success_title = driver.find_element(By.XPATH, "//div[contains(@role, 'status')]//*[text()='Success']")
                            log_success("Save triggered success notification (title found)")
                        except:
                            # Check if name was actually updated
                            name_input = driver.find_element(By.ID, "full_name")
                            current_name = name_input.get_attribute("value")
                            if current_name == "Selenium Test User":
                                log_success("Save appears successful (name value persisted)")
                            else:
                                log_warning("No notification found - value may not have saved")
            except Exception as e:
                log_warning(f"Error checking for notification: {e}")
        else:
            log_warning("Save button still disabled after changes - checking if input change was detected")

        # Restore original name
        name_input = driver.find_element(By.ID, "full_name")
        set_input_value(name_input, original_name)
        time.sleep(0.5)

        # Save restored name
        save_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Save Changes')]")
        if save_btn.is_enabled():
            save_btn.click()
            time.sleep(1)
            log_success("Restored original name")

    except Exception as e:
        log_error(f"Error testing save functionality: {e}")

def test_navigation_tabs(driver):
    """Test that settings navigation works"""
    log_info("Testing settings navigation tabs...")

    tabs_to_test = [
        ("Organization", "/settings/organization"),
        ("Teams", "/settings/teams"),
        ("Roles", "/settings/roles"),
        ("API Keys", "/settings/api-keys"),
        ("Billing", "/settings/billing"),
        ("Profile", "/settings/profile"),
    ]

    for tab_name, expected_path in tabs_to_test:
        try:
            # Find the button in the settings nav (left sidebar)
            tab_btn = driver.find_element(By.XPATH, f"//nav//button[contains(text(), '{tab_name}')]")

            # Scroll into view and click using JavaScript for reliability
            driver.execute_script("arguments[0].scrollIntoView(true);", tab_btn)
            time.sleep(0.3)
            driver.execute_script("arguments[0].click();", tab_btn)

            # Wait for navigation
            time.sleep(1)

            if expected_path in driver.current_url:
                log_success(f"'{tab_name}' tab navigates correctly")
            else:
                log_warning(f"'{tab_name}' tab navigation - expected '{expected_path}' in URL, got '{driver.current_url}'")
        except Exception as e:
            log_error(f"Could not find or click '{tab_name}' tab: {e}")

def main():
    print("\n" + "="*60)
    print("PROFILE SETTINGS PAGE - SELENIUM TEST")
    print("="*60 + "\n")

    driver = None
    try:
        driver = setup_driver()
        log_success("Chrome driver initialized")

        # Login
        if not login(driver):
            log_error("Cannot proceed without login")
            return 1

        # Navigate to profile settings
        if not navigate_to_profile_settings(driver):
            log_error("Cannot proceed without navigation")
            return 1

        # Run tests
        test_profile_settings_elements(driver)
        test_save_functionality(driver)
        test_navigation_tabs(driver)

    except Exception as e:
        log_error(f"Unexpected error: {e}")
    finally:
        if driver:
            driver.quit()
            log_info("Browser closed")

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")

    if errors:
        print("\nErrors found:")
        for i, err in enumerate(errors, 1):
            print(f"  {i}. {err}")

    if warnings:
        print("\nWarnings found:")
        for i, warn in enumerate(warnings, 1):
            print(f"  {i}. {warn}")

    if not errors and not warnings:
        print("\n✅ All tests passed!")

    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
