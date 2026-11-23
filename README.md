# Fitcheck
A digital wardrobe app that helps users organize their clothes and plan outfits.

## Outfit recommendations by occasion

Open `index.html` and choose Work, Dinner Out, Date Night, Casual Weekend, or
Party. Each card opens Outfit Ideas with two curated looks from the wardrobe.
Use the occasion links above the outfits to switch, or choose **Any occasion**
to clear the filter. The selected occasion is part of the URL, so refreshing
keeps the same view. Like and Dislike selections follow an outfit across views.

## Personalized outfit order

FitCheck filters by occasion first and ranks those outfits when you open or
refresh Outfit Ideas. A Like gives that outfit 3 points, and a Dislike takes
away 3 points. Each shared piece adds 1 point if it appears in another liked
outfit and subtracts 1 if it appears in another disliked outfit. Each piece
counts once per reaction type, so the two effects cancel when both apply.
An outfit's own reaction only contributes the direct 3-point change.
Feedback from any occasion can inform the order when the outfits share pieces.

Use the heart in any page header to open **Style profile**. Choose any styles and
colors you like and, optionally, one dressing priority. Select **Save My
Preferences** to keep your choices in this browser. FitCheck adds 0.25 points
for a matching style, 0.25 for a matching color, and 0.25 for a matching
priority. Each category contributes once even if several options match. The
maximum boost is 0.75 points, so it can break a feedback tie while preserving
any feedback lead of at least one point. Outfit ideas still filter by occasion
first, and recommendations explain which saved choices or outfit feedback
helped them score. Some color choices may have no match in the current
curated catalog.

Use **Reset Preferences** on your profile to clear your explicit choices.
Likes, Dislikes, bookmarks, and wear history are kept separately. With no
saved profile or unavailable browser storage, the profile adds no points.

Higher scores appear first within the same context match count. Ties keep the
original order, and positive scores on full context matches show
**Recommended for you**. Voting updates or removes explanations immediately
and leaves the current order in place until the next visit or refresh. With no context, relevant feedback, or style
matches, outfits keep their original order. **Reset recommendation preferences** asks for confirmation,
then clears all saved outfit Likes and Dislikes in this browser and reloads
the current occasion. Preferences are kept in this browser's localStorage.

## Refine your outfit

Open **Refine your outfit** in All Outfits and optionally select a weather
condition, dress code, setting, or activity level. **Both** asks for an outfit
suited to indoor and outdoor settings. Choose **Apply context** to update the
results. Set a choice back to **No preference** and apply to clear that choice,
or use **Reset context** to clear all four and keep the occasion.

FitCheck filters by occasion first, then ranks outfits by the number of
selected criteria they match. Feedback and the style profile break ties at the
same match count. Cards explain what they match and miss. If no outfit matches
everything, FitCheck explains the gap and shows only the closest options
within the occasion. If the occasion itself has no outfits, it shows the
occasion empty state.

Context stays in the current search URL, so refreshing or returning from
Saved or Wear History keeps it. Picking another occasion starts a new search.
Context never changes the saved style profile. Tags describe the existing
curated outfits, so some combinations have no exact match. For example, the
current looks include no outfits tagged Cold. Weather is selected manually.

## Saved outfits

Select **Save** on any outfit card to bookmark it. Select **Saved** at the top
of Outfit Ideas to revisit all your bookmarks. The number beside **Saved**
counts bookmarks across every occasion. Select **Saved** on a card again to
remove that bookmark, or return to **All Outfits** to see your current occasion
and personalized order. From an empty Saved view, **Explore outfits** brings
you back to the same results.

Bookmarks are stored in this browser's localStorage and survive reopening the
page. Saving and unsaving are independent of Like and Dislike, and resetting
recommendation preferences leaves bookmarks in place. If storage is blocked,
you can still save outfits for the current page visit.

## Wear history

Select **I wore this** on an outfit in All Outfits or Saved. FitCheck records one
wear per outfit per local calendar day. The card shows **Worn today**, the
total number of logged wears, and the most recent wear date. Select **Undo**
on that card to remove today's entry. The same outfit can be logged again on
another day.

Open **Wear History** to see entries across all occasions, newest dates first.
Each entry uses the outfit's existing photos and shows the date it was worn.
Wear history stays in this browser's localStorage and is independent of
bookmarks, recommendation feedback, and the Cost Per Wear calculator. If
storage is blocked, logging and undo still work for the current page visit.

Bookmarks and wear entries update across open tabs on the same origin. Each
bookmark and each outfit/date wear entry has its own storage key, so edits to
different records can coexist. Conflicting edits to the same record use the
last write. FitCheck still reads the earlier collection format and keeps
per-record removals so deleted legacy entries stay deleted. Data is local to
the browser and site origin.

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

`npm test` is an alias for the same command. The browser tests use Playwright with
installed Chrome by default. Set `PLAYWRIGHT_CHANNEL=msedge` to use installed
Edge, or run `npx playwright install chromium` and set
`PLAYWRIGHT_CHANNEL=chromium` to use Playwright's Chromium.
It starts and stops its own HTTP server and uses a fresh browser context each run.
The unit and integration tests use Node's built-in test runner. Existing regression
tests still cover clearing, independent outfits, invalid saved values, and blocked
storage. Use the manual checks below for broader layout and keyboard behavior.

### GitHub Actions

The workflow in `.github/workflows/test.yml` runs on every push and pull request.
It installs Node.js 24, the npm dependencies, and Playwright Chromium with
its system dependencies before running `npm test`. This covers the unit,
integration, and browser tests. The browser tests serve the app locally and
block external font requests, so CI needs no FitCheck credentials or API keys.

To see CI results, open the repository's **Actions** tab, choose **FitCheck
tests**, and open the **full-suite** job.

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
