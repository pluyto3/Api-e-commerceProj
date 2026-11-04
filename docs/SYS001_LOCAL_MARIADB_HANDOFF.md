# SYS-001: Local MariaDB test environment — cross-PC handoff

**Updated:** 2026-11-05 (Philippines time)
**Status:** Home PC isolated MariaDB and restricted TCP login verified, local Composer dependencies installed without scripts/plugins (exit 0), PHPUnit not run. Office PC MariaDB initialized and secured, test database/user created, separate TCP config prepared but not yet activated. Both machines' data and credentials remain strictly local.
**Git branch:** `feature/sys-001-address-ownership`; **draft PR:** https://github.com/pluyto3/Api-e-commerceProj/pull/3  
**Scope:** Non-sensitive notes for resuming on another computer. These notes do **not** sync local MariaDB files, configuration, databases, or credentials.

## Latest checkpoint: Home PC completed steps (2026-11-04, owner-reported)

- Repo `C:\xampp\htdocs\Api-e-commerceProj` synced on feature branch to commit `a3fe6ae`, clean tree before/after previous sync; this handoff commit is newer.
- Standalone MariaDB 11.4.13 successfully started with `sys001-namedpipe.ini`, `skip-networking=1`, named pipe `HanzGoSYS001Bootstrap`. Root initially allowed passwordless connection. Owner changed `root@localhost` password via explicit pipe without CLI password string; verified authenticated login, `@@skip_grant_tables=0`, correct datadir, exit 0.
- Removed Home-only extra root accounts `root@127.0.0.1`, `root@::1`, `root@desktop-fv5jndl`, retaining password-protected `root@localhost`; exit 0.
- Created `hanzgo_sys001_test` database, utf8mb4 / utf8mb4_unicode_ci. Created distinct password-protected `hanzgo_sys001@127.0.0.1`; read-only audit reported database privileges SELECT/INSERT/UPDATE/DELETE/CREATE/DROP/ALTER = Y, global SUPER/GRANT/CREATE_USER = N. **Important:** these DB and username names were later found **incompatible** with the test guard requiring `hanzgo_sys001_test_<suffix>` and a username beginning `hanzgo_sys001_test`; do not weaken guard. Create separate explicitly approved disposable names later, with compatible credentials.
- Created `sys001-tcp.ini` preserving loopback `127.0.0.1`, port `33307`, named-pipe enabled and isolated datadir; removed `skip-networking`. Options validated (`bind-address=127.0.0.1`, `port=33307`, `skip-networking=FALSE`, `named-pipe=TRUE`). Normal startup produced listener 127.0.0.1:33307, process initially 19824. Read-only verification checked listener owned by isolated `mariadbd.exe`, authenticated as `hanzgo_sys001@127.0.0.1` to `hanzgo_sys001_test`, port 33307, correct datadir and `@@skip_grant_tables=0`, exit 0. Live process state must be rechecked after switching PCs.
- Home PHP CLI `C:\xampp\php\php.exe` 8.2.12. `C:\xampp\php\php.ini`; `pdo_mysql` loaded; `sodium` is installed but not globally enabled. Verified temporarily loading Sodium via `php -d extension=sodium --ri sodium`, exit 0. Composer `check-platform-reqs --lock` with temporary Sodium passed, exit 0. Initially no `BackEnd/.env`, `.env.testing`, `vendor/autoload.php` or config cache.
- **Most recent Composer run:** in `BackEnd`, used `C:\xampp\php\php.exe -d extension=sodium` with `composer.phar install --no-plugins --no-scripts --no-interaction --prefer-dist --no-progress`. Output: 138 installs, no updates/removals. ZIP extension and unzip/7z missing; Composer fell back to Git source downloads. It completed `Generating optimized autoload files`, with ambiguous-class warnings in Flysystem local and Pint's AppServiceProvider, reported **installation exit code 0**, `BackEnd/vendor/autoload.php=True`, and clean `git status --short`. **No PHPUnit run** and no Laravel commands/migrations executed. Don't infer runtime compatibility from install success.
- **Home next task:** only after confirming actual environment state, create a new guard-compatible disposable test DB/account, set up test-only credentials and environment, safely inspect effective Laravel DB target and migrations; only then run focused SYS-001 PHPUnit. Existing `hanzgo_sys001_test` and account need not be removed or repurposed. No credentials should be committed.

