# SYS-001: Local MariaDB test environment — cross-PC handoff

**Updated:** 2026-11-04 (Philippines time)  
**Status:** Home PC standalone MariaDB system tables initialized successfully, but server **not yet started** and administrator password **not yet configured**. Office PC setup remains separate and incomplete. No SYS-001 application test database/user created; PHPUnit **not run**.  
**Git branch:** `feature/sys-001-address-ownership`; **draft PR:** https://github.com/pluyto3/Api-e-commerceProj/pull/3  
**Scope:** Non-sensitive notes for resuming on another computer. These notes do **not** sync local MariaDB files, configuration, databases, or credentials.

## SYS-001 code progress (already pushed)

- Customer-owned address read/update/delete operations were scoped to authenticated bearer-token user's `user_id`.
- Regression test added at `BackEnd/tests/Feature/LocationAuthorizationTest.php`.
- Fresh Codex review found a request-helper defect; the low-level `call()` was replaced with `put()`/`post()` in commit `20f9eb4a0f8b5f9789c4f486cd677aec2c2311a6`.
- PHP syntax checks passed as previously reported, but **no PHPUnit or database-backed regression test has executed**.
- Unrelated pre-existing default-address concern is recorded separately as proposed SYS-004 in `docs/BACKLOG.md`.
- PR #3 must remain **draft/unmerged** until isolated regression evidence and human acceptance. No deployment approved.

## Most recent checkpoint: Home PC (2026-11-04)

**Owner-provided PowerShell evidence, not independently executed by ChatGPT or Codex:**

- Home project folder: `C:\xampp\htdocs\Api-e-commerceProj`. On feature branch, user fast-forwarded from commit `50268c3` to `8d323f4` and received the cross-PC handoff.
- Downloaded `mariadb-11.4.13-winx64.zip`, size **95,024,126 bytes**. SHA-256 computed as `D62986D433EEEBFDE218560B276103831604A61E929E87F1A17F5AEBD80257E2` and matched the checksum previously supplied; independently confirm the checksum with the official distribution for any additional download.
- Extracted ZIP to `%LOCALAPPDATA%\HanzGo\SYS001-MariaDB\mariadb-11.4.13-winx64` on the Home PC. Verified the four executables `mariadbd.exe`, `mariadb-install-db.exe`, `mariadb.exe`, `mariadb-admin.exe`.
- Created local `logs` and `tmp` folders. Original `sys001-bootstrap.ini` used unsupported shared-memory options; first initialization failed. Error log identified unrecognized `--shared-memory` and `shared-memory-base-name`. **Do not reuse the old bootstrap configuration.**
- Created corrected `sys001-namedpipe.ini` with `skip-networking`, `named-pipe`, `socket=HanzGoSYS001Bootstrap`, dedicated basedir/datadir/tmpdir and local error log; server option validation exited 0 and confirmed `named-pipe=TRUE`, `skip-networking=TRUE`, correct unique socket name.
- The failed initialization had left an empty `data` directory. After confirming it empty, a **one-time retry** using `mariadb-install-db.exe --datadir=<dedicated data> --port=33307 --config=<corrected ini> --skip-networking` reported: "Creation of the database was successful", **exit code 0**.
- **No subsequent user-run startup or administrator password commands have been reported.** The Home PC server is not verified running; avoid claiming root authentication is secured. Do **not** repeat initialization on that data directory.
- Two pre-existing `mysqld.exe` processes were previously observed on Home PC. Do not stop, modify or reconfigure them.

**Next action if resuming on Home PC:** independently verify current process state, then securely start the already-initialized standalone instance with TCP disabled and establish administrator authentication via its named pipe. Validate carefully before enabling TCP. Test DB/user creation, migrations and PHPUnit remain separate stages requiring authorization.

**Next action if resuming on Office PC:** the Home PC's initialized `data` and `sys001-namedpipe.ini` do **not** appear on the Office PC via GitHub. The Office PC only previously confirmed ZIP extraction and executable presence; `logs`/`tmp` state was not subsequently confirmed. Inspect Office paths and running services read-only, then configure and initialize a **new Office-local** standalone instance through the supported named-pipe bootstrap procedure. Do not assume earlier Office state includes Home work; do not copy or commit `data`, configs or credentials.

