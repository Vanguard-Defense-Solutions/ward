Feature: Protection status
  As a developer using Ward
  I want to see my current protection status at a glance
  So that I know Ward is working and my threat database is current

  # --- Happy paths ---

  Scenario: Status when Ward is initialized and synced
    Given Ward is initialized in the project
    And the threat database was last synced 10 minutes ago
    And the threat database contains 1247 entries
    When the developer runs "ward status"
    Then the developer sees "protected"
    And the developer sees "last sync: 10 minutes ago"
    And the developer sees "1,247 threats in database"
    And the developer sees the sensitivity level (e.g. "sensitivity: normal")

  Scenario: Status when Ward is not initialized
    Given Ward has NOT been initialized in this project
    When the developer runs "ward status"
    Then the developer sees "Ward is not initialized. Run `ward init` to get started."

  Scenario: Status when never synced
    Given Ward is initialized in the project
    And the threat database has never been synced
    When the developer runs "ward status"
    Then the developer sees "protected (never synced — run `ward sync` to update)"

  # --- Offline ---

  Scenario: Status when offline with stale database
    Given Ward is initialized in the project
    And the developer is offline
    And the last sync was 2 hours ago
    When the developer runs "ward status"
    Then the developer sees "protected (offline mode)"
    And the developer sees "last sync: 2 hours ago"
    And the developer sees "offline mode — local checks only"

  # --- Output modes ---

  Scenario: JSON output
    Given Ward is initialized in the project
    When the developer runs "ward status --json"
    Then the output is valid JSON
    And the JSON contains initialized: true
    And the JSON contains the last sync timestamp
    And the JSON contains the threat count
    And the JSON contains the sensitivity level
