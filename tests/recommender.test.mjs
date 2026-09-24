import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const context = vm.createContext({
    console,
    TextDecoder,
    window: { addEventListener() {} },
    document: {
        getElementById() {
            return { addEventListener() {} };
        }
    }
});

vm.runInContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "script.js"), "utf8"), context);
context.itemText = fs.readFileSync(path.join(root, "u.item"), "latin1");
context.ratingText = fs.readFileSync(path.join(root, "u.data"), "utf8");
vm.runInContext("parseItemData(itemText); parseRatingData(ratingText); enrichMovieStatistics();", context);

test("loads the complete MovieLens 100K catalog and ratings", () => {
    const counts = vm.runInContext("({ movieCount: movies.length, ratingCount: ratings.length })", context);
    assert.equal(counts.movieCount, 1682);
    assert.equal(counts.ratingCount, 100000);
});

test("maps MovieLens genre flags without the starter's one-column shift", () => {
    const toyStory = vm.runInContext("movies.find(movie => movie.id === 1)", context);
    assert.deepEqual([...toyStory.genres], ["Animation", "Children's", "Comedy"]);
});

test("computes cosine similarity correctly", () => {
    const score = vm.runInContext("cosineSimilarity([1, 0], [1, 1])", context);
    assert.ok(Math.abs(score - 1 / Math.sqrt(2)) < 1e-12);
});

test("normalization prefers an exact genre direction over an over-tagged candidate", () => {
    const scores = vm.runInContext(`({
        exact: cosineSimilarity([1, 1, 0], [1, 1, 0]),
        overTagged: cosineSimilarity([1, 1, 0], [1, 1, 1]),
        rawExact: dotProduct([1, 1, 0], [1, 1, 0]),
        rawOverTagged: dotProduct([1, 1, 0], [1, 1, 1])
    })`, context);
    assert.equal(scores.rawExact, scores.rawOverTagged);
    assert.ok(scores.exact > scores.overTagged);
});

test("profile recommendations exclude all watched movies and return Top-5", () => {
    const result = vm.runInContext(`(() => {
        const watched = [1, 50, 100];
        const recommendations = recommendForProfile(watched);
        return {
            count: recommendations.length,
            includesWatched: recommendations.some(movie => watched.includes(movie.id)),
            scores: recommendations.map(movie => movie.score)
        };
    })()`, context);

    assert.equal(result.count, 5);
    assert.equal(result.includesWatched, false);
    assert.deepEqual([...result.scores], [...result.scores].sort((a, b) => b - a));
});