## Office PC: last owner-confirmed MariaDB checkpoint

The owner reported or showed the following actions in PowerShell on the Office PC:

1. Downloaded the official **MariaDB 11.4.13 Windows x86_64 ZIP**, named `mariadb-11.4.13-winx64.zip`; file size reported as 95,024,126 bytes.
2. Computed SHA-256 using `Get-FileHash`; the result matched the release checksum previously checked:
   `D62986D433EEEBFDE218560B276103831604A61E929E87F1A17F5AEBD80257E2`.
   The release checksum must be reverified through the official distribution source for any new download.
3. Extracted the ZIP under `%LOCALAPPDATA%\HanzGo\SYS001-MariaDB\mariadb-11.4.13-winx64`, outside the repository and XAMPP.
4. Verified that these four extracted binaries exist: `mariadbd.exe`, `mariadb-install-db.exe`, `mariadb.exe`, and `mariadb-admin.exe` (all `Test-Path` returned True).
5. Ran `mariadb-install-db.exe --help`, confirming support for `--datadir`, `--port`, `--config`, `--password`, and `--skip-networking`.
6. Owner's read-only port/process check reported no match on TCP port `33307`, `mysqld.exe`, or `mariadbd.exe` at that time. The Codex execution context could not reproduce all process checks due to access restrictions.

**Not confirmed completed:** Creating `logs`/`tmp` folders from the most recent suggested PowerShell command. Check their existence first. Do not assume they are absent or create/delete over existing data.

**Not performed or verified:** writing a MariaDB config file, creating/initializing a data directory, establishing secure administrative authentication, starting a MariaDB process, creating a test schema or account, editing `.env.testing`, migrations, database connections, PHPUnit, or deployment. The Office PC's earlier application `.env` is **not** a test-environment configuration.

## Resume safely on the home PC

1. Confirm a clean local Git working tree. Sync from GitHub (not from Office PC files):
   ```powershell
   git fetch origin
   git switch feature/sys-001-address-ownership
   git pull --ff-only origin feature/sys-001-address-ownership
   git status
   ```
   If the branch does not exist locally, use `git switch --track origin/feature/sys-001-address-ownership` instead. Do not switch with uncommitted changes.
2. Read `AGENTS.md`, `docs/HANDOFF.md`, `docs/TESTING.md`, and this file.
3. **MariaDB files are NOT stored in Git.** The downloaded ZIP and extracted folder exist only on the Office PC unless independently obtained on the home PC. Do not copy database data, credentials, private configs, ZIPs or binaries into the Git repository.
4. Inspect the home PC's local permissions, existing MariaDB/MySQL/XAMPP services, and port availability independently; Office PC findings do not establish home PC isolation.
5. If the portable MariaDB package is needed on the home PC, download from the official distribution source, verify its exact release checksum, and use new isolated local paths. Never overwrite existing installations or reuse an active data directory.
6. Continue the **staged secure bootstrap plan**. Before initialization or startup, review how to set administrative authentication securely without putting a password on the command line or exposing a passwordless TCP listener. Do not run an unreviewed `mariadb-install-db.exe --password=...` command, and do not automatically apply a prior manual guide's passwordless-first-start step.
7. Stop after the next small step and report its actual output. Creating the disposable SYS-001 database/user, test-only environment variables, Laravel migrations, and PHPUnit execution still require their own safety verification and approval.

## Safety boundary

- No modifications to existing XAMPP databases, services or application data.
- No production credentials, .env contents, passwords or tokens in GitHub or chat.
- No `vendor`, ZIP, MariaDB binaries, `data`, logs, `sys001.ini`, `sys001-bootstrap.ini`, or `.env.testing` committed to the repository.
- No migrations, seeders, resets or PHPUnit against an unknown database.
- Draft PR #3 remains unmerged and undeployed until the owner approves after verified tests.

## Notes for the next ChatGPT/Codex session

The owner asked to pause the Office PC setup and continue from the home PC. Treat this file as a **progress snapshot**, not proof that the new database server exists or is safe. First check local Git sync and local environment status; then continue only the next approved MariaDB setup step.
