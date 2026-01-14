"""
Debug test for delete confirmation dialog.
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

        # Click delete button
        print("3. Clicking delete button...")
        first_row = rows[0]
        cells = first_row.find_elements(By.TAG_NAME, "td")
        action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")
        delete_btn = action_buttons[1]
        delete_btn.click()
        time.sleep(2)  # Wait for modal animation

        # Debug: Print all divs with 'modal' in class
        print("\n4. Searching for modal elements...")
        all_elements = driver.find_elements(By.XPATH, "//*[contains(@class, 'modal')]")
        print(f"   Found {len(all_elements)} elements with 'modal' in class")
        for i, el in enumerate(all_elements[:5]):
            print(f"   [{i}] {el.tag_name}: class='{el.get_attribute('class')[:80]}...'")

        # Look for the modal container specifically
        modal_containers = driver.find_elements(By.CLASS_NAME, "cds--modal-container")
        print(f"\n   Modal containers: {len(modal_containers)}")

        # Look for open modals
        open_modals = driver.find_elements(By.XPATH, "//div[contains(@class, 'cds--modal') and contains(@class, 'is-visible')]")
        print(f"   Open modals (is-visible): {len(open_modals)}")

        # Try different selector
        modal_by_role = driver.find_elements(By.XPATH, "//*[@role='dialog']")
        print(f"   Elements with role='dialog': {len(modal_by_role)}")

        # Check for Carbon modal wrapper
        modal_wrapper = driver.find_elements(By.CLASS_NAME, "cds--modal-container--sm")
        print(f"   Modal containers with size: {len(modal_wrapper)}")

        # Print body content for debugging
        print("\n5. Checking page content...")
        body = driver.find_element(By.TAG_NAME, "body")
        body_html = body.get_attribute("innerHTML")

        if "Delete Model" in body_html:
            print("   PASS: 'Delete Model' text found in page")
        else:
            print("   'Delete Model' text NOT found")

        if "Are you sure" in body_html:
            print("   PASS: 'Are you sure' text found in page")
        else:
            print("   'Are you sure' text NOT found")

        # Try to find any buttons in a modal context
        all_buttons = driver.find_elements(By.TAG_NAME, "button")
        print(f"\n   Total buttons on page: {len(all_buttons)}")

        # Look for Cancel button
        cancel_buttons = driver.find_elements(By.XPATH, "//button[contains(text(), 'Cancel')]")
        print(f"   Cancel buttons: {len(cancel_buttons)}")

        # If we found modal content, try clicking cancel
        if cancel_buttons and len(cancel_buttons) > 1:
            print("\n6. Testing Cancel button...")
            # The second Cancel button should be from the modal
            for i, btn in enumerate(cancel_buttons):
                print(f"   Cancel button {i}: displayed={btn.is_displayed()}, enabled={btn.is_enabled()}")

            # Find the visible Cancel button
            visible_cancel = None
            for btn in cancel_buttons:
                if btn.is_displayed():
                    visible_cancel = btn
                    break

            if visible_cancel:
                visible_cancel.click()
                time.sleep(1)
                print("   Clicked Cancel")

                # Check if modal closed
                rows_after = driver.find_elements(By.XPATH, "//tbody/tr")
                if len(rows_after) == initial_count:
                    print(f"   PASS: Model count unchanged ({initial_count})")

        print("\n" + "=" * 40)
        print("DEBUG COMPLETE")
        print("=" * 40)

    except Exception as e:
        print(f"Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        driver.quit()


if __name__ == "__main__":
    run_test()
