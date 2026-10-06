# Haneda Week

A shared planner for two people visiting Japan, November 3–9, 2026, in and out of Haneda.

You each add places you want to see. The week arranges them into days, with walk, train, and taxi options, rough fares, and a note when a seat should be reserved. Each day says whether the suitcases stay in the room, get dropped at a hotel before check-in, or should be shipped ahead. The last view is the full itinerary.

November 3 is Culture Day. November 7–8 is the weekend. Those dates are marked because trains and museums are busy.

## Share a plan

GitHub Pages only hosts this website. The plan lives in this repository as `data/trips/<code>.json`, so both of you can edit it from your own browsers.

1. In the repo on GitHub, open Settings → Pages → Build and deployment, and choose **GitHub Actions**.
2. Add your partner as a collaborator with write access.
3. Each of you creates a [fine-grained personal access token](https://github.com/settings/personal-access-tokens) with **Contents: Read and write**, limited to this repository.
4. Open the site, choose the share code in the header, and paste the token, your GitHub username, and the repository name. The token stays in that browser. It is not saved in the trip file.
5. Create a shared plan and send the six-character code, or the link. Your partner opens it and pastes their own token.

If the repository is public, anyone with the code can read the plan. Use a private repository if you do not want that. A private repository still works; both of you need a token to open it.

Saving a wish commits that JSON file. The Pages workflow ignores `data/trips`, so those saves do not rebuild the site.

## Maps

Routes work without a key, using typical trains, times, and fares. For live transit, place search, and hotel lookup, paste a Google Maps key in the share panel, or set `GOOGLE_MAPS_API_KEY` as a repository secret named `GOOGLE_MAPS_API_KEY` and rerun the Pages workflow.

Enable these APIs for the key, and restrict it to your Pages domain:

- Maps JavaScript API
- Places API
- Directions API

Fares from Google are shown when the route includes them. Otherwise the planner uses typical adult one-way prices, which change.

## Run it locally

```bash
npm install
npm run dev
```

The app is at [http://localhost:3847](http://localhost:3847).

```bash
npm test
npm run build
```

`npm run build` writes a static site to `out/`, which is what GitHub Pages deploys.
