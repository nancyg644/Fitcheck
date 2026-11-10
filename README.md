# Fitcheck
A digital wardrobe app that helps users organize their clothes and plan outfits.

## Outfit feedback

Open `outfits.html` in your browser. Each outfit has Like (thumbs up) and Dislike
(thumbs down) buttons. Choose one reaction, switch to the other, or click the
selected button again to clear it. Feedback is saved separately for each outfit
in this browser's localStorage and restored after refreshing. If browser storage
is blocked, reactions work for the current visit but cannot be saved.

### Automated tests

With Node.js 22 or newer and Google Chrome installed, install the test dependency
once with `npm install`. Then run all unit, integration, and browser tests with:

```sh
node --test tests/*.test.cjs
```

`npm test` is an alias for the same command. The system test uses Playwright with
installed Chrome; set `PLAYWRIGHT_CHANNEL=msedge` to use installed Microsoft Edge.
It starts and stops its own HTTP server and uses a fresh browser context each run.
The unit and integration tests use Node's built-in test runner. Existing regression
tests still cover clearing, independent outfits, invalid saved values, and blocked
storage. Use the manual checks below for broader layout and keyboard behavior.

### GitHub Actions

The workflow in `.github/workflows/test.yml` runs on every push and pull request.
It checks out the repository, installs Node.js 24, and runs the isolated unit test
with the same command used locally:

```sh
node --test tests/outfit-feedback.unit.test.cjs
```

This unit test needs no package installation, browser, keys, or secrets. The full
suite command above also includes integration and Playwright tests. To see CI
results, open the repository's **Actions** tab, choose **Unit tests**, select a run,
then open **unit-tests** and expand **Run unit tests** for the output.

### Assignment: three test levels

User story: As a FitCheck user, I want to like or dislike an outfit so I can record
my preferences.

| Test | What it checks | What could still be broken while it passes |
| --- | --- | --- |
| Unit: `tests/outfit-feedback.unit.test.cjs` | Calls the production selection function directly: Like selects `up`, Dislike replaces it with `down`, and clicking Like twice clears it. A single selection value makes the two choices mutually exclusive. | Missing buttons, incorrect click handlers, CSS, storage writes, or restore-on-refresh can all be broken. |
| Integration: the named `integration:` test in `tests/outfit-feedback.test.cjs` | Reuses the existing HTML-based button stand-ins and Map-backed localStorage stand-in. Runs the production script, clicks Like then Dislike, checks both pressed states and storage writes, then initializes a fresh page with saved storage. Covers all three scenarios at the component boundary. | Real DOM selectors/events, browser storage restrictions, script loading, and visual selected styles can be broken; the stand-ins do not reproduce those browser behaviors. |
| System: `tests/outfit-feedback.system.test.cjs` | Playwright opens actual `outfits.html` in Chrome, clicks actual buttons, checks both pressed states and distinct CSS backgrounds after each choice, then performs a real reload and checks Dislike is still selected. Covers all three scenarios end to end. | Other outfits, other browsers/devices, blocked storage, keyboard/screen-reader usability, and full visual layout can still have defects. It does not check persistence across browser restarts or devices. |

The unit test best locates a defect in the selection rule because it isolates that
function. If it passes but integration fails, investigate button/state/storage
wiring. If both pass but the system test fails, investigate real browser behavior,
HTML/script loading, CSS, or test infrastructure. This narrows the search; it is
not proof of a particular cause. The system test provides the broadest evidence
that the user story works, but is the least precise at locating a defect.

Verification in the assignment environment: **10 tests passed, 0 failed** (three
new tests plus seven existing regression tests). Playwright 1.62.1 was available
in the bundled runtime and used through `NODE_PATH`, since npm was absent and
registry access was unavailable. Chrome required execution outside the network
sandbox to reach the local server. On a normal development machine, use the
dependency installation and single test command above.

### Manual checks

1. Open `outfits.html` and click Like on an outfit. It should appear selected.
2. Click Dislike on that outfit. Only Dislike should remain selected.
3. Click Dislike again. Both buttons should become unselected.
4. Give different outfits different reactions, then refresh. Each should retain
   its own reaction. Clear one and refresh to check that it stays cleared.
5. Use Tab to focus the buttons and Enter or Space to activate them. Check the
   visible focus outline. With a screen reader, check the outfit-specific labels
   and pressed/unpressed states.
6. Try a narrow mobile window (320px wide) and a desktop window. Buttons should
   stay inside each card, and the existing navigation should still work.
