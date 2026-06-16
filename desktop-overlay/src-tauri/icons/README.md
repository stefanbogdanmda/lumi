# Icons — Placeholder

This directory must be populated with real icon files before `tauri build` will succeed.

Run the following from the `desktop-overlay/` folder, pointing at a square PNG
(1024 x 1024 px recommended):

```bash
npm run tauri icon path/to/your-icon.png
```

Tauri will generate all required sizes and formats (`icon.png`, `icon.icns`, `icon.ico`,
etc.) and place them in this directory.

Until that is done, `tauri dev` will work (it does not require icons at dev time),
but `tauri build` will fail with a missing-icon error.
