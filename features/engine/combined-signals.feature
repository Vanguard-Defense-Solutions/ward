Feature: Combined signal verdict
  As a developer installing packages
  I want Ward to combine multiple risk signals into a single clear verdict
  So that the most important threat is surfaced and I can make an informed decision

  Background:
    Given Ward is initialized in the project
    And the threat database contains:
      | package | version | threat_type    | description                | safe_version |
      | evil    | 1.0.0   | malicious-code | Steals SSH keys            | none         |

  # --- Signal priority ---

  Scenario: Known threat overrides all other signals
    Given the package "evil@1.0.0" is a known threat
    And the package "evil@1.0.0" has a postinstall script
    And the name "evil" is close to a popular package
    When the developer installs "evil@1.0.0"
    Then Ward shows a single "BLOCKED" verdict (not multiple warnings)
    And the block reason is the known threat description

  Scenario: Multiple warnings combine into one verdict
    Given the package "axxios@1.0.0" is a typosquat of "axios"
    And the package "axxios@1.0.0" has an unknown postinstall script
    When the developer installs "axxios@1.0.0"
    Then Ward shows a single "suspicious" warning
    And both signals are listed in the details (with --verbose)

  Scenario: Info signals do not elevate verdict
    Given the package "good-native@1.0.0" has a known-safe install script (node-gyp)
    When the developer installs "good-native@1.0.0"
    Then Ward shows "clean" (not a warning)
    And the install script is noted in verbose output only

  # --- Verdict output structure ---

  Scenario: Verdict line is always exactly one line
    When the developer installs any package
    Then the Ward verdict occupies exactly one line in terminal output
    And additional context appears on subsequent indented lines (if applicable)

  Scenario: Verbose mode shows all signals
    When the developer installs "axxios@1.0.0" with "--verbose"
    Then the developer sees the verdict line
    And the developer sees each individual signal with its type and severity
    And the developer sees the check time in milliseconds
    And the developer sees which checks were run

  # --- First-install experience ---

  Scenario: First 3 installs show timing to prove speed
    Given Ward was just initialized (install counter is 0)
    When the developer installs their 1st package
    Then the verdict line includes the check time (e.g. "142ms")
    When the developer installs their 2nd package
    Then the verdict line includes the check time
    When the developer installs their 3rd package
    Then the verdict line includes the check time
    When the developer installs their 4th package
    Then the verdict line does NOT include the check time
    # After 3 installs, timing is hidden to reduce noise

  # --- NO_COLOR support ---

  Scenario: Respects NO_COLOR environment variable
    Given the NO_COLOR environment variable is set
    When the developer installs any package
    Then the output contains no ANSI color codes
    And verdicts are conveyed by symbols only (checkmark, warning, X)

  Scenario: Respects TERM=dumb
    Given the TERM environment variable is "dumb"
    When the developer installs any package
    Then the output contains no ANSI escape sequences
