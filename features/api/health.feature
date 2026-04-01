Feature: API health check
  As a developer or monitoring system
  I want to check if the Ward API is running
  So that I can verify the service is healthy

  Scenario: Health endpoint returns status
    When I request GET /health
    Then the response status is 200
    And the response contains status "ok"
    And the response contains the threat count
    And the response contains the API version

  Scenario: Health endpoint reflects seeded threat count
    Given the API is seeded with 3 known threats
    When I request GET /health
    Then the response status is 200
    And the response field "threats" equals 3

  Scenario: Health endpoint returns JSON content type
    When I request GET /health
    Then the response Content-Type is "application/json"
