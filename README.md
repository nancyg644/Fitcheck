# Fitcheck
A digital wardrobe app that helps users organize their clothes and plan outfits.

## Outfit recommendations by occasion

Open `index.html` and choose Work, Dinner Out, Date Night, Casual Weekend, or
Party. Each card opens Outfit Ideas with curated and generated wardrobe looks.
Use the occasion links above the outfits to switch, or choose **Any occasion**
to clear the filter. The selected occasion is part of the URL, so refreshing
keeps the same view. Like and Dislike selections follow an outfit across views.

## How generated outfits work

`wardrobe-catalog.js` is the shared source for Wardrobe and generated outfits.
It keeps the original category, season, and trip tags and adds item-level
recommendation attributes. The generator builds a top-and-bottom pair or starts
with a dress, adds suitable shoes, and considers a light layer or accessory.
It rejects combinations without a common dress code or coordinated palette,
and checks specific pairing rules for layering, denim, activewear, and formal
dresses. A compatible jacket can extend a combination to cool weather.
Walking requires walking-suitable shoes and room to move in the rest of the outfit.

Every selected occasion and context filter must match. The generator keeps up
to two discovery variants per base and also retains eligible liked variants
for ranking. The list gives distinct garment bases priority and saves extra
liked variants for later results. Exact duplicates keep their predefined card.
Personalized scores favor variety among similarly ranked looks, while the
context explanation names the selected dress code when the outfit qualifies.
**Show more outfits** reveals six more from the
same ranked list, so the current filters and earlier cards stay in place.

A generated outfit's ID is based on its stable wardrobe item IDs. Saved looks,
wear records, and feedback can resolve that ID independently of the current
recommendation list. Retain catalog records for retired pieces if existing
saved outfits must remain readable. The seven predefined outfit IDs stay
the same. Data remains local to the browser and no service is required.

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

Higher scores appear first among outfits that pass all selected filters. Ties
keep the original order, and positive scores show **Recommended for you**.
Voting updates or removes explanations immediately and leaves the current
order in place until the next visit or refresh. With no relevant feedback or
style matches, eligible outfits keep their original order.
**Reset recommendation preferences** asks for confirmation,
then clears all saved outfit Likes and Dislikes in this browser and reloads
the current occasion. Preferences are kept in this browser's localStorage.

## Refine your outfit

Open **Refine your outfit** in All Outfits and optionally select a weather
condition, dress code, setting, or activity level. **Both** asks for an outfit
suited to indoor and outdoor settings. Choose **Apply context** to update the
results. Set a choice back to **No preference** and apply to clear that choice,
or use **Reset context** to clear all four and keep the occasion.

FitCheck requires the selected occasion and every selected context criterion
before ranking with feedback and the style profile. Unselected criteria leave
the results unrestricted. Cards explain what they match. If no outfit passes
all the filters, the page shows an empty state and keeps the filter controls
available. Saved Outfits and Wear History are available independently.

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

Select **Log wear** on an outfit in All Outfits or Saved. The date picker starts
on today's local date and accepts past dates. Open it again to log another wear,
including another wear on the same day. The card shows the total number of
logged wears and the most recent wear date.

Open **Wear History** to see entries across all occasions, newest dates first.
Use **View wears** on a card or choose an outfit in Wear History to see its
individual entries. Each entry shows its date and offers **Edit date** and
**Delete**.
Wear history stays in this browser's localStorage and is independent of
bookmarks, recommendation feedback, and the Cost Per Wear calculator. If
storage is blocked, changes still work for the current page visit.

Bookmarks and wear entries update across open tabs on the same origin. Each
bookmark and each uniquely identified wear entry has its own storage key,
so edits to different records can coexist. Conflicting edits to the same
record use the last write. FitCheck reads both earlier wear formats and uses
stable IDs so legacy entries can be edited or deleted individually. Data is
local to the browser and site origin.

## Outfit feedback

Open `outfits.html` in your browser. Each outfit has Like (thumbs up) and Dislike
(thumbs down) buttons. Choose one reaction, switch to the other, or click the
selected button again to clear it. Feedback is saved separately for each outfit
in this browser's localStorage and restored after refreshing. If browser storage
is blocked, reactions work for the current visit but cannot be saved.

## Local product analytics

On a recommendation card, choose **Choose this outfit** to record an intent.
This is separate from Like, Save, and Log wear. When logging that outfit, you
can select **Link to an earlier outfit choice**. The default is unlinked.
Only an explicitly linked wear counts. Its date must be on or after the local
choice date and it must be linked within 14 days of the choice. Editing the
wear date rechecks credit, and deleting the wear removes its credit. Each
session counts at most once, even when more than one linked wear qualifies.

Outfits starts a recommendation session in the current tab, including
searches with no results. A session expires after 30 minutes of inactivity.
An occasion or filter change starts a new search within an active session.
Each search can show several batches. Refreshing or returning to the same
occasion and filters without a different recommendation search in between
resumes that search and avoids repeating impressions. An outfit that newly
appears still counts as an impression. Changing the occasion or filters and
then changing them back can count as a new search.

The log collects session starts, occasion selections, applied context,
displayed outfit IDs and batches, Show More clicks, reactions, save changes,
choices, wear additions/edits/deletions, empty searches, sanitised error codes,
and time spent generating, filtering, and ranking recommendations. Every
event has an ID, UTC timestamp, type, metadata, and a session ID when relevant.
Wear events also carry the source session of any explicit choice link.

Open **Local analytics** on the **Profile** page to see the summary and
export raw events and metrics as JSON or one row per session as CSV. The
preliminary confirmed-wear rate divides sessions with a qualifying wear by
all recorded sessions. The final OEC uses only sessions that are inactive
and at least 14 days past the session start and all recorded choices. The
summary shows how many sessions are still in follow-up. Selection rate and
Show More rate use all sessions. Like and Save rates use sessions with at
least one impression. Average time to choose uses the first choice per
selecting session. The other measures count occasions and filters, divide
empty searches by all searches, and report median and p95 generation time.
The timing excludes loading images. Later wear edits can revise a reported
rate, even after follow-up has closed.

Analytics stays in localStorage on the current browser and site. FitCheck
collects no names, raw error messages, stack traces, or external tracking
IDs. Logs are capped at 90 days, 2,000 events, or roughly 1 MB, pruning whole
session groups on writes. A duplicated tab can inherit the original tab's
session state. Browser storage may be cleared or blocked, and an unlinked
wear cannot be credited. **Clear analytics** clears the analytics log and
choices after confirmation while keeping existing product data. Exports are
local files, so share them only if you intend to share those observations.

`analytics-store.js` handles storage, `analytics-session.js` tracks searches and
batches, and `analytics-metrics.js` handles attribution, metrics, and exports.
`analytics-browser.js`, `analytics-choice.js`, and `analytics-profile.js` connect
those modules to the app. Tests live in `tests/analytics.unit.test.cjs`,
`tests/analytics.test.cjs`, and the browser suite.

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
