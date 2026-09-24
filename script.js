const TOP_K = 5;
const DEFAULT_MOVIE_IDS = [1, 50, 100];

window.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
    const status = document.getElementById("status-message");
    const button = document.getElementById("recommend-btn");

    try {
        status.textContent = "Loading MovieLens 100K…";
        status.className = "status status--loading";
        await loadData();
        populateMovieSelectors();
        button.disabled = false;
        status.textContent = `${movies.length.toLocaleString()} movies and ${ratings.length.toLocaleString()} ratings loaded. Choose three watched titles.`;
        status.className = "status status--success";
    } catch (error) {
        button.disabled = true;
    }
}

function populateMovieSelectors() {
    const sortedMovies = [...movies].sort((a, b) => a.title.localeCompare(b.title));

    document.querySelectorAll(".movie-select").forEach((select, index) => {
        select.replaceChildren();

        for (const movie of sortedMovies) {
            const option = document.createElement("option");
            option.value = String(movie.id);
            option.textContent = movie.title;
            option.selected = movie.id === DEFAULT_MOVIE_IDS[index];
            select.appendChild(option);
        }
    });
}

function dotProduct(left, right) {
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function vectorMagnitude(vector) {
    return Math.sqrt(dotProduct(vector, vector));
}

function cosineSimilarity(left, right) {
    const denominator = vectorMagnitude(left) * vectorMagnitude(right);
    return denominator === 0 ? 0 : dotProduct(left, right) / denominator;
}

function buildUserProfile(watchedMovies) {
    if (!watchedMovies.length) return Array(genreNames.length).fill(0);

    const totals = Array(genreNames.length).fill(0);
    for (const movie of watchedMovies) {
        movie.genreVector.forEach((value, index) => {
            totals[index] += value;
        });
    }

    return totals.map(total => total / watchedMovies.length);
}

function rankMovies(queryVector, excludedIds, limit = TOP_K, similarity = cosineSimilarity) {
    const excluded = new Set(excludedIds);

    return movies
        .filter(movie => !excluded.has(movie.id))
        .map(movie => ({ ...movie, score: similarity(queryVector, movie.genreVector) }))
        .filter(movie => movie.score > 0)
        .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
        .slice(0, limit);
}

function recommendItemToItem(activeMovieId, excludedIds = [], limit = TOP_K) {
    const activeMovie = movies.find(movie => movie.id === activeMovieId);
    if (!activeMovie) return [];

    return rankMovies(activeMovie.genreVector, [activeMovieId, ...excludedIds], limit);
}

function recommendForProfile(watchedMovieIds, limit = TOP_K) {
    const watchedMovies = watchedMovieIds
        .map(id => movies.find(movie => movie.id === id))
        .filter(Boolean);

    return rankMovies(buildUserProfile(watchedMovies), watchedMovieIds, limit);
}

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
        : sorted[midpoint];
}

function discoveryStats(recommendations) {
    const longTailThreshold = median(movies.map(movie => movie.ratingCount));
    const averagePopularity = recommendations.reduce((sum, movie) => sum + movie.ratingCount, 0) / recommendations.length;
    const longTailCount = recommendations.filter(movie => movie.ratingCount <= longTailThreshold).length;

    return { longTailThreshold, averagePopularity, longTailCount };
}

function createRecommendationCard(movie, longTailThreshold) {
    const item = document.createElement("li");
    item.className = "recommendation";

    const heading = document.createElement("div");
    heading.className = "recommendation__heading";

    const title = document.createElement("strong");
    title.textContent = movie.title;
    heading.appendChild(title);

    const score = document.createElement("span");
    score.className = "score";
    score.textContent = movie.score.toFixed(3);
    score.title = "Cosine similarity";
    heading.appendChild(score);

    const details = document.createElement("p");
    details.textContent = `${movie.genres.join(" · ") || "Unknown genre"} · ${movie.ratingCount} ratings`;

    item.append(heading, details);

    if (movie.ratingCount <= longTailThreshold) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "Long tail";
        item.appendChild(badge);
    }

    return item;
}

function renderList(elementId, recommendations, longTailThreshold) {
    const list = document.getElementById(elementId);
    list.replaceChildren(...recommendations.map(movie => createRecommendationCard(movie, longTailThreshold)));
}

function renderComparison(itemRecommendations, profileRecommendations) {
    const itemStats = discoveryStats(itemRecommendations);
    const profileStats = discoveryStats(profileRecommendations);
    const summary = document.getElementById("comparison-summary");

    let discoveryConclusion = "Both approaches expose the same number of long-tail titles in this Top-5.";
    if (profileStats.longTailCount > itemStats.longTailCount) {
        discoveryConclusion = "For this profile, aggregation exposes more long-tail titles.";
    } else if (itemStats.longTailCount > profileStats.longTailCount) {
        discoveryConclusion = "For this selection, the single active item exposes more long-tail titles.";
    }

    summary.textContent = `${discoveryConclusion} Item-to-item: ${itemStats.longTailCount}/5 long-tail, ${itemStats.averagePopularity.toFixed(1)} average ratings. Profile: ${profileStats.longTailCount}/5 long-tail, ${profileStats.averagePopularity.toFixed(1)} average ratings. Long tail is defined as at or below the catalog median (${itemStats.longTailThreshold} ratings).`;
}

function getRecommendations() {
    const selectedIds = [...document.querySelectorAll(".movie-select")]
        .map(select => Number.parseInt(select.value, 10));
    const status = document.getElementById("status-message");

    if (selectedIds.some(id => !Number.isInteger(id)) || new Set(selectedIds).size !== selectedIds.length) {
        status.textContent = "Choose three different movies to build a meaningful profile.";
        status.className = "status status--error";
        return;
    }

    const itemRecommendations = recommendItemToItem(selectedIds[0], selectedIds.slice(1));
    const profileRecommendations = recommendForProfile(selectedIds);
    const threshold = median(movies.map(movie => movie.ratingCount));

    renderList("item-results", itemRecommendations, threshold);
    renderList("profile-results", profileRecommendations, threshold);
    renderComparison(itemRecommendations, profileRecommendations);

    const activeMovie = movies.find(movie => movie.id === selectedIds[0]);
    status.textContent = `Compared Top-${TOP_K} results. Item-to-item uses “${activeMovie.title}”; profile-based averages all three genre vectors.`;
    status.className = "status status--success";
    document.getElementById("results").hidden = false;
}

document.getElementById("recommend-btn").addEventListener("click", getRecommendations);
