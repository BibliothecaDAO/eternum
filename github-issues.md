# GitHub Issues for Eternum

## Critical Issues

### Issue 1: Critical State Synchronization Problems

**Title**: Client frequently desyncs requiring constant refreshes **Labels**: `bug`, `critical`, `state-sync`
**Description**: Users are experiencing severe state synchronization issues that significantly impact gameplay.

**Steps to Reproduce**:

1. Play the game normally
2. Move armies and interact with structures
3. Observe that after actions, the client becomes unresponsive

**Current Behavior**:

- Client requires refresh after almost every action
- Numbers shown are out of sync
- Troops become uninteractable
- One user reports refreshing 10 times in 5 minutes
- Issue seems worse for users further from servers (Australia)

**Expected Behavior**: Client should remain in sync and responsive throughout gameplay

**Additional Context**:

- Not all users experience this equally - some have minimal issues
- May be related to distance from servers or local setup
- User with heavy system load (IPFS, multiple browser profiles) experiences more issues

---

### Issue 2: Troop Count Display Discrepancies

**Title**: Troop counts show different values across different UI panels **Labels**: `bug`, `critical`, `ui`
**Description**: Troop production and availability numbers are inconsistent across different parts of the UI.

**Current Behavior**:

- All troop production shows as negative
- World UI shows spare troops while other panels show negative
- Cannot add defense despite having troops
- Troops get stuck in "limbo" state

**Expected Behavior**: Consistent troop counts across all UI panels

**Screenshots**: (Reference screenshots from chat)

---

## High Priority Issues

### Issue 3: Army Movement Freeze/Memory Leak

**Title**: Game freezes when moving multiple armies simultaneously **Labels**: `bug`, `high`, `performance`,
`memory-leak` **Description**: Game freezes when moving armies, particularly when moving 3+ armies at once.

**Steps to Reproduce**:

1. Select 3 or more armies
2. Attempt to move them simultaneously
3. Game may freeze

**Current Behavior**:

- Complete freeze on movements
- Inconsistent - sometimes works with 6 armies, sometimes freezes with 3
- May be triggered by unloading and moving too quickly

**Expected Behavior**: Smooth movement of multiple armies without freezing

---

### Issue 4: Automation Features Not Working

**Title**: Production automation features failing **Labels**: `bug`, `high`, `automation` **Description**: Several
automation features are not functioning properly.

**Current Behavior**:

- "Produce once" automation doesn't work
- "Create max" not working
- Only "maintain balance" works

**Expected Behavior**: All automation options should function as intended

---

### Issue 5: UI Not Updating on Ownership Changes

**Title**: Structure ownership changes don't reflect in UI without refresh **Labels**: `bug`, `high`, `ui`, `state-sync`
**Description**: When structures change ownership, the UI doesn't update automatically.

**Current Behavior**:

- UI doesn't update when ownership changes
- Need to refresh to interact with changed structure
- Troops don't transfer automatically on UI

**Expected Behavior**: UI should update in real-time when ownership changes

---

### Issue 6: Resource Availability Detection Bug

**Title**: Town incorrectly reports insufficient resources for building **Labels**: `bug`, `high`, `resources`
**Description**: Towns report having no resources for military buildings when resources are actually available.

**Current Behavior**:

- Town perpetually thinks it has no resources
- Visual inspection shows sufficient resources

**Expected Behavior**: Accurate resource availability detection

---

### Issue 7: Travel Max Distance Error

**Title**: Error when attempting to travel maximum distance **Labels**: `bug`, `high`, `movement` **Description**:
Attempting to travel max distance results in an error.

**Screenshots**: (Two error screenshots mentioned in chat)

---

### Issue 8: Hyperstructure Victory Points Calculation

**Title**: Victory points not calculating correctly for Hyperstructures **Labels**: `bug`, `high`, `gameplay`
**Description**: Hyperstructures not awarding victory points correctly, with on-the-fly calculation being wrong.

---

## Medium Priority Issues

### Issue 9: Military Defense UI Confusing

**Title**: Military UI for setting up defenses needs improvement **Labels**: `enhancement`, `ui/ux`, `medium`
**Description**: Users find the military defense setup UI confusing and difficult to navigate.

**Suggestions**:

- Inner keep should be selected by default
- Instructions feel like part of the UI and need better separation
- Clearer indication of what can be interacted with

---

### Issue 10: Missing Resource Display on Production Screen

**Title**: Current resource levels not visible on production screen **Labels**: `enhancement`, `ui/ux`, `medium`
**Description**: Users cannot see current resource levels when making production decisions.

**Requested Feature**: Add a condensed resource pane showing current levels for fast decision making

---

### Issue 11: Defense Troop Count Not Visible

**Title**: Cannot see defense troop count from army window **Labels**: `enhancement`, `ui`, `medium` **Description**:
The army window doesn't show how many troops are currently in defense.

---

### Issue 12: Army Ownership Not Clear on World Map

**Title**: Cannot identify which city owns an army on world map **Labels**: `enhancement`, `ui`, `medium`
**Description**: No visual indication of which city an army belongs to when viewing the world map.

---

### Issue 13: Zoom Performance Issue

**Title**: Lag when zooming in/out **Labels**: `bug`, `performance`, `medium` **Description**: Users experience lag when
zooming.

**Workaround**: Zoom in first before zooming out

---

## Low Priority Issues

### Issue 14: City Names Not Shown in World View Hover

**Title**: Add city names to world view hover tooltip **Labels**: `enhancement`, `ui`, `low` **Description**: World view
hover should display the city name for better navigation.

---

### Issue 15: City Name Scrolls Off Screen

**Title**: City name should remain visible when scrolling **Labels**: `enhancement`, `ui`, `low` **Description**: City
name should float at the top of the screen instead of scrolling off.

---

### Issue 16: End Game Claim Window Access

**Title**: Cannot re-access claim window after closing **Labels**: `bug`, `ui`, `low` **Description**: If user
accidentally closes the claim window, they cannot get back to it.

**Suggestion**: Add a popup after game ends or make the claim window re-accessible

---

## Infrastructure Issues

### Issue 17: Deployment Script Reliability

**Title**: Deployment script overwrote production deployment **Labels**: `infrastructure`, `critical`, `devops`
**Description**: Deployment script went haywire and overwrote the deployment, causing game downtime.

**Action Required**: Review and improve deployment script safety checks

