/* Run after npm run build. NODE_PATH may point to a bundled Playwright install.
 * Every run owns a temporary budget directory, including its backup/recovery files.
 */
const { createHarness } = require('./smoke-harness.cjs')
const scenarios = require('./smoke-scenarios.cjs')

async function main() {
  const h = await createHarness()
  try {
    for (const [name, run] of scenarios) await h.scenario(name, run)
    console.log(JSON.stringify({ result: 'passed', screenshots: h.screenshotDir, checks: h.checks }))
  } catch (error) {
    console.error((await h.page.locator('body').innerText()).slice(0, 10000))
    await h.screenshot('failure')
    throw error
  } finally {
    await h.dispose()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
