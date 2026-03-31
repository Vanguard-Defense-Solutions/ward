Feature: Typosquat detection
  As a developer installing packages
  I want Ward to warn me when a package name looks like a typosquat of a popular package
  So that I don't accidentally install a malicious lookalike

  Background:
    Given Ward is initialized in the project
    And the top packages list includes:
      | package     |
      | axios       |
      | lodash      |
      | express     |
      | react       |
      | typescript  |
      | webpack     |
      | vite        |
      | next        |

  # --- Happy paths ---

  Scenario: Warning on one-character substitution
    When the developer installs "axxios@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees 'Looks similar to "axios"'
    And the developer is prompted "Proceed anyway? [y/N]"

  Scenario: Warning on one-character insertion
    When the developer installs "loddash@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees 'Looks similar to "lodash"'

  Scenario: Warning on one-character deletion
    When the developer installs "expres@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees 'Looks similar to "express"'

  Scenario: Warning on character swap
    When the developer installs "axois@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees 'Looks similar to "axios"'

  Scenario: No warning for exact match (legitimate package)
    When the developer installs "axios@1.14.0"
    Then Ward does not show a typosquat warning

  Scenario: No warning for completely different name
    When the developer installs "my-cool-library@1.0.0"
    Then Ward does not show a typosquat warning

  # --- Edge cases ---

  Scenario: Short package names are not checked (too many false positives)
    When the developer installs "nex@1.0.0"
    Then Ward does not show a typosquat warning
    # "nex" is only 3 chars, within distance 1 of "next", but too short to be reliable

  Scenario: Scoped package — scope stripped for comparison
    When the developer installs "@someone/axxios@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees 'Looks similar to "axios"'

  Scenario: Hyphen-underscore swap detected
    Given the top packages list includes "my-package"
    When the developer installs "my_package@1.0.0"
    Then Ward shows a yellow "suspicious" warning

  Scenario: Distant name (edit distance > 2) is not flagged
    When the developer installs "axiosssss@1.0.0"
    Then Ward does not show a typosquat warning

  Scenario: Empty top packages list (no reference data)
    Given the top packages list is empty
    When the developer installs "axxios@1.0.0"
    Then Ward does not show a typosquat warning
    # No data to compare against = no false positives

  # --- Sensitivity modes ---

  Scenario: Strict mode blocks typosquats instead of warning
    Given the .wardrc sensitivity is "strict"
    When the developer installs "axxios@1.0.0"
    Then Ward blocks the installation
    And the developer sees a red "BLOCKED" verdict

  Scenario: Permissive mode allows typosquats silently
    Given the .wardrc sensitivity is "permissive"
    When the developer installs "axxios@1.0.0"
    Then Ward allows the installation
    And the developer sees a green "clean" verdict

  # --- Interaction ---

  Scenario: Developer proceeds after typosquat warning
    When the developer installs "axxios@1.0.0"
    And the developer responds "y" to the proceed prompt
    Then the package is installed

  Scenario: Developer cancels after typosquat warning
    When the developer installs "axxios@1.0.0"
    And the developer responds "N" to the proceed prompt
    Then the package is NOT installed
