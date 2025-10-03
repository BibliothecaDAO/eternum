# Eternum Bug Analysis from Chat Log

## Performance Issues

### 1. Movement Freeze / Memory Leak

- **Reporter**: Lord_kb
- **Description**: Game freezes when moving armies, especially when moving 3 armies at once
- **Symptoms**:
  - Complete freeze on movements
  - Sometimes works fine with 6 armies, sometimes freezes
  - May be related to unloading and moving too fast
- **Severity**: High
- **Notes**: Loaf identified this as a memory leak issue

### 2. Zoom Lag Issue

- **Reporter**: Lord_kb
- **Description**: Lag when zooming
- **Workaround**: Zoom in first before zooming out
- **Severity**: Medium

### 3. Client Performance Degradation

- **Reporter**: recipromancer
- **Description**: Client gets "out of state" eventually, though takes longer now than before
- **Severity**: Medium
- **Additional Context**: User in Australia (further from servers) experiencing frequent desyncs

## UI/UX Issues

### 4. Resource Levels Not Visible on Production Screen

- **Reporter**: recipromancer
- **Description**: Cannot see current resource levels when making production decisions
- **Request**: Need condensed resource pane for fast decision making
- **Severity**: Medium

### 5. Defense Troop Count Not Visible

- **Reporter**: Lord_kb
- **Description**: Cannot see how many troops are in defense from the army window
- **Severity**: Medium

### 6. City Name Scrolls Off Screen

- **Reporter**: recipromancer
- **Description**: City name should float at the top without scrolling off screen
- **Severity**: Low

### 7. World View Hover Missing City Names

- **Reporter**: recipromancer
- **Description**: World view hover should show the city name
- **Severity**: Low

### 8. Army Ownership Not Clear on World Map

- **Reporter**: recipromancer
- **Description**: Cannot see which city an army belongs to on the world map
- **Severity**: Medium

### 9. Military UI Confusing

- **Reporter**: recipromancer
- **Description**:
  - Military UIs for setting up defenses are confusing
  - Instructions feel like part of the UI
  - Inner keep should be selected by default
- **Severity**: Medium

## Functionality Bugs

### 10. Automation Not Working

- **Reporter**: Lord_kb
- **Description**:
  - "Produce once" automation doesn't work
  - Only "maintain balance" works
  - "Create max" not working
- **Severity**: High

### 11. Travel Max Distance Bug

- **Reporter**: Lord_kb
- **Description**: Error when trying to travel max distance (shows two error screenshots)
- **Severity**: High

### 12. Resource Availability False Negative

- **Reporter**: recipromancer
- **Description**: Town perpetually thinks it has no resources to make military building, but actually has enough
- **Severity**: High

### 13. Troop Count Discrepancy

- **Reporter**: recipromancer
- **Description**:
  - All troop production shows negative and recovering to 0
  - World UI shows spare troops, but everywhere else shows negative
  - Cannot add defense but can create attack army
  - Troops stuck in limbo
- **Severity**: Critical

### 14. UI Not Updating on Ownership Changes

- **Reporter**: recipromancer, defiedpiper
- **Description**:
  - UI doesn't update when ownership changes
  - Need to refresh to interact with changed structure
  - Troops don't transfer automatically on UI (transfers after refresh)
- **Severity**: High

### 15. Hyperstructure Victory Points Bug

- **Reporter**: defiedpiper, credence
- **Description**:
  - HS not giving VP correctly
  - On-the-fly calculation of points is wrong
- **Severity**: High

## State Synchronization Issues

### 16. Frequent Client Desync

- **Reporter**: recipromancer
- **Description**:
  - Have to refresh 10 times in 5 minutes
  - Make one move on map and have to refresh to move again
  - Numbers out of sync
  - Troops uninteractable
  - Gets out of sync very fast
- **Severity**: Critical
- **Notes**: Other players (defiedpiper, credence) not experiencing same level of issues

## Infrastructure Issues

### 17. Deployment Script Overwrote Deploy

- **Description**: Deployment script went haywire and overwrote the deploy, causing downtime
- **Severity**: Critical

## Environment-Specific Issues

### 18. High Memory Usage with Multiple Apps

- **Reporter**: recipromancer
- **Context**: Running IPFS client, 6 browser profiles, and Pistols (which has 5GB memory leak)
- **Severity**: Medium

## End Game Issues

### 19. Claim Window Access

- **Reporter**: squiddy
- **Description**: Accidentally got out of window and couldn't get back in
- **Suggestion**: Maybe a popup after game ended
- **Severity**: Low

