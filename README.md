# Prompt formatter

Paste or upload a prompt `.txt`. The page:

- moves a prompt that is stuck on the previous line (`1. …2. [HOOK]`) onto its own line
- adds a blank line between prompts
- adds the space in `3.[BUILD]` → `3. [BUILD]`
- removes batch headers such as `**Batch 4 of 11 (segments 91-120)**`

Copy the result or download it under the file name you type.

```bash
npm install
npm run dev
```