## Immediate switch back to Office PC (2026-11-05)

The Office PC is **behind** Home in *PHP dependency progress*, but ahead of Home in the prior cross-PC account setup timeline. Independent Office MariaDB was initialized and secured, with database `hanzgo_sys001_test` and restricted `hanzgo_sys001@127.0.0.1`; `sys001-tcp.ini` had been created and `--print-defaults` checked, **but full options validation, stop/restart for TCP, restricted user TCP login, and any Laravel tests remain unverified**. Office earlier had PHP 8.4.8 and `BackEnd/vendor/autoload.php` already present, but these observations were made in an earlier session; recheck the current Office state.

To resume: check Office Git status, fetch/pull this handoff on feature branch if clean, and inspect Office `mariadbd.exe` command line and local port 33307 **read-only**. If the Office TCP configuration is still not active, proceed from the previously requested read-only `sys001-tcp.ini` validation; don't reinitialize, reset root or recreate existing accounts. Do not copy Home DB files, `vendor` or secrets to Office. Maintain PR #3 as draft; no merge, deploy or migrations without verified test isolation.

## Latest checkpoint: Office PC completed steps (2026-11-04, owner-reported)

- Office repo folder: `C:\xampp\htdocs\e-commerce`. Synced feature branch to commit `ef9e7da` with clean working tree before pull.
- Office portable MariaDB 11.4.13 at `%LOCALAPPDATA%\HanzGo\SYS001-MariaDB\mariadb-11.4.13-winx64`. Created isolated `logs` and `tmp` directories, and **one-time initialized** dedicated `data` directory successfully (exit 0).
- `sys001-namedpipe.ini` created and validated; `named-pipe=TRUE`, `socket=HanzGoSYS001Bootstrap`, `skip-networking=TRUE`, port configured 33307 but TCP disabled. Server eventually started in normal mode (not grant-table recovery), initial process 8028; owner verified authenticated `root@localhost` with `@@skip_networking=1`, `@@skip_grant_tables=0`, and correct isolated datadir; exit 0.
- Authentication recovery was performed because ordinary root password login initially failed. Recovery used local-only named pipe + `--skip-grant-tables`; SQL `FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED BY ...`; SQL command exited 0. Owner restarted normally and verified password-protected root login. **Never reuse the Office administrator password as Home password.**
- Audit found extra root accounts `root@127.0.0.1`, `root@::1`, `root@desktop-67q9kak` with empty credential strings; they were explicitly dropped from the isolated Office MariaDB. Follow-up query showed only `root@localhost`; exit 0. No anonymous accounts appeared.
- Created isolated database `hanzgo_sys001_test`, collation `utf8mb4_unicode_ci`; exit 0. Created `hanzgo_sys001@127.0.0.1` with a distinct password and granted database-level privileges on `hanzgo_sys001_test.*`. Follow-up read-only audit showed database privileges Y for SELECT/INSERT/UPDATE/DELETE/CREATE/DROP/ALTER, and no global SUPER/GRANT/CREATE USER privileges; exit 0. **Do not copy passwords.**
- Created separate `sys001-tcp.ini` from the named-pipe config by removing `skip-networking`, preserving `bind-address=127.0.0.1`, `port=33307` and the isolated datadir. `mariadbd --print-defaults` inspection passed. **Not yet run:** the read-only `--verbose --help` verification (Step 22), server shutdown/restart with TCP config, restricted-user TCP login, `.env.testing` configuration, Laravel migrations or PHPUnit.
- Reported Office PC server was running in named-pipe-only normal mode as of last verification; do not assume it remains running after PC changes. Draft PR #3 remains unmerged.

**Resume on Home PC:** Home PC MariaDB is a separate instance, initialized but not confirmed running or secured. First sync the Git branch, then perform only read-only checks of `%LOCALAPPDATA%\HanzGo\SYS001-MariaDB`, process command lines, and port 33307; do not initialize again. Existing Home PC `mysqld.exe` processes were previously seen; do not stop or alter them. After inspection, start the dedicated Home instance using **its own** `sys001-namedpipe.ini`, not Office files or passwords. Secure Home root over the exact named pipe before local TCP/test-database setup.

