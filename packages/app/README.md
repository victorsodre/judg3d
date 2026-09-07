# @judg3d/app

Local interface and API for judg3d. Run `judg3d app` to start at 127.0.0.1:8787.
Includes the built UI and example profiles; works outside the monorepo.
Configure the CLI with `--port` and `--profiles`.

English is the default. Choose **Português (Brasil)** in the Language selector;
the preference persists in this browser. Switching languages preserves the
current analysis. Technical diagnostics and downloaded JSON remain in English.

The API enforces upload, concurrency and processing limits. It is a local
service without public authentication. SCHEMA/PROFILE are checked; appearance
and geometry are not evaluated.
