Feature: Project initialization
  As a developer starting to use Ward
  I want to initialize Ward in my project with one command
  So that my future package installs are automatically protected

  Background:
    Given a project directory with a package.json

  # --- Happy paths ---

  Scenario: First-time initialization
    When the developer runs "ward init"
    Then a .wardrc file is created in the project directory
    And the .wardrc contains default settings (sensitivity: normal, cloud: enabled)
    And the developer sees "Ward initialized. You're protected."
    And the exit code is 0

  Scenario: Initialization configures npm hooks
    When the developer runs "ward init"
    Then an .npmrc file is created with "ignore-scripts=true"
    And the package.json scripts include a ward preinstall hook

  Scenario: Re-initialization is idempotent
    Given Ward has already been initialized in this project
    When the developer runs "ward init" again
    Then the .wardrc is preserved (not overwritten)
    And the developer sees "Ward initialized. You're protected."
    And no duplicate hooks are added to package.json

  # --- Output modes ---

  Scenario: JSON output mode
    When the developer runs "ward init --json"
    Then the output is valid JSON
    And the JSON contains {"success": true}

  # --- Error paths ---

  Scenario: No package.json in directory
    Given a directory with no package.json
    When the developer runs "ward init"
    Then the developer sees an error mentioning "package.json"
    And no .wardrc file is created
    And the exit code is 1

  Scenario: Read-only directory
    Given the project directory is read-only
    When the developer runs "ward init"
    Then the developer sees an error about permissions
    And the exit code is 1
