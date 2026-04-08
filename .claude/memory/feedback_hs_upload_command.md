---
name: hs_upload_command
description: Correct HubSpot CLI upload command to use
type: feedback
---

Always use `hs cms upload` instead of `hs upload` when providing HubSpot deploy commands.

**Why:** The user's HubSpot CLI version requires `hs cms upload`.

**How to apply:** Any time a deploy command is given, format it as:
```bash
hs cms upload "<module-folder>" "<module-folder>"
```