**Resume on Office PC later:** Proceed from Step 22 validating `sys001-tcp.ini`; then controlled restart and restricted-user TCP verification. Do not assume that the TCP configuration is already active.

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

**Current Office PC continuation:** See the latest Office checkpoint above; earlier extraction-only notes below are historical and superseded. Do not copy or commit `data`, configs or credentials.

## Office PC: historical initial extraction checkpoint (superseded by latest steps)

The owner reported or showed the following actions in PowerShell on the Office PC:

1. Downloaded the official **MariaDB 11.4.13 Windows x86_64 ZIP**, named `mariadb-11.4.13-winx64.zip`; file size reported as 95,024,126 bytes.
2. Computed SHA-256 using `Get-FileHash`; the result matched the release checksum previously checked:
   `D62986D433EEEBFDE218560B276103831604A61E929E87F1A17F5AEBD80257E2`.
   The release checksum must be reverified through the official distribution source for any new download.
3. Extracted the ZIP under `%LOCALAPPDATA%\HanzGo\SYS001-MariaDB\mariadb-11.4.13-winx64`, outside the repository and XAMPP.
4. Verified that these four extracted binaries exist: `mariadbd.exe`, `mariadb-install-db.exe`, `mariadb.exe`, and `mariadb-admin.exe` (all `Test-Path` returned True).
5. Ran `mariadb-install-db.exe --help`, confirming support for `--datadir`, `--port`, `--config`, `--password`, and `--skip-networking`.
6. Owner's read-only port/process check reported no match on TCP port `33307`, `mysqld.exe`, or `mariadbd.exe` at that time. The Codex execution context could not reproduce all process checks due to access restrictions.

**Historical note, now superseded:** Initially, `logs`/`tmp` folders had not yet been created. The owner later completed this successfully, as documented above.

**Historical note, now superseded:** The Office config, initialization, administrator auth, test database and restricted account have since been completed as recorded above. `.env.testing`, migrations, PHPUnit and deployment remain unperformed. The Office PC's earlier application `.env` is **not** a test-environment configuration.

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
3. **MariaDB files are NOT stored in Git.** Both Office PC and Home PC independently extracted the ZIP and initialized their own MariaDB installations. Do not copy database data, credentials, private configs, ZIPs or binaries into Git.
4. Inspect the home PC's local permissions, existing MariaDB/MySQL/XAMPP services, and port availability independently; Office PC findings do not establish home PC isolation.
5. If the portable MariaDB package is needed on the home PC, download from the official distribution source, verify its exact release checksum, and use new isolated local paths. Never overwrite existing installations or reuse an active data directory.
6. Continue the **staged secure bootstrap plan**. Home PC initialization is already complete, so **do not run `mariadb-install-db` there again**. Before starting, verify process state and named-pipe-only config. Then establish administrator authentication safely over its unique named pipe without putting passwords on the command line or exposing a passwordless TCP listener.
7. Stop after the next small step and report its actual output. Creating the disposable SYS-001 database/user, test-only environment variables, Laravel migrations, and PHPUnit execution still require their own safety verification and approval.

## Safety boundary

- No modifications to existing XAMPP databases, services or application data.
- No production credentials, .env contents, passwords or tokens in GitHub or chat.
- No `vendor`, ZIP, MariaDB binaries, `data`, logs, `sys001.ini`, `sys001-bootstrap.ini`, or `.env.testing` committed to the repository.
- No migrations, seeders, resets or PHPUnit against an unknown database.
- Draft PR #3 remains unmerged and undeployed until the owner approves after verified tests.

## Notes for the next ChatGPT/Codex session

The owner asked to pause the Office PC setup after creating (but not activating) `sys001-tcp.ini`, and continue from the Home PC. Treat this file as a **progress snapshot**, not proof of any Home PC server process or auth state. First check local Git sync and Home PC environment status; then continue only the next approved MariaDB step.
