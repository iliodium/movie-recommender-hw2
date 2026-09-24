# Content-Based Movie Recommender — Homework 2

This repository starts from the instructor's Week 2 scaffold and implements the requested content-based recommendation upgrade on MovieLens 100K.

## Deployment

- [Live GitHub Pages application](https://iliodium.github.io/movie-recommender-hw2/)
- [GitHub repository](https://github.com/iliodium/movie-recommender-hw2)

## What changed from the starter

- Replaced Jaccard matching with cosine similarity over 19 MovieLens genre features.
- Fixed the starter parser's shifted genre labels by restoring the `unknown` flag.
- Added a profile-based method that averages three watched movie vectors.
- Compares Top-5 item-to-item and profile-based recommendations side by side.
- Reports rating-count popularity and long-tail exposure for both lists.
- Uses popularity only for analysis; ranking ties are alphabetical, so popularity is not silently injected into the recommender.

## Run locally

The browser must fetch `u.item` and `u.data`, so serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Verify

```bash
npm test
npm run analyze
```

`npm test` checks data completeness, correct genre parsing, cosine math,
normalization behavior, and Top-5 exclusions. `npm run analyze` reproduces the
item-to-item/profile and cosine/dot-product comparison reported in the homework.

## Method

For a movie or averaged user profile vector `q` and candidate vector `x`, the score is:

```text
cosine(q, x) = (q · x) / (||q|| ||x||)
```

The selected watched movies are excluded from both recommendation lists. Results are ordered by cosine score, then title for deterministic ties.

## Data

MovieLens 100K contains 100,000 ratings from 943 users on 1,682 movies. See the dataset README and license at the [GroupLens MovieLens 100K page](https://grouplens.org/datasets/movielens/100k/).
