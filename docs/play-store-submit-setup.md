# Play Store Auto-Submit Setup

This project is wired so EAS Submit can upload Android builds to Google Play
using a service account JSON file stored locally at:

`scripts/serviceAccountKey.json`

That file is intentionally ignored by git.

## One-time setup

1. In Google Play Console, open your developer account API access page:
   `https://play.google.com/console/u/0/developers/api-access`
2. Link a Google Cloud project if one is not already linked.
3. Create a Google Cloud service account for Play uploads.
4. In Play Console, grant that service account access to this app.
   A Release Manager style role is usually enough.
5. In Google Cloud, create a JSON key for that service account.
6. Save the downloaded JSON file to:
   `scripts/serviceAccountKey.json`

## Submitting a finished Android build

Once an Android production build has finished on EAS:

```bash
npx eas submit --platform android --profile production --id <BUILD_ID>
```

Because `eas.json` already points to `scripts/serviceAccountKey.json`, no extra
flags are needed once the file exists.

## Notes

- The current submit track is set to `internal`.
- You can promote that release in Play Console later, or change the track in
  `eas.json` when you are ready.
- If Google Play says a build has already been used on another track, promote
  the existing release or build a new Android binary with a higher version code.
