# Fitcheck
A digital wardrobe app that helps users organize their clothes and plan outfits.

## Outfit feedback

Open `outfits.html` in your browser. Each outfit has Like (thumbs up) and Dislike
(thumbs down) buttons. Choose one reaction, switch to the other, or click the
selected button again to clear it. Feedback is saved separately for each outfit
in this browser's localStorage and restored after refreshing. If browser storage
is blocked, reactions work for the current visit but cannot be saved.

### Automated tests

With Node.js 18 or newer installed, run this command from the project folder:

```sh
node --test tests/outfit-feedback.test.cjs
```

No packages need to be installed. The tests use Node's built-in test runner and
small browser stand-ins to run the actual feedback script. They cover selecting,
switching, clearing, restoring, independent outfits, and unavailable storage.
Use the manual checks below for browser layout and keyboard behavior.

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
