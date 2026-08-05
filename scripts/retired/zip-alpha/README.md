# Retired ZIP alpha tools

These files belong to the retired ZIP alpha distribution flow. They are kept for historical review only and are not production packaging entry points.

- `create_alpha_release.py`
- `create_update_package.py`
- `start-windows.bat`
- `stop-windows.bat`
- `start-macos.command`
- `stop-macos.command`

The current Runtime assembler remains `scripts/build_zip_bundle.py` because both the macOS DMG flow and the private Windows installer flow still call it. See `docs/05-archive/delivery-retired-2026-07/` for the retired design and UAT documents.
