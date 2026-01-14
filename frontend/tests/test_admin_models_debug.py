"""
Debug test to find button issues in Admin Models page.
"""
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options


def run_debug_test():
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")

    driver = webdriver.Chrome(options=chrome_options)
    wait = WebDriverWait(driver, 10)

    try:
        # Login
        print("Logging in...")
        driver.get("http://localhost:3000/login")
        time.sleep(1)

        email_input = wait.until(EC.presence_of_element_located((By.ID, "email")))
        email_input.send_keys("admin@virtus.ai")
        password_input = driver.find_element(By.ID, "password")
        password_input.send_keys("admin123")
        login_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Sign In')]")
        login_btn.click()
        time.sleep(2)

        # Navigate to Admin Models
        print("Navigating to Admin Models...")
        driver.get("http://localhost:3000/admin/models")
        time.sleep(2)

        # Get page source for debugging
        print("\n" + "=" * 60)
        print("DEBUGGING BUTTON STRUCTURE")
        print("=" * 60)

        # Find all buttons on the page
        all_buttons = driver.find_elements(By.TAG_NAME, "button")
        print(f"\nTotal buttons on page: {len(all_buttons)}")

        # Find table rows
        rows = driver.find_elements(By.XPATH, "//tbody/tr")
        print(f"Table rows: {len(rows)}")

        if rows:
            print("\n--- Analyzing first row ---")
            first_row = rows[0]
            cells = first_row.find_elements(By.TAG_NAME, "td")
            print(f"Cells in first row: {len(cells)}")

            if cells:
                last_cell = cells[-1]  # Actions column
                print(f"\nActions cell HTML:\n{last_cell.get_attribute('outerHTML')[:1000]}")

                # Find buttons in the actions cell
                action_buttons = last_cell.find_elements(By.TAG_NAME, "button")
                print(f"\nButtons in Actions cell: {len(action_buttons)}")

                for i, btn in enumerate(action_buttons):
                    print(f"\n  Button {i + 1}:")
                    print(f"    outerHTML: {btn.get_attribute('outerHTML')[:500]}")
                    print(f"    aria-label: {btn.get_attribute('aria-label')}")
                    print(f"    class: {btn.get_attribute('class')}")
                    print(f"    title: {btn.get_attribute('title')}")
                    print(f"    disabled: {btn.get_attribute('disabled')}")
                    print(f"    is_displayed: {btn.is_displayed()}")
                    print(f"    is_enabled: {btn.is_enabled()}")

        # Try different selectors
        print("\n--- Testing different selectors ---")

        selectors_to_test = [
            ("aria-label='Edit'", "//button[@aria-label='Edit']"),
            ("aria-label='Delete'", "//button[@aria-label='Delete']"),
            ("contains class 'ghost'", "//button[contains(@class, 'ghost')]"),
            ("contains class 'cds--btn'", "//button[contains(@class, 'cds--btn')]"),
            ("contains class 'icon-only'", "//button[contains(@class, 'icon-only')]"),
            ("svg inside button", "//button[.//svg]"),
            ("button with Edit svg", "//button[.//*[local-name()='svg' and contains(@class, 'Edit')]]"),
            ("button with TrashCan svg", "//button[.//*[local-name()='svg' and contains(@class, 'TrashCan')]]"),
        ]

        for name, xpath in selectors_to_test:
            elements = driver.find_elements(By.XPATH, xpath)
            print(f"  {name}: {len(elements)} found")

        # Click test on first available button in actions
        if rows:
            first_row = rows[0]
            cells = first_row.find_elements(By.TAG_NAME, "td")
            if cells:
                action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")

                print("\n--- Testing button clicks ---")

                # Test clicking the first button (should be Edit)
                if len(action_buttons) >= 1:
                    print("\nTesting first button (Edit):")
                    try:
                        action_buttons[0].click()
                        time.sleep(1)

                        # Check if modal opened
                        modal = driver.find_elements(By.CLASS_NAME, "cds--modal-container")
                        if modal:
                            print("  SUCCESS: Modal opened!")
                            # Get modal heading
                            heading = driver.find_elements(By.CLASS_NAME, "cds--modal-header__heading")
                            if heading:
                                print(f"  Modal heading: {heading[0].text}")

                            # Close modal
                            cancel = driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
                            cancel.click()
                            time.sleep(0.5)
                        else:
                            print("  ISSUE: Modal did not open!")
                    except Exception as e:
                        print(f"  ERROR: {str(e)[:200]}")

                # Test clicking the second button (should be Delete)
                if len(action_buttons) >= 2:
                    print("\nTesting second button (Delete):")
                    try:
                        # Re-find the row and button after potential page changes
                        rows = driver.find_elements(By.XPATH, "//tbody/tr")
                        first_row = rows[0]
                        cells = first_row.find_elements(By.TAG_NAME, "td")
                        action_buttons = cells[-1].find_elements(By.TAG_NAME, "button")

                        # Get model count before
                        count_before = len(rows)

                        action_buttons[1].click()
                        time.sleep(2)

                        # Check if model was deleted
                        rows_after = driver.find_elements(By.XPATH, "//tbody/tr")
                        count_after = len(rows_after)

                        # Check console for errors
                        logs = driver.get_log("browser")
                        errors = [log for log in logs if log["level"] == "SEVERE"]

                        if count_after < count_before:
                            print(f"  SUCCESS: Model deleted! ({count_before} -> {count_after})")
                        elif errors:
                            print(f"  ISSUE: JavaScript errors after delete:")
                            for err in errors:
                                print(f"    {err['message'][:200]}")
                        else:
                            print(f"  ISSUE: Delete button clicked but model count unchanged ({count_before})")
                            print("  Checking if there was a confirmation dialog or error...")

                            # Check for any error notification
                            notifications = driver.find_elements(By.CLASS_NAME, "cds--inline-notification--error")
                            if notifications:
                                print(f"  Found error notification: {notifications[0].text}")

                            # Check for any modal
                            modal = driver.find_elements(By.CLASS_NAME, "cds--modal-container")
                            if modal:
                                print(f"  Found modal - maybe confirmation required?")

                    except Exception as e:
                        print(f"  ERROR: {str(e)[:200]}")

        print("\n" + "=" * 60)
        print("DEBUG COMPLETE")
        print("=" * 60)

    except Exception as e:
        print(f"Test failed: {str(e)}")
    finally:
        driver.quit()


if __name__ == "__main__":
    run_debug_test()
