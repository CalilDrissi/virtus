"""
Focused test for DELETE functionality in Admin Models page.
"""
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options


def run_delete_test():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    # Enable logging
    chrome_options.set_capability('goog:loggingPrefs', {'browser': 'ALL', 'performance': 'ALL'})

    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 10)

    try:
        # Login
        print("1. Logging in...")
        driver.get("http://localhost:3000/login")
        time.sleep(1)

        email_input = wait.until(EC.presence_of_element_located((By.ID, "email")))
        email_input.send_keys("admin@virtus.ai")
        password_input = driver.find_element(By.ID, "password")
        password_input.send_keys("admin123")
        login_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Sign In')]")
        login_btn.click()
        time.sleep(2)
        print("   Logged in successfully")

        # Navigate to Admin Models
        print("2. Navigating to Admin Models...")
        driver.get("http://localhost:3000/admin/models")
        time.sleep(2)

        # Get initial row count
        rows = driver.find_elements(By.XPATH, "//tbody/tr")
        initial_count = len(rows)
        print(f"   Found {initial_count} models")

        if initial_count == 0:
            print("   No models to delete!")
            return

        # Get the first row and its model name
        first_row = rows[0]
        cells = first_row.find_elements(By.TAG_NAME, "td")
        model_name = cells[0].text.split('\n')[0]
        print(f"   Will attempt to delete: {model_name}")

        # Clear any previous console errors
        driver.get_log("browser")

        # Find and click the delete button in the first row
        action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")
        if len(action_buttons) < 2:
            print("   ERROR: Could not find delete button")
            return

        print("3. Clicking delete button...")
        delete_btn = action_buttons[1]  # Second button is delete
        delete_btn.click()

        # Wait for the request to complete
        print("4. Waiting for response...")
        time.sleep(3)

        # Check console for errors
        logs = driver.get_log("browser")
        errors = [log for log in logs if log["level"] == "SEVERE"]

        if errors:
            print("\n   CONSOLE ERRORS:")
            for err in errors:
                print(f"   - {err['message']}")

        # Check row count after delete
        rows_after = driver.find_elements(By.XPATH, "//tbody/tr")
        final_count = len(rows_after)

        print(f"\n5. Results:")
        print(f"   Initial count: {initial_count}")
        print(f"   Final count: {final_count}")

        if final_count < initial_count:
            print(f"   SUCCESS: Model was deleted!")
        else:
            print(f"   ISSUE: Model count unchanged")

            # Check for any error notifications on the page
            notifications = driver.find_elements(By.CLASS_NAME, "cds--inline-notification--error")
            if notifications:
                print(f"   Error notification: {notifications[0].text}")

            # Check if there's a confirmation modal
            modals = driver.find_elements(By.CLASS_NAME, "cds--modal-container")
            if modals:
                print(f"   Found modal - might need confirmation")

        # Check network requests if performance logs available
        try:
            perf_logs = driver.get_log("performance")
            for log in perf_logs[-20:]:  # Check last 20 logs
                message = log.get('message', '')
                if 'DELETE' in message or 'models' in message:
                    import json
                    parsed = json.loads(message)
                    method = parsed.get('message', {}).get('method', '')
                    if 'Network.requestWillBeSent' in method:
                        params = parsed.get('message', {}).get('params', {})
                        request = params.get('request', {})
                        if 'DELETE' in request.get('method', ''):
                            print(f"\n   DELETE request found: {request.get('url', '')}")
                    if 'Network.responseReceived' in method:
                        params = parsed.get('message', {}).get('params', {})
                        response = params.get('response', {})
                        if 'models' in response.get('url', ''):
                            print(f"   Response status: {response.get('status', 'unknown')}")
        except Exception as e:
            print(f"   Could not parse performance logs: {e}")

    except Exception as e:
        print(f"Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        driver.quit()


if __name__ == "__main__":
    run_delete_test()
