Feature: API rate limiting
  As the Ward API operator
  I want to limit requests per IP
  So that the service is not abused

  Scenario: Requests within limit succeed
    Given the rate limiter allows 5 requests per minute
    When I send 5 requests to GET /health
    Then all 5 responses have status 200

  Scenario: Exceeding rate limit returns 429
    Given the rate limiter allows 5 requests per minute
    When I send 6 requests to GET /health
    Then the first 5 responses have status 200
    And the 6th response has status 429
    And the 6th response error contains "Rate limit"
    And the 6th response includes a "retryAfter" field

  Scenario: Different endpoints share the same rate limit
    Given the rate limiter allows 3 requests per minute
    When I send 1 request to GET /health
    And I send 1 request to GET /threats
    And I send 1 request to GET /score/express
    And I send 1 request to GET /health
    Then the 4th response has status 429

  Scenario: Rate limit resets after the window expires
    Given the rate limiter allows 2 requests per window
    When I send 2 requests to GET /health
    And the rate limit window resets
    And I send 1 more request to GET /health
    Then the last response has status 200
