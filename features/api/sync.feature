Feature: Delta sync endpoint
  As a Ward CLI client
  I want to sync my local threat database with the cloud
  So that I have the latest threat intelligence

  Background:
    Given the API is seeded with the following threats:
      | package_name | version | threat_type    | description                                     | safe_version | detected_at              |
      | axios        | 1.14.1  | backdoor       | Maintainer account hijacked. RAT dropper.        | 1.14.0       | 2026-03-30T00:00:00Z     |
      | event-stream | 3.3.6   | backdoor       | Attacker gained maintainer access.               | 3.3.5        | 2018-11-26T00:00:00Z     |
      | colors       | 1.4.1   | malicious-code | Maintainer sabotage. Infinite loop.              | 1.4.0        | 2022-01-08T00:00:00Z     |

  Scenario: Full sync (no since parameter)
    When I request GET /sync
    Then the response status is 200
    And the response contains a "payload" field
    And the response contains a "signature" field
    And the payload contains all 3 seeded threats
    And the payload contains a "timestamp" field

  Scenario: Delta sync (with since parameter)
    When I request GET /sync?since=2022-01-01T00:00:00Z
    Then the response status is 200
    And the payload contains 2 threats
    And the payload threats are all detected after "2022-01-01T00:00:00Z"

  Scenario: Delta sync with no new threats returns empty array
    When I request GET /sync?since=2099-01-01T00:00:00Z
    Then the response status is 200
    And the payload contains 0 threats

  Scenario: Response is signed with Ed25519
    When I request GET /sync
    Then the response contains a "signature" field
    And the signature is a valid base64 string

  Scenario: Signature is valid and verifiable with public key
    Given the API's Ed25519 public key is known
    When I request GET /sync
    Then the Ed25519 signature verifies the payload with the public key

  Scenario: Signature verification fails with wrong key
    Given a different Ed25519 key pair is generated
    When I request GET /sync
    Then the signature does NOT verify with the wrong public key

  Scenario: Full sync payload includes all threat fields
    When I request GET /sync
    Then each threat in the payload has "package_name"
    And each threat in the payload has "version"
    And each threat in the payload has "threat_type"
    And each threat in the payload has "description"
    And each threat in the payload has "detected_at"
