Feature: Known threat blocking
  As a developer installing packages
  I want Ward to block packages with known vulnerabilities or malware
  So that malicious code never executes on my machine

  Background:
    Given Ward is initialized in the project
    And the threat database contains:
      | package | version | threat_type    | description                                          | safe_version |
      | axios   | 1.14.1  | malicious-code | This version steals SSH keys and cloud credentials   | 1.14.0       |
      | axios   | 0.30.4  | malicious-code | This version drops a cross-platform RAT              | 0.30.3       |

  # --- Happy paths ---

  Scenario: Blocking a known malicious package
    When the developer installs "axios@1.14.1"
    Then Ward blocks the installation
    And the developer sees a red "BLOCKED" verdict
    And the developer sees "This version steals SSH keys and cloud credentials"
    And the developer sees "Safe version: 1.14.0"
    And the package is NOT installed in node_modules

  Scenario: Allowing a safe version of a flagged package
    When the developer installs "axios@1.14.0"
    Then Ward allows the installation
    And the developer sees a green "clean" verdict
    And axios@1.14.0 is installed in node_modules

  Scenario: Blocking a different compromised version of the same package
    When the developer installs "axios@0.30.4"
    Then Ward blocks the installation
    And the developer sees "Safe version: 0.30.3"

  Scenario: Installing an unrelated safe package
    When the developer installs "express@4.19.0"
    Then Ward allows the installation
    And the developer sees a green "clean" verdict

  # --- Output modes ---

  Scenario: Human-readable block message (default)
    When the developer installs "axios@1.14.1"
    Then the block message explains the danger in plain English
    And the message does NOT contain CVE numbers

  Scenario: Clinical block message
    When the developer installs "axios@1.14.1" with the "--clinical" flag
    Then the block message includes the threat type "malicious-code"
    And the message format is concise and technical

  Scenario: JSON output for blocked package
    When the developer installs "axios@1.14.1" with the "--json" flag
    Then the output is valid JSON
    And the JSON contains action "block"
    And the JSON contains the safe version "1.14.0"
    And the JSON contains the full signal details

  # --- Edge cases ---

  Scenario: Scoped package in threat database
    Given the threat database also contains:
      | package         | version | threat_type | description          | safe_version |
      | @malicious/util | 1.0.0   | malware     | Credential harvester | none         |
    When the developer installs "@malicious/util@1.0.0"
    Then Ward blocks the installation

  Scenario: Package name is case-sensitive
    When the developer installs "Axios@1.14.1"
    Then Ward allows the installation
    # npm normalizes to lowercase, but Ward matches exactly what's in the DB

  Scenario: Prerelease version in threat database
    Given the threat database also contains:
      | package | version       | threat_type | description | safe_version |
      | pkg-x   | 2.0.0-rc.1   | malware     | Backdoor    | 1.9.0        |
    When the developer installs "pkg-x@2.0.0-rc.1"
    Then Ward blocks the installation

  # --- Allowlist bypass ---

  Scenario: Allowlisted package bypasses threat check
    Given the .wardrc allowlist includes "axios"
    When the developer installs "axios@1.14.1"
    Then Ward allows the installation
    And the developer sees "clean (allowlisted)"
