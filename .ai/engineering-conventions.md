# Engineering Conventions

- Preserve public behavior and contracts unless the task explicitly changes them.
- Prefer the simplest implementation that satisfies the acceptance criteria.
- Run targeted checks for the changed boundary and report what was not verified.

## Existing code style and boundaries

- Use the existing pnpm scripts in `package.json`; the Android wrapper has its own `capacitor/package.json`.
- Application components use Vue single-file components with `<script setup lang="ts">`, typed props/emits, and Nuxt auto-imported reactivity/composables. Match surrounding double quotes, semicolons, and two-space indentation.
- Types live in `app/types/`; existing interfaces use `I` prefixes and type aliases use `T` prefixes. Application imports use the `~/` alias into `app/`.
- Keep domain functions in `app/utils/mileage.ts` independent of UI/storage. Keep pixel algorithms separate from browser canvas/worker orchestration.
- Route application mutations through `useCarData()` so persistence, reactive state, reading order, and widget snapshots remain coordinated.
- Browser APIs belong in client-side execution paths. `useCarData.load()` is client-guarded; loading is triggered from the page's `onMounted` hook.
- UI styles are centralized in `app/assets/css/main.css`; there is no component library or separate state-management dependency.
- Revoke temporary image object URLs and release worker/observer resources when changing capture/crop lifecycle code.

## Generated files and validation

- Do not hand-edit `.nuxt/`, `.output/`, `node_modules/`, or generated `public/ocr/`; these are ignored. OCR asset changes belong in the preparation script/dependencies.
- Android build/cache directories and Capacitor-copied web assets/generated Cordova files are ignored by `.gitignore`. `capacitor/android/capacitor.settings.gradle` remains tracked despite regeneration; review its plugin-project changes. Native Kotlin/resources and `capacitor/pnpm-lock.yaml` remain versioned.
- No dedicated lint or formatter script is declared. Do not claim such checks ran.
- Select commands and manual checks from `.ai/verification.md`. Documentation-only changes need route/link/source accuracy checks, not an automatic application rebuild.
- Preserve unrelated working-tree changes. Never add credentials or real cloud identifiers to context or configuration.
