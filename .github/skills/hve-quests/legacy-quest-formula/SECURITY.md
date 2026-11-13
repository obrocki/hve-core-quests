# Script safety

The generator copies local packaged training files into a caller-selected empty directory and substitutes constrained text inputs. It does not fetch packages or deploy services. Custom names require local Playwright and a browser to capture a truthful screenshot. The readiness script reads local files and writes a temporary generated instance; it removes only its own temporary directory. Do not use this intentionally flawed system with real data or expose it publicly.
