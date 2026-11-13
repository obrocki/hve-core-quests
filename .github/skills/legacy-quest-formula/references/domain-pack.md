# Domain and generation contract

## Exemplar and naming

Use High Velocity Eagle Airlines (`HVE`) and EagleDesk 95 as the default fictional exemplar. `SystemName` is required and nonblank; adapt the title and supporting material consistently when it differs from EagleDesk 95. Use synthetic airline data only. Do not imply that fictional personas or scenarios are validated user research.

The core problem is an aging reservations workflow: flight search, temporary seat holds, hold expiry, overbooking policy, concurrency, and a deliberate race involving seat 14C. Keep the system recognizable as a legacy training environment rather than a production airline.

## Generated playground

Create the downstream files in the explicitly selected safe output destination, not in this skill repository. Make a plausible three-tier source layout with presentation, application, and data/persistence concerns. The frontend must still work locally and offline, using local synthetic fixtures or storage rather than depending on a server. A connected devcontainer runtime may be added as an optional exercise path, never as a prerequisite to opening or using the frontend.

Give the frontend a Windows 95 battleship-gray desktop appearance. Include generated documentation, twelve ordered quest briefs, visual persona and backlog artifacts, and an actual screenshot of the generated frontend. Keep the screenshot truthful to the generated result.

Use only open-source libraries, components, and frameworks. Include license notices and attribution in the generated output for dependencies and reused assets. Do not rely on unlicensed copied assets.

## Instruction-package boundary

This repository contains the formula and its Markdown guidance only. Do not add application code, executable generators or tests, runtime configuration, code templates, manifests, binary screenshots, generated-instance quest files, or a runnable reference app here. Historical Microsoft-stack source-only fossils may be requirements for downstream generated exercise material, not code retained in this skill package.
