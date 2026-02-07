# 21 - Gaps And Open Questions

## Missing sourcemaps

- 451 sourcemap directives are unresolved in distributed artifacts.
- Some renderer internals remain minified-only and are inferred by behavior.

## Not fully mapped to upstream source modules

- This map is artifact-level, not original module-level source reconstruction.
- Symbol names in bundles are compiler-generated in many areas.

## Areas that would benefit from runtime replay

- full approval UX with both command and file edit variants
- cross-window overlay race behavior
- host provider refresh edge cases under SSH/Brix hosts
- Sparkle updater branches in non-dev builds

## Native/Tauri parity mappings still marked TBD upstream

`unfinished-signal-parity-map.md` indicates parity-equivalent mapping work remains for several audited signals.
