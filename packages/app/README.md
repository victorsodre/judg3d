# @judg3d/app

Local interface and API for judg3d. Run `judg3d app` to start at 127.0.0.1:8787.
Includes the built UI and example profiles; works outside the monorepo.
Configure the CLI with `--port` and `--profiles`.

The interface, technical diagnostics and downloaded JSON are in English.
The interface does not store a language preference.

The API enforces upload, concurrency and processing limits. It is a local
service without public authentication. SCHEMA/PROFILE are checked; appearance
and geometry are not evaluated.
