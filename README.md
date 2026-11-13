# HVE Core Legacy Quest Formula

This repository contains an instruction-only Copilot skill for creating a fictional legacy-modernization playground and twelve HVE Core learning quests. It intentionally contains no application, runnable generator, code template, or generated playground. A skill invocation creates those materials only in the safe destination explicitly selected by its caller.

## Install and invoke

The skill is already in GitHub Copilot's repository-skill layout at `.github/skills/legacy-quest-formula/SKILL.md`. Clone or open this repository in a Copilot-enabled workspace to make the repository skill available. To install it for personal use, copy the `legacy-quest-formula` skill directory to `~/.copilot/skills/legacy-quest-formula/`.

Invoke `/legacy-quest-formula` or ask Copilot to generate a playground with a **nonblank SystemName** and an **explicitly selected safe, new or empty output destination outside this repository**. Do not expect this repository to run or validate the generated playground. See [GitHub's agent skills documentation](https://docs.github.com/en/copilot/concepts/customizations/agent-skills) for skill layout and discovery.

The default fictional exemplar is High Velocity Eagle Airlines (`HVE`) and EagleDesk 95. The skill requires an offline-working Windows 95 battleship-gray frontend, synthetic data, an optional connected devcontainer runtime, attributed open-source dependencies, generated documentation and graphical assets, a real frontend screenshot, and twelve ordered exercises. Start with the [skill instructions](.github/skills/legacy-quest-formula/SKILL.md).

## License

This instruction package is available under the [MIT License](LICENSE).
