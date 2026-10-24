# Security Policy

## Supported Scopes

| Scope | Supported | Notes |
| ----- | :-------: | ----- |
| Web Application (`master` / GitHub Pages) | :white_check_mark: | Active live deployment |
| Data Pipeline & CI/CD Workflows | :white_check_mark: | GitHub Actions & Lambda scripts |
| Historical Data Snapshots (`data/`) | :x: | Archived static records (as-is) |

## Reporting a Vulnerability or Security Concern

The TPE-HoliPop project values web security and responsible disclosure. If you discover a security flaw (such as Cross-Site Scripting [XSS], secret/token leakage, or workflow vulnerabilities) or have a legitimate content concern, please report it responsibly.

### How to report

1. **GitHub Private Vulnerability Reporting (Preferred)**:
   Please report advisories via the **Security** tab of this repository under **Advisories** -> **Report a vulnerability**. This allows us to discuss and resolve the issue privately before public disclosure.

2. **Email**:
   If private vulnerability reporting is unavailable, you can contact the maintainer directly at the email listed on their [GitHub Profile](https://github.com/cain19811028).

**Please do not report security vulnerabilities through public GitHub issues.**

### What to expect

- **Acknowledgement**: You will receive an initial response within 48 hours acknowledging receipt of your report.
- **Assessment**: We will evaluate the impact and coordinate a timeline for releasing a fix or adjusting the data pipeline.
- **Credit**: If desired, we will credit your responsible disclosure in release notes when the patch is published.
