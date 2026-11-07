## Translations

We welcome community translations! Adding a new language or updating an existing one requires only editing translation files—no TypeScript or application code changes are needed.

### Adding a new language

1. **Create the locale file**: Copy `src/i18n/locales/en.json` to `src/i18n/locales/<language-code>.json` using standard BCP 47 language codes (for example, `de.json`, `fr.json`, `pl.json`, `ru.json`).
2. **Set the language name**: Update the `"languageName"` key to the native name of your language (for example, `"Deutsch"`, `"Français"`, `"Polski"`). This name appears in the application's language selector.
3. **Translate values**: Translate the string values into your language. Keep keys in English unchanged.
4. **Preserve interpolation placeholders**: Any placeholders inside curly brackets (such as `{count}`, `{title}`, `{path}`, `{status}`) must remain exactly as they appear in `en.json` so the application can insert dynamic values properly.
5. **Add plural variants**: Use CLDR plural category suffixes (`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`) for your language. For any plural group (such as `posts`, `likes`, `downloadsCount`, `installedFiles`), your locale must provide at least the `_other` variant. Additional variants like `_few` or `_many` can be added if your language requires them.
6. **Partial translations are supported**: If you do not translate every key right away, missing keys automatically fall back to English.
7. **Verify your translation**: Run the locale checker from your terminal:
   ```bash
   pnpm check:locales
   ```
   This script ensures that all required keys and placeholders match `en.json` and reports any syntax or placeholder mismatches.
