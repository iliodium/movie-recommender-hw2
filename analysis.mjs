import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname);
const context = vm.createContext({
    console,
    TextDecoder,
    window: { addEventListener() {} },
    document: { getElementById: () => ({ addEventListener() {} }) }
});

vm.runInContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "script.js"), "utf8"), context);
context.itemText = fs.readFileSync(path.join(root, "u.item"), "latin1");
context.ratingText = fs.readFileSync(path.join(root, "u.data"), "utf8");
vm.runInContext("parseItemData(itemText); parseRatingData(ratingText); enrichMovieStatistics();", context);

const analysis = vm.runInContext(`(() => {
    const threshold = median(movies.map(movie => movie.ratingCount));
    const positiveByUser = new Map();

    for (const entry of ratings) {
        if (entry.rating < 4) continue;
        if (!positiveByUser.has(entry.userId)) positiveByUser.set(entry.userId, []);
        positiveByUser.get(entry.userId).push(entry);
    }

    const itemRecommendations = [];
    const profileRecommendations = [];
    const itemCatalog = new Set();
    const profileCatalog = new Set();
    const overlaps = [];
    let eligibleUsers = 0;

    for (const userRatings of positiveByUser.values()) {
        if (userRatings.length < 3) continue;
        eligibleUsers += 1;
        const watched = userRatings.sort((a, b) => a.timestamp - b.timestamp).slice(0, 3).map(entry => entry.itemId);
        const itemTop = recommendItemToItem(watched[2], watched.slice(0, 2));
        const profileTop = recommendForProfile(watched);
        if (itemTop.length < TOP_K || profileTop.length < TOP_K) continue;

        itemTop.forEach(movie => { itemRecommendations.push(movie); itemCatalog.add(movie.id); });
        profileTop.forEach(movie => { profileRecommendations.push(movie); profileCatalog.add(movie.id); });
        const profileIds = new Set(profileTop.map(movie => movie.id));
        overlaps.push(itemTop.filter(movie => profileIds.has(movie.id)).length);
    }

    const summarize = (recommendations, catalog) => ({
        recommendationCount: recommendations.length,
        catalogCoverage: catalog.size,
        longTailShare: recommendations.filter(movie => movie.ratingCount <= threshold).length / recommendations.length,
        averageRatingCount: recommendations.reduce((sum, movie) => sum + movie.ratingCount, 0) / recommendations.length,
        averageGenreCount: recommendations.reduce((sum, movie) => sum + movie.genreVector.reduce((a, b) => a + b, 0), 0) / recommendations.length
    });

    const cosineGenreCounts = [];
    const dotGenreCounts = [];
    let cosineMultiGenre = 0;
    let dotMultiGenre = 0;

    for (const seed of movies) {
        const cosineTop = rankMovies(seed.genreVector, [seed.id], TOP_K, cosineSimilarity);
        const dotTop = rankMovies(seed.genreVector, [seed.id], TOP_K, dotProduct);
        for (const movie of cosineTop) {
            const count = movie.genreVector.reduce((a, b) => a + b, 0);
            cosineGenreCounts.push(count);
            if (count >= 3) cosineMultiGenre += 1;
        }
        for (const movie of dotTop) {
            const count = movie.genreVector.reduce((a, b) => a + b, 0);
            dotGenreCounts.push(count);
            if (count >= 3) dotMultiGenre += 1;
        }
    }

    return {
        data: { movies: movies.length, ratings: ratings.length, users: new Set(ratings.map(entry => entry.userId)).size },
        protocol: { eligibleUsers, watchedPerProfile: 3, topK: TOP_K, longTailThreshold: threshold },
        itemToItem: summarize(itemRecommendations, itemCatalog),
        profileBased: summarize(profileRecommendations, profileCatalog),
        averageTop5Overlap: overlaps.reduce((a, b) => a + b, 0) / overlaps.length,
        biasCheck: {
            cosineAverageGenreCount: cosineGenreCounts.reduce((a, b) => a + b, 0) / cosineGenreCounts.length,
            dotAverageGenreCount: dotGenreCounts.reduce((a, b) => a + b, 0) / dotGenreCounts.length,
            cosineMultiGenreShare: cosineMultiGenre / cosineGenreCounts.length,
            dotMultiGenreShare: dotMultiGenre / dotGenreCounts.length
        }
    };
})()`, context);

console.log(JSON.stringify(analysis, null, 2));
