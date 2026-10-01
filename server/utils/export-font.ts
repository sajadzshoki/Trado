import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function asFont(raw: unknown) {
  if (!raw) return null
  if (Buffer.isBuffer(raw)) return raw
  if (raw instanceof Uint8Array) return Buffer.from(raw)
  return null
}

export async function readExportFont() {
  // Nitro mounts server/assets at `assets:server`. The custom `fonts` base is
  // the same files, so both keys are tried. The assets driver has getItem only;
  // getItemRaw falls back to that and returns the bundled Uint8Array.
  const keys = [
    'assets:server:fonts:Vazir-Regular.ttf',
    'assets:fonts:Vazir-Regular.ttf',
  ]
  try {
    const storage = useStorage()
    for (const key of keys) {
      const font = asFont(await storage.getItemRaw(key)) ?? asFont(await storage.getItem(key))
      if (font?.length) return font
    }
  }
  catch {
    // Tests and a process without Nitro storage fall back to the file.
  }
  const path = join(process.cwd(), 'server/assets/fonts/Vazir-Regular.ttf')
  if (!existsSync(path)) return null
  return readFileSync(path)
}
