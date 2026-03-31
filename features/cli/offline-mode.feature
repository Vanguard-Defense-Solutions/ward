Feature: Offline mode
  As a developer working without internet access
  I want Ward to continue protecting me using its local database
  So that I'm never unprotected just because I'm offline

  Background:
    Given Ward is initialized in the project
    And the threat database was synced before going offline
    And the threat database contains:
      | package | version | threat_type    | description              | safe_version |
      | bad-pkg | 1.0.0   | malicious-code | Steals environment vars  | 0.9.0        |

  # --- Core offline protection ---

  Scenario: Known threats are still blocked offline
    Given the developer is offline
    When the developer installs "bad-pkg@1.0.0"
    Then Ward blocks the installation
    And the developer sees "BLOCKED"
    And protection works identically to online mode for known threats

  Scenario: Typosquat detection works offline
    Given the developer is offline
    When the developer installs "axxios@1.0.0"
    Then Ward shows a typosquat warning
    # Typosquat detection is local — no cloud needed

  Scenario: Clean packages install normally offline
    Given the developer is offline
    When the developer installs "express@4.19.0"
    Then Ward allows the installation
    And the developer sees "ward: clean"
    And there is no error about being offline

  # --- Degraded but functional ---

  Scenario: Cloud escalation skipped when offline
    Given the developer is offline
    And a package triggers a suspicious signal that would normally escalate to cloud
    When the developer installs the package
    Then Ward does NOT attempt to contact the cloud API
    And Ward makes a decision using only local signals
    And the developer is not blocked by a network timeout

  Scenario: Sync failure does not interrupt workflow
    Given the developer goes offline mid-session
    When the automatic sync timer fires
    Then the sync fails silently
    And the developer sees no error messages during normal work
    And Ward continues using the cached database

  # --- Recovery ---

  Scenario: Ward syncs automatically when back online
    Given the developer was offline for 2 hours
    When the developer reconnects to the internet
    And the next sync timer fires
    Then Ward successfully syncs the threat database
    And new threats from the last 2 hours are now in the local database
