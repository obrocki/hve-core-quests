# 09 · Contraband Cargo

**Briefing:** The contractor inventory contains old package versions and an absent binary reference.

**HVE Core:** SSSC Planner/Reviewer and Dependency Reviewer.

**Objective:** Inventory actual dependencies, provenance and licenses, distinguish missing artifacts from shipped binaries, and propose a prioritized supply-chain remediation plan. Include evidence and unknowns instead of assuming every old dependency is vulnerable.

**Hints:** 1. Inspect package manifests, WebForms Dockerfile and VB6 project. 2. Check both CSS and bundled font licenses. 3. Find the supply-chain memo marker.

**Check:** Submit the marker value to `Test-QuestFlag.ps1 -Quest 9 -Flag '<value>'`.
