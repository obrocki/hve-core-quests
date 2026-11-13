# 07 · Seat 14C

**Briefing:** Two passengers were promised 14C. The application team says the seat lock makes that impossible.

**HVE Core:** root-cause-analysis; optionally performance-slo-planner and telemetry-foundations.

**Objective:** Explain a concrete concurrent interleaving, causal mechanism and evidence limitations; distinguish race reproduction from inference. Propose a regression test that fails before repair and respects hold expiry.

**Hints:** 1. Compare both branches of the hold function. 2. What happens between checking for a live hold and inserting it? 3. The marker is beside the database clue.

**Check:** Submit the marker value to `Test-QuestFlag.ps1 -Quest 7 -Flag '<value>'`.
