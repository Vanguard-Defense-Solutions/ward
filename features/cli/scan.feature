Feature: Project dependency scanning
  As a developer with an existing project
  I want to scan all my current dependencies for known threats
  So that I can find and fix vulnerabilities in packages I've already installed

  Background:
    Given Ward is initialized in the project
    And the threat database contains:
      | package       | version | threat_type    | description            | safe_version |
      | bad-dep       | 2.0.0   | malicious-code | Credential harvester   | 1.9.0        |

  # --- Happy paths ---

  Scenario: Scanning a clean project
    Given the project has dependencies:
      | package  | version |
      | express  | 4.19.0  |
      | lodash   | 4.17.21 |
    When the developer runs "ward scan"
    Then the developer sees "All clear. 2 deps checked, 0 issues."
    And the exit code is 0

  Scenario: Scanning a project with a known threat
    Given the project has dependencies:
      | package  | version |
      | express  | 4.19.0  |
      | bad-dep  | 2.0.0   |
    When the developer runs "ward scan"
    Then the developer sees 1 blocked dependency
    And the developer sees "bad-dep@2.0.0" flagged with "Credential harvester"
    And the developer sees "Safe version: 1.9.0"
    And the exit code is 1

  Scenario: Scanning with typosquat warnings
    Given the project has dependencies:
      | package  | version |
      | axxios   | 1.0.0   |
    When the developer runs "ward scan"
    Then the developer sees 1 warning
    And the developer sees 'axxios looks similar to "axios"'

  # --- Output modes ---

  Scenario: JSON output for CI/CD integration
    Given the project has dependencies:
      | package  | version |
      | express  | 4.19.0  |
      | bad-dep  | 2.0.0   |
    When the developer runs "ward scan --json"
    Then the output is valid JSON
    And the JSON contains total: 2, blocked: 1, warnings: 0, clean: 1
    And the JSON includes full signal details for each dependency

  # --- Edge cases ---

  Scenario: Scanning with no lockfile
    Given the project has a package.json but no lockfile
    When the developer runs "ward scan"
    Then the developer sees "No lockfile found. Run npm install first."
    And the exit code is 1

  Scenario: Scanning an empty project (no dependencies)
    Given the project has no dependencies
    When the developer runs "ward scan"
    Then the developer sees "No dependencies found."
    And the exit code is 0

  Scenario: Scanning a large project (performance)
    Given the project has 500 dependencies
    When the developer runs "ward scan"
    Then the scan completes in under 5 seconds
    And the developer sees a progress indicator during scanning
