Feature: Public threat feed
  As a developer or security researcher
  I want to browse all known threats
  So that I can see what Ward is protecting against

  Background:
    Given the API is seeded with the following threats:
      | package_name | version | threat_type    | description                                     | safe_version | detected_at              |
      | axios        | 1.14.1  | backdoor       | Maintainer account hijacked. RAT dropper.        | 1.14.0       | 2026-03-30T00:00:00Z     |
      | event-stream | 3.3.6   | backdoor       | Attacker gained maintainer access.               | 3.3.5        | 2018-11-26T00:00:00Z     |
      | colors       | 1.4.1   | malicious-code | Maintainer sabotage. Infinite loop.              | 1.4.0        | 2022-01-08T00:00:00Z     |

  Scenario: Returns all threats sorted newest first
    When I request GET /threats
    Then the response status is 200
    And the response is an array of 3 threats
    And the threats are sorted by detected_at descending
    And the first threat is "axios"
    And the last threat is "event-stream"

  Scenario: Respects limit parameter
    When I request GET /threats?limit=1
    Then the response status is 200
    And the response is an array of 1 threat
    And the first threat is "axios"

  Scenario: Returns empty array when no threats
    Given the API is seeded with no threats
    When I request GET /threats
    Then the response status is 200
    And the response is an empty array

  Scenario: Ignores invalid limit parameter
    When I request GET /threats?limit=abc
    Then the response status is 200
    And the response is an array of 3 threats

  Scenario: Each threat contains required fields
    When I request GET /threats
    Then each threat has "package_name"
    And each threat has "version"
    And each threat has "threat_type"
    And each threat has "description"
    And each threat has "detected_at"

  Scenario: Limit of 2 returns the two newest threats
    When I request GET /threats?limit=2
    Then the response is an array of 2 threats
    And the first threat is "axios"
    And the second threat is "colors"
