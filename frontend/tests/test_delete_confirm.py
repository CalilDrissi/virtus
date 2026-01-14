"""
Test that delete confirmation dialog works.
"""
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options


def run_test():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")

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
        print("   Done")

        # Navigate to Admin Models
        print("2. Navigating to Admin Models...")
        driver.get("http://localhost:3000/admin/models")
        time.sleep(2)

        rows = driver.find_elements(By.XPATH, "//tbody/tr")
        initial_count = len(rows)
        print(f"   Found {initial_count} models")

        if initial_count == 0:
            print("   No models to test with!")
            return

        # Get model name from first row
        first_row = rows[0]
        cells = first_row.find_elements(By.TAG_NAME, "td")
        model_name = cells[0].text.split('\n')[0]
        print(f"   Will test delete confirmation for: {model_name}")

        # Click delete button
        print("3. Clicking delete button...")
        action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")
        delete_btn = action_buttons[1]
        delete_btn.click()
        time.sleep(2)  # Wait for modal animation

        # Check if confirmation modal appeared
        print("4. Checking for confirmation modal...")
        body = driver.find_element(By.TAG_NAME, "body")
        body_html = body.get_attribute("innerHTML")

        if "Delete Model" in body_html:
            print("   PASS: 'Delete Model' text found - modal appeared")
        else:
            print("   FAIL: Delete confirmation modal not found")
            return

        if "Are you sure" in body_html:
            print("   PASS: Confirmation message present")

        if model_name in body_html:
            print(f"   PASS: Modal mentions the model name '{model_name}'")

        # Test Cancel button
        print("5. Testing Cancel button...")
        # Find visible Cancel buttons
        cancel_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Cancel')]")
        visible_cancel = None
        for btn in cancel_buttons:
            if btn.is_displayed():
                visible_cancel = btn
                break

        if visible_cancel:
            visible_cancel.click()
            time.sleep(1)
            print("   PASS: Cancel button clicked")

            # Verify model count unchanged
            rows_after_cancel = driver.find_elements(By.XPATH, "//tbody/tr")
            if len(rows_after_cancel) == initial_count:
                print("   PASS: Model count unchanged after Cancel")
            else:
                print("   FAIL: Model count changed after Cancel")
        else:
            print("   FAIL: No visible Cancel button found")
            return

        # Test actual deletion
        print("6. Testing actual deletion...")
        # Re-click delete
        first_row = driver.find_elements(By.XPATH, "//tbody/tr")[0]
        cells = first_row.find_elements(By.TAG_NAME, "td")
        action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")
        action_buttons[1].click()
        time.sleep(2)

        # Find and click the Delete confirmation button (look for danger button)
        delete_buttons = driver.find_elements(By.XPATH, "//button[contains(@class, 'danger')]")
        visible_delete = None
        for btn in delete_buttons:
            if btn.is_displayed() and "Delete" in btn.text:
                visible_delete = btn
                break

        if visible_delete:
            visible_delete.click()
            time.sleep(2)

            # Check if model was deleted
            rows_after_delete = driver.find_elements(By.XPATH, "//tbody/tr")
            final_count = len(rows_after_delete)

            if final_count < initial_count:
                print(f"   PASS: Model deleted ({initial_count} -> {final_count})")
            else:
                print(f"   FAIL: Model count unchanged ({initial_count} -> {final_count})")
        else:
            print("   FAIL: Delete confirmation button not found")

        print("\n" + "=" * 40)
        print("TEST COMPLETE")
        print("=" * 40)

    except Exception as e:
        print(f"Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        driver.quit()


if __name__ == "__main__":
    run_test()
