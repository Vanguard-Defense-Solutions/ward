Feature: Version anomaly detection
  As a developer installing packages
  I want Ward to flag unexpected version jumps or non-existent versions
  So that I notice when a package version looks suspicious

  Background:
    Given Ward is initialized in the project

  # --- Happy paths ---

  Scenario: Normal patch version bump is clean
    Given the project previously had "express@4.18.2"
    When the developer installs "express@4.19.0"
    Then Ward does not flag a version anomaly

  Scenario: Normal major bump (1.x to 2.x) is clean
    Given the project previously had "pkg@1.9.0"
    When the developer installs "pkg@2.0.0"
    Then Ward does not flag a version anomaly

  Scenario: Large major version jump triggers warning
    Given the project previously had "pkg@1.2.3"
    When the developer installs "pkg@4.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees "Unexpected major version jump: 1.2.3 to 4.0.0 (3 major versions)"

  Scenario: Non-existent version triggers warning
    Given the version "pkg@99.0.0" does not exist in the registry
    When the developer installs "pkg@99.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees "pkg@99.0.0 not found in registry"

  # --- Edge cases ---

  Scenario: First-time install (no previous version) is clean
    Given the project has never installed "new-pkg"
    When the developer installs "new-pkg@1.0.0"
    Then Ward does not flag a version anomaly

  Scenario: Prerelease version is not flagged
    Given the project previously had "pkg@1.9.0"
    When the developer installs "pkg@2.0.0-rc.1"
    Then Ward does not flag a version anomaly

  Scenario: Invalid version string is handled gracefully
    When the developer installs "pkg@not-a-version"
    Then Ward does not flag a version anomaly
    And Ward does not crash
