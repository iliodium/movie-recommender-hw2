// MovieLens 100K data loading and parsing.
// This file intentionally keeps data concerns separate from recommendation logic.

let movies = [];
let ratings = [];

// u.item contains 19 binary genre flags. The first flag is "unknown".
// The starter code omitted it, shifting every genre label by one position.
const genreNames = [
    "Unknown", "Action", "Adventure", "Animation", "Children's",
    "Comedy", "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir",
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi", "Thriller",
    "War", "Western"
];

async function fetchText(path, encoding = "utf-8") {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    return new TextDecoder(encoding).decode(bytes);
}

async function loadData() {
    try {
        // MovieLens 100K item titles use ISO-8859-1; ratings are ASCII-compatible.
        const [movieText, ratingText] = await Promise.all([
            fetchText("u.item", "iso-8859-1"),
            fetchText("u.data")
        ]);

        parseItemData(movieText);
        parseRatingData(ratingText);
        enrichMovieStatistics();
    } catch (error) {
        console.error("Error loading data:", error);
        const resultElement = document.getElementById("status-message");
        if (resultElement) {
            resultElement.textContent = `${error.message}. Serve this folder through a web server rather than opening index.html directly.`;
            resultElement.className = "status status--error";
        }
        throw error;
    }
}

function parseItemData(text) {
    movies = [];

    for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;

        const fields = line.split("|");
        if (fields.length < 24) continue;

        const id = Number.parseInt(fields[0], 10);
        const title = fields[1];
        const genreVector = fields.slice(5, 24).map(value => Number.parseInt(value, 10));
        const genres = genreNames.filter((_, index) => genreVector[index] === 1);

        movies.push({ id, title, genres, genreVector, ratingCount: 0, averageRating: 0 });
    }
}

function parseRatingData(text) {
    ratings = [];

    for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;

        const [userId, itemId, rating, timestamp] = line.split("\t").map(Number);
        if (![userId, itemId, rating, timestamp].every(Number.isFinite)) continue;

        ratings.push({ userId, itemId, rating, timestamp });
    }
}

function enrichMovieStatistics() {
    const aggregates = new Map();

    for (const entry of ratings) {
        const current = aggregates.get(entry.itemId) || { count: 0, sum: 0 };
        current.count += 1;
        current.sum += entry.rating;
        aggregates.set(entry.itemId, current);
    }

    for (const movie of movies) {
        const aggregate = aggregates.get(movie.id) || { count: 0, sum: 0 };
        movie.ratingCount = aggregate.count;
        movie.averageRating = aggregate.count > 0 ? aggregate.sum / aggregate.count : 0;
    }
}
