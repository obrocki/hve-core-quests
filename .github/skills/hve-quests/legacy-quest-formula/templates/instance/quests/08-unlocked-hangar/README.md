# 08 · Unlocked Hangar

**Briefing:** A security review of a training system must distinguish its executable attack surface from archived code.

**HVE Core:** Security Planner and Security Reviewer (OWASP).

**Objective:** Build a threat model and prioritize evidence-backed findings including the source-only lookup, fake credential bait and legacy password hashing. Explain scope, impact, mitigations and verification without using real credentials.

**Hints:** 1. Inspect the historical sources and Web.config. 2. Determine which components actually run. 3. The security memo carries the marker.

**Check:** Submit the marker value to `Test-QuestFlag.ps1 -Quest 8 -Flag '<value>'`.
