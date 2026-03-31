Feature: Signed delta database sync
  As a developer using Ward
  I want my local threat database to stay up-to-date automatically
  So that I'm protected against newly discovered threats without manual action

  Background:
    Given Ward is initialized in the project

  # --- Happy paths ---

  Scenario: First sync downloads full database
    Given the local threat database has never been synced
    When Ward syncs the threat database
    Then Ward downloads the full database snapshot from the cloud
    And the database signature is verified with Ed25519
    And the last-sync timestamp is recorded
    And the developer sees no output (sync is silent on success)

  Scenario: Subsequent sync downloads only new entries
    Given the local threat database was last synced at "2026-03-31T10:00:00Z"
    When Ward syncs the threat database
    Then Ward sends the last-sync timestamp to the server
    And Ward receives only entries added after "2026-03-31T10:00:00Z"
    And the new entries are merged into the local database
    And the last-sync timestamp is updated

  Scenario: Sync with no new entries
    Given the local threat database is up-to-date
    When Ward syncs the threat database
    Then the server returns an empty delta
    And the last-sync timestamp is updated
    And no database writes occur

  # --- Signature verification ---

  Scenario: Valid signature is accepted
    When Ward receives a sync response with a valid Ed25519 signature
    Then the entries are applied to the local database

  Scenario: Invalid signature is rejected
    When Ward receives a sync response with an invalid signature
    Then the entries are NOT applied to the local database
    And the developer sees a warning: "Threat DB sync failed: invalid signature"
    And the existing local database is preserved unchanged

  Scenario: Tampered data is rejected
    When Ward receives a sync response where the data has been modified after signing
    Then signature verification fails
    And the entries are NOT applied

  # --- Network failures ---

  Scenario: Network timeout during sync
    Given the sync server is unreachable
    When Ward attempts to sync the threat database
    Then the sync fails gracefully
    And the existing local database is preserved
    And the developer sees "ward: using cached threat data (last sync: <time ago>)"

  Scenario: Partial download (connection drops mid-sync)
    When the network connection drops during a sync download
    Then the partial data is discarded
    And the existing local database is preserved unchanged
    And Ward retries on the next sync interval

  Scenario: Server returns 500 error
    When the sync server returns a 500 error
    Then the sync fails gracefully
    And the existing local database is preserved

  # --- Sync scheduling ---

  Scenario: Free tier syncs every 15 minutes
    Given the user is on the free tier
    Then Ward syncs the threat database every 15 minutes

  Scenario: Pro tier syncs every 5 minutes
    Given the user is on the Pro tier
    Then Ward syncs the threat database every 5 minutes

  # --- Offline resilience (US-10) ---

  Scenario: Ward works offline with stale database
    Given the local threat database was synced 2 hours ago
    And the developer is offline
    When the developer installs a package
    Then Ward checks against the stale local database
    And protection still works for known threats in the DB
    And the developer does not see any sync errors during install

  Scenario: Ward status shows database age when offline
    Given the developer is offline
    And the last sync was 2 hours ago
    When the developer runs "ward status"
    Then the developer sees "last sync: 2 hours ago"
    And the developer sees "offline mode — local checks only"
