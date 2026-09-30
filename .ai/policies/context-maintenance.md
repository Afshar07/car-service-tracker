# Context maintenance

- Keep Markdown context discoverable and authoritative.
- Update routing when project ownership, paths, or workflow boundaries change.
- Keep cross-session task state in the selected project's `ongoing/` directory and list each active task in its `README.md`.
- Read only the ongoing task matching the current work; do not use a global current-task pointer.
- Move durable decisions into focused guidance when a task finishes, then remove its ongoing entry and task document.
- Do not introduce generated routing JSON or history directories into this scaffold.
- Keep `.ai/README.md` routes aligned with focused documents. Shared scope belongs in `.ai/workspace.md` and `.ai/projects/car-service-tracker.md`; implementation details belong in the selected focused document.
- Anchor implementation claims to workspace-relative source paths and named functions/types. Prefer durable references over line numbers that drift.
- Distinguish implemented behavior from proposals. `docs/cloud-sync-plan.md` remains deferred unless explicit approval changes its status.
- When source and older documentation disagree, record the discrepancy and source evidence; do not invent behavior or silently change unrelated documentation.
- Do not preserve a template checksum on an edited context file as though it still described its contents.
