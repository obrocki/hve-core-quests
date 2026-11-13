# 12 · Final Approach

**Briefing:** Close the 14C incident without erasing its history.

**HVE Core:** RPI implement, Code Review, pull-request skill and Engagement Report Generator.

**Objective:** On a separate exercise branch, implement a concurrency-safe fix, test competing requests and expired holds against PostgreSQL, review the change, and draft a board report with evidence and residual risks. A pull request is optional and requires the player's authorization.

**Hints:** 1. Serialize every seat on the same inventory row. 2. Test overlapping transactions and expiry. 3. Mags's final note contains your marker.

**Check:** Submit the marker value to `Test-QuestFlag.ps1 -Quest 12 -Flag '<value>'`; the flag alone does not prove a fix or review.
