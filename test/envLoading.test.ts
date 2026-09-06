import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import assert from 'node:assert/strict'

test('startup scripts load optional local env files and preserve deployed environment values', async () => {
  const { scripts } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const dir = await mkdtemp(join(tmpdir(), 'server-env-'))
  const env = { ...process.env }
  delete env.ANTHROPIC_API_KEY
  try {
    for (const name of ['dev', 'start', 'db:migrate']) {
      const flags = scripts[name].split(' ').filter((arg: string) => arg.startsWith('--env-file'))
      assert.deepEqual(flags, ['--env-file-if-exists=.env.local'])
      const readKey = (environment: NodeJS.ProcessEnv) => execFileSync(process.execPath, [
        ...flags, '-e', 'process.stdout.write(process.env.ANTHROPIC_API_KEY ?? "missing")',
      ], { cwd: dir, env: environment, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      assert.equal(readKey(env), 'missing')
      await writeFile(join(dir, '.env.local'), 'ANTHROPIC_API_KEY=local-test-key\n')
      assert.equal(readKey(env), 'local-test-key')
      assert.equal(readKey({ ...env, ANTHROPIC_API_KEY: 'deployed-test-key' }), 'deployed-test-key')
      await rm(join(dir, '.env.local'))
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
