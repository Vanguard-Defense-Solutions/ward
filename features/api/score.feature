Feature: Ward Score endpoint
  As a developer evaluating a package
  I want to see its Ward trust score
  So that I can make an informed decision about using it

  Background:
    Given the API is seeded with the following threats:
      | package_name | version | threat_type    | description                                     | safe_version | detected_at              |
      | axios        | 1.14.1  | backdoor       | Maintainer account hijacked. RAT dropper.        | 1.14.0       | 2026-03-30T00:00:00Z     |
    And the top packages list includes "react", "express", "lodash", "typescript"

  Scenario: Known threat has score 0
    When I request GET /score/axios
    Then the response status is 200
    And the score is 0
    And the signals include "known-threat"

  Scenario: Top package has high score
    When I request GET /score/express
    Then the response status is 200
    And the score is at least 90
    And the signals include "top-package"

  Scenario: Unknown package has neutral score
    When I request GET /score/some-random-pkg-xyz
    Then the response status is 200
    And the score is 50
    And the signals include "unknown"

  Scenario: Score response includes package name
    When I request GET /score/lodash
    Then the response field "package" equals "lodash"

  Scenario: Score consistency with check endpoint
    Given the package "colors" version "1.4.1" is a known threat
    When I request GET /score/colors
    Then the score is 0
    When I POST /check with body:
      """
      { "package_name": "colors", "version": "1.4.1" }
      """
    Then the verdict action is "block"
