# Contributing to DataForge AI

Thank you for your interest in contributing to DataForge AI! We welcome contributions from developers of all skill levels to help improve the platform.

To maintain code quality, security, and project history, please follow these guidelines when contributing.

---

## 🌿 Branching Strategy

We follow a Git Flow branching model. All work should target the appropriate branch:

* **`main`**: Represents production-ready code. Directly pushing to `main` is protected and restricted.
* **`develop`**: The main integration branch for active development. Features and bug fixes should be branched off and merged back into `develop`.
* **Feature Branches (`feature/your-feature`)**: Used for developing new features. Create feature branches off `develop`.
* **Bugfix Branches (`bugfix/issue-description`)**: Used for fixing bugs. Create bugfix branches off `develop`.
* **Release Branches (`release/x.y.z`)**: Used to prepare a new production release.

---

## 📝 Commit Guidelines

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification to ensure structured and readable project history:

Commit format: `<type>(<scope>): <description>`

### Common Types:
- `feat`: A new feature for the user (e.g., `feat(auth): add MFA support`)
- `fix`: A bug fix (e.g., `fix(api): handle missing database credentials`)
- `docs`: Documentation-only changes (e.g., `docs(readme): correct installation commands`)
- `style`: Changes that do not affect the meaning of the code (e.g., white-space, formatting)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build systems, configurations, or dependencies

---

## 🔀 Pull Request Process

1. **Fork the Repository**: Create your own fork and clone it locally.
2. **Synchronize**: Ensure your local `develop` branch is up to date with the upstream repository.
3. **Create a Branch**: Create a feature or bugfix branch.
4. **Develop & Test**: Implement your changes and verify that:
   - All tests pass locally.
   - The code is linted and properly formatted.
   - Frontend and backend builds compile successfully.
5. **Submit PR**: Open a Pull Request targeting the `develop` branch of the upstream repository.
6. **PR Description**: Include a clear explanation of:
   - What the change is.
   - Why it is necessary.
   - How to verify the change.
7. **Code Review**: At least one maintainer must review and approve the PR before merging.

---

## 🧪 CI/CD Requirements

Every Pull Request triggers automated GitHub Action workflows that must pass successfully before a merge is permitted.

### Backend Requirements
- **Formatting**: Checked using `ruff format --check src`
- **Linting**: Checked using `ruff check src`
- **Type Checking**: Verified using `mypy src`
- **Security Check**: Verified using `bandit` and `safety`
- **Unit & Integration Tests**: All Pytest cases must pass and generate code coverage.

### Frontend Requirements
- **Formatting & Linting**: Checked using ESLint (`npm run lint`)
- **Type Checking**: Checked using `npx tsc -b`
- **Security Scan**: Filesystem checked using Trivy scanner
- **Production Build**: Verified that `npm run build` runs without compilation warnings or errors.

### Docker Checks
- **Docker Compose**: Verified that `docker compose config` evaluates without formatting warnings.
- **Docker Images**: Trivy scans verify that no container images contain high or critical vulnerability findings.
