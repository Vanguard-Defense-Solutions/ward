Feature: Automatic npm install interception
  As a developer using npm (or an AI tool that runs npm)
  I want Ward to automatically check every package I install
  So that I'm protected without having to remember to run ward manually

  Background:
    Given Ward is initialized in the project
    And the threat database contains:
      | package | version | threat_type    | description                | safe_version |
      | bad-pkg | 1.0.0   | malicious-code | Steals environment secrets | 0.9.0        |

  # --- Happy paths ---

  Scenario: npm install is intercepted transparently
    When the developer runs "npm install express@4.19.0"
    Then Ward checks "express@4.19.0" before installation
    And the developer sees "ward: clean" in the terminal output
    And express@4.19.0 is installed successfully
    And the total install time overhead is less than 500ms

  Scenario: npm install of malicious package is blocked
    When the developer runs "npm install bad-pkg@1.0.0"
    Then Ward blocks the installation before any install scripts execute
    And the developer sees a red "BLOCKED" verdict
    And bad-pkg is NOT in node_modules

  Scenario: AI tool triggers npm install (transparent protection)
    When Claude Code runs "npm install axios@1.14.0" via Bash tool
    Then Ward intercepts and checks the package
    And the install proceeds (axios@1.14.0 is safe)
    # Ward protects regardless of whether a human or AI initiated the install

  Scenario: Multiple packages installed at once
    When the developer runs "npm install express lodash react"
    Then Ward checks each package individually
    And the developer sees a verdict for each package

  # --- Install scripts are controlled ---

  Scenario: Install scripts are disabled by default, selectively re-enabled
    Given Ward has configured .npmrc with ignore-scripts=true
    When the developer runs "npm install native-addon@1.0.0"
    Then npm does not run install scripts during installation
    And Ward evaluates whether the install scripts are safe
    And if safe, Ward runs the install scripts after npm completes

  # --- Edge cases ---

  Scenario: npm install with no package argument (install from lockfile)
    When the developer runs "npm install" (no package specified)
    Then Ward does not interfere with lockfile-based installs
    And dependencies are installed normally

  Scenario: Concurrent npm installs don't corrupt Ward state
    When two terminal tabs both run "npm install" simultaneously
    Then both installations complete without Ward errors
    And no lockfile corruption occurs

  Scenario: Developer force-kills npm mid-install
    When the developer runs "npm install express@4.19.0"
    And the developer kills the process mid-install (Ctrl+C)
    Then no partial Ward state is left behind
    And the next "npm install" works correctly

  # --- Hook setup ---

  Scenario: Ward hook survives npm install (not removed by npm)
    Given Ward is initialized with hooks in package.json
    When the developer runs "npm install express"
    Then the ward preinstall hook is still in package.json after install
