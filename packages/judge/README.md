# @judg3d/judge

judg3d SCHEMA/PROFILE engine using the official Khronos glTF Validator.
Diagnostics and report fields are in English, independently of UI language.

```js
import { loadProfile } from "@judg3d/core";
import { judgeIsolated, readAsset } from "@judg3d/judge";
const report = await judgeIsolated({
  asset: await readAsset("model.glb"),
  profile: await loadProfile("profile.json"),
  options: { judg3dVersion: "0.1.0" },
});
```

`judgeIsolated` accepts timeoutMs (default 30000) and AbortSignal in its second
argument. `judge` runs in the calling process without worker limits.
PASS is limited to the layers listed in coverage.ran.
