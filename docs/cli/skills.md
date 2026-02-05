# Skills

For information about skills, refer to [this documentation](https://developers.openai.com/codex/skills).

## Theoden skill requirements

Skills are reusable recipes that augment a run. They prefill prompts, perform tool steps, and optionally post-process results.

## Manifest shape

- name
- description
- commands
- required environment variables
- UI fields

## UX requirements

- Skills browser with Installed and Available sections.
- Skill detail view with permissions and config.
- Run with skill action from the composer.
- Downloadable skills should use app-server remote endpoints.

## Required first-class skills

- Yeet: stage, commit, push, and open a GitHub PR end-to-end.

## CLI-backed API mapping

- `skills/list` for installed skills (scoped by cwd).
- `skills/remote/read` for public downloadable skills (experimental).
- `skills/remote/write` to download a remote skill (experimental).
- `skills/config/write` to enable or disable a skill by path.

## Notes

- Remote skills endpoints are marked experimental in the CLI docs and should be feature-flagged.
